/*
 * reply-loop.js — the autonomous reply handler. The most expensive leak in the
 * business is an interested "yes, go on then" sitting unread. This closes it.
 *
 * Every run (scheduled every ~15 min in UK hours, and on every blitz tick):
 *   1. Pull recent inbound mail from hello@ and support@ (via fetch-inbox).
 *   2. Keep only genuine replies to our outreach (subject "Re: ...") we have
 *      not already handled, from real people (never our own addresses).
 *   3. Classify each (via categorize-reply: interested / objection /
 *      not-interested / unsubscribe / autoreply). Unsubscribes are suppressed
 *      automatically by that function.
 *   4. Draft the right on-brand response into the approval queue as a sendable
 *      cs-reply: interested -> offer the free preview and a next step;
 *      objection -> reassure (nothing to pay until they approve a preview).
 *      Nothing is sent here; Harry approves, the dispatcher sends within cap.
 *
 * Idempotent: handled message ids are remembered in Blobs (ops/reply-seen) so
 * a reply is never drafted twice. Admin password, agent token, or schedule.
 */
const { load, saveItems } = require('./_queue');
const { getNamedStore } = require('./_blobs');
const { isSuppressed, unsubUrl } = require('./_suppression');

const SITE = process.env.URL || process.env.SS_SITE || 'https://staticswift.co.uk';
const F = { build: 499, monthly: 49, previewHours: 24, buildDays: 14, guaranteeDays: 60, wa: '07502 731 799' };
const SEEN_KEY = 'reply-seen';
const MAX_PER_RUN = 20;
const OURS = /@staticswift\.co\.uk|mailer-daemon|no-?reply|postmaster|notifications?@/i;
const emailOf = s => { const m = String(s || '').match(/[^\s<>"]+@[^\s<>"]+/); return m ? m[0].toLowerCase().replace(/[>",]+$/, '') : ''; };
const firstName = s => { const m = String(s || '').replace(/<[^>]*>/, '').trim().match(/^([A-Za-z][A-Za-z'-]+)/); return m ? m[1] : 'there'; };
const stripRe = s => String(s || '').replace(/^(\s*(re|fwd?):\s*)+/i, '').trim();

async function fire(fn, body, method) {
  try {
    const r = await fetch(SITE + '/.netlify/functions/' + fn, {
      method: method || 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': process.env.ADMIN_PASSWORD || '' },
      body: body ? JSON.stringify(body) : undefined,
    });
    return r;
  } catch (e) { return null; }
}
async function log(role, dept, action, detail) {
  try {
    await fetch(SITE + '/.netlify/functions/agent-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-agent-token': process.env.AGENT_TOKEN || '' },
      body: JSON.stringify({ role, dept, action, detail, shift: 'reply-loop' }),
    });
  } catch (_) {}
}

function interestedDraft(name, theirSubject) {
  return {
    subject: 'Re: ' + (stripRe(theirSubject) || 'your website'),
    body:
`Hi ${name},

Brilliant, thanks for getting back to me. I would love to build you a real working preview of your new site, free, no card. I just need a couple of things: what you do, the area you cover, and a number people can call you on.

Send those over and I will have a preview in front of you within ${F.previewHours} hours. If you like it, it is ${F.build} pounds once, live within ${F.buildDays} days, and if it does not bring you a lead in ${F.guaranteeDays} days you get every penny back.

Easiest is a quick reply here, or WhatsApp me on ${F.wa}.

Harry
StaticSwift, Manchester`,
  };
}
function objectionDraft(name, theirSubject) {
  return {
    subject: 'Re: ' + (stripRe(theirSubject) || 'your website'),
    body:
`Hi ${name},

Fair question, and no pressure at all. The way it works: I build you a real preview first, free and with no card, so you can see exactly what you would be getting before you decide anything. You only pay the ${F.build} pounds if you want to keep it.

It is live within ${F.buildDays} days, the ${F.monthly} pounds a month is optional and not required, and there is a ${F.guaranteeDays}-day guarantee: no lead in that time and you get a full refund and keep the site.

Want me to just build the preview so you can judge it for yourself? Reply here or WhatsApp ${F.wa}.

Harry
StaticSwift, Manchester`,
  };
}

exports.handler = async (event) => {
  const isSchedule = !event.headers || !!(event.headers && event.headers['x-nf-event']);
  const auth = event.headers && event.headers['x-admin-password'];
  const agent = event.headers && event.headers['x-agent-token'];
  const okAdmin = process.env.ADMIN_PASSWORD && auth === process.env.ADMIN_PASSWORD;
  const okAgent = process.env.AGENT_TOKEN && agent === process.env.AGENT_TOKEN;
  if (!isSchedule && !okAdmin && !okAgent) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

  // 1. Pull the inbox (fetch-inbox is admin-gated and returns an array).
  let inbox = [];
  try {
    const r = await fire('fetch-inbox', null, 'GET');
    if (r && r.ok) inbox = await r.json();
  } catch (_) {}
  if (!Array.isArray(inbox)) inbox = [];

  const ops = getNamedStore('ops');
  const seen = (ops && (await ops.get(SEEN_KEY, { type: 'json' }))) || {};
  const { store, items } = await load();
  if (!store) return { statusCode: 200, body: JSON.stringify({ ok: false, reason: 'Blobs unavailable' }) };

  // Addresses we already have a pending/approved reply waiting for.
  const openReplyTo = new Set(items.filter(i => (i.status === 'pending' || i.status === 'approved') && i.category === 'cs-reply').map(i => (i.to || '').toLowerCase()));

  // 2. Candidates: genuine replies ("Re:"), from real people, not yet handled.
  const candidates = inbox
    .filter(m => /^\s*re:/i.test(m.subject || ''))
    .filter(m => !OURS.test(m.from || ''))
    .filter(m => !seen[m.id])
    .slice(0, MAX_PER_RUN);

  const now = new Date().toISOString();
  let scanned = candidates.length, drafted = 0, interested = 0, objections = 0, unsub = 0, skipped = 0;

  for (const m of candidates) {
    const from = emailOf(m.from);
    seen[m.id] = Date.now(); // mark handled regardless, so we never reprocess
    if (!from) { skipped++; continue; }
    if (await isSuppressed(from)) { skipped++; continue; }

    // 3. Classify (this also auto-suppresses any unsubscribe intent).
    let cat = 'interested';
    try {
      const r = await fire('categorize-reply', { text: m.text || m.snippet || m.subject, fromEmail: from });
      if (r && r.ok) { const d = await r.json(); cat = (d && d.category) || 'interested'; }
    } catch (_) {}

    if (cat === 'unsubscribe') { unsub++; await log('Reply Triage Specialist', 'Customer Service', 'Honoured an unsubscribe and suppressed the address', from); continue; }
    if (cat === 'autoreply') { skipped++; continue; }
    if (cat === 'not-interested') { await log('Reply Triage Specialist', 'Customer Service', 'Logged a polite no and closed the thread', from); continue; }
    if (openReplyTo.has(from)) { skipped++; continue; } // already drafting to them

    // 4. Draft the right reply into the queue (sendable cs-reply).
    const name = firstName(m.from);
    const d = cat === 'objection' ? objectionDraft(name, m.subject) : interestedDraft(name, m.subject);
    if (cat === 'objection') objections++; else interested++;
    items.push({
      id: 'q_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      createdAt: now, status: 'pending', category: 'cs-reply', to: from,
      subject: d.subject, body: d.body,
      prospect: { segment: 'reply', replyType: cat, theirMessage: (m.snippet || m.text || '').slice(0, 240) },
      meta: { replyLoop: true, replyType: cat, hot: cat === 'interested', heat: cat === 'interested' ? 95 : 70 },
    });
    openReplyTo.add(from); drafted++;
    await log(cat === 'objection' ? 'Proposal Writer' : 'Reply Triage Specialist', cat === 'objection' ? 'Growth & Conversion' : 'Customer Service',
      cat === 'objection' ? 'Drafted a reassurance reply to an objection' : 'Drafted a reply to an interested lead', from);
  }

  if (ops) { try { await ops.setJSON(SEEN_KEY, capSeen(seen)); } catch (_) {} }
  await saveItems(store, items);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ok: true, scanned, drafted, interested, objections, unsub, skipped,
      note: drafted
        ? drafted + ' reply' + (drafted === 1 ? '' : 'ies') + ' drafted into your approval queue (interested + objections). Approve to send within the daily cap.'
        : (scanned ? 'Replies scanned, nothing new needed a draft.' : 'No new replies to your outreach this run.'),
    }),
  };
};

// Keep the seen map from growing forever: drop ids older than 30 days.
function capSeen(seen) {
  const cutoff = Date.now() - 30 * 86400000;
  const out = {};
  for (const k of Object.keys(seen)) { if (seen[k] > cutoff) out[k] = seen[k]; }
  return out;
}

// Exposed for unit tests only.
module.exports._t = { emailOf, firstName, stripRe, interestedDraft, objectionDraft, capSeen, OURS };
