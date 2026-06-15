/*
 * blitz-push.js — the proper BD push. When Harry hits Blitz, this fills the
 * approval queue NOW with real, personalised, ready-to-send emails, server
 * side, no Mac needed:
 *   - warm-lead reactivation (leads who enquired/started a brief and did not pay)
 *   - non-buyer win-back (website-check + lead-magnet signups)
 *   - cold first-touch to contactable prospects (those with a real email)
 *
 * Field Guide voice, PECR-compliant (reason for contact + one-click unsub),
 * suppression honoured, deduped against what is already queued, capped so the
 * queue stays reviewable. Every draft lands status=pending for one-tap approval;
 * the dispatcher then sends within the daily cap. Admin or agent token.
 */
const { readDB } = require('./_db');
const { load, saveItems } = require('./_queue');
const { isSuppressed, unsubUrl } = require('./_suppression');

const F = { build: 499, monthly: 49, previewHours: 24, guaranteeDays: 60, wa: '07502 731 799' };
const CAP_WARM = 40, CAP_COLD = 40;
const isEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim());
const first = n => (n && String(n).trim().split(/\s+/)[0]) || 'there';
const sigUnsub = (email, cat) => 'Not interested? Reply STOP and I will not email again. Unsubscribe: ' + unsubUrl(email, cat);

function reactivation(lead) {
  const fn = first(lead.name);
  const town = lead.location || lead.town || 'your area';
  const trade = (lead.business_type || lead.trade || '').replace(/-/g, ' ');
  return {
    subject: 'Your free preview is still waiting' + (lead.business_name ? ', ' + lead.business_name : ''),
    body:
`Hi ${fn},

You enquired about a website${trade ? ' for your ' + trade : ''}${town ? ' in ' + town : ''} and I never got it in front of you. That is on me. The offer still stands: a real working preview in ${F.previewHours} hours, free, no card. You only pay the ${F.build} pounds if you keep it, and if it does not bring a lead in ${F.guaranteeDays} days you get it all back.

Want me to build it? Reply here or message me on WhatsApp ${F.wa}.

Harry
StaticSwift, Manchester
${sigUnsub(lead.delivery_email, 'reactivation')}`,
  };
}

function winback(rec) {
  const fn = first(rec.name);
  return {
    subject: 'Three quick wins for your website',
    body:
`Hi ${fn},

You checked your website with my free tool a little while back. I build hand-coded sites for UK trades that fix exactly the things it flags: mobile speed, click-to-call, reviews where customers see them.

If it is easier, I will just build you a new one. Real working preview in ${F.previewHours} hours, free, no card. ${F.build} pounds once if you keep it, ${F.guaranteeDays}-day lead guarantee.

Reply and I will start tonight.

Harry
StaticSwift, Manchester
${sigUnsub(rec.email, 'winback')}`,
  };
}

function cold(p) {
  // Normalise across prospect shapes: OSM (bizname/type/location), Companies
  // House (companyName/sicCode/town), and manual (name/trade/town).
  const biz = p.companyName || p.bizname || p.name || '';
  const fn = first(p.contactName);
  const town = p.town || p.location || 'your area';
  const trade = String(p.trade || p.type || p.businessType || 'business').replace(/-/g, ' ');
  const obs = p.website ? '' : 'You do not seem to have a website yet. ';
  return {
    subject: obs ? ('A website for ' + (biz || 'your ' + trade) + '?') : (trade.charAt(0).toUpperCase() + trade.slice(1) + ' website, ' + town),
    body:
`Hi${fn !== 'there' ? ' ' + fn : ''},

${obs}I am Harry, I hand-code websites for ${trade}s around ${town}. I will build you a real working preview in ${F.previewHours} hours, free, no card. If you keep it it is ${F.build} pounds once, and if it does not bring a lead in ${F.guaranteeDays} days you get your money back.

Want me to make you one? Reply here, or start the 60-second brief: https://staticswift.co.uk/order.html?source=blitz&trade=${encodeURIComponent(p.trade || '')}&town=${encodeURIComponent(town)}

Harry
StaticSwift, Manchester
Reason for this email: you run a ${trade} in ${town} and I build sites for that trade. ${sigUnsub(p.email, 'outreach')}`,
  };
}

exports.handler = async (event) => {
  const auth = event.headers['x-admin-password'];
  const agent = event.headers['x-agent-token'];
  const okAdmin = process.env.ADMIN_PASSWORD && auth === process.env.ADMIN_PASSWORD;
  const okAgent = process.env.AGENT_TOKEN && agent === process.env.AGENT_TOKEN;
  if (!okAdmin && !okAgent) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

  let db; try { db = await readDB(); } catch (e) { return { statusCode: 200, body: JSON.stringify({ ok: false, reason: 'CRM unavailable: ' + e.message }) }; }
  const { store, items } = await load();
  if (!store) return { statusCode: 200, body: JSON.stringify({ ok: false, reason: 'Blobs unavailable' }) };

  // ── Anti-spam contact memory ──────────────────────────────────────────
  // Never draft to someone we already have queued/approved, emailed in the
  // last RECENT_DAYS, or hit MAX_TOUCHES times ever. This is what stops the
  // blitz becoming spam and burning the sending domain.
  const RECENT_DAYS = 10, MAX_TOUCHES = 4;
  const queuedTo = new Set(items.filter(i => i.status === 'pending' || i.status === 'approved').map(i => (i.to || '').toLowerCase()));
  const touches = {}; const lastAt = {};
  for (const i of items) {
    if (i.status !== 'sent' || !i.to) continue;
    const k = i.to.toLowerCase();
    touches[k] = (touches[k] || 0) + 1;
    const t = Date.parse(i.sentAt || i.createdAt || 0);
    if (t && (!lastAt[k] || t > lastAt[k])) lastAt[k] = t;
  }
  const tooSoon = email => {
    const k = email.toLowerCase();
    if ((touches[k] || 0) >= MAX_TOUCHES) return true;
    if (lastAt[k] && (Date.now() - lastAt[k]) < RECENT_DAYS * 86400000) return true;
    return false;
  };
  let skippedFreq = 0;

  // Hotness score: recency + intent. The hottest get drafted and sent first.
  const ageDays = iso => { const t = Date.parse(iso || 0); return t ? (Date.now() - t) / 86400000 : 9999; };
  const clientHeat = c => {
    let s = 0; const stage = (c.stage || '').toLowerCase();
    if (stage === 'brief_received') s += 60; else if (stage === 'contacted') s += 35; else if (stage === 'new-lead') s += 45;
    const a = ageDays(c.createdAt); if (a < 2) s += 40; else if (a < 7) s += 25; else if (a < 30) s += 10;
    if (c.whatsapp || c.phone) s += 10;
    return s;
  };
  const clients = (Array.isArray(db.clients) ? db.clients : []).slice().sort((a, b) => clientHeat(b) - clientHeat(a));
  const nurture = (Array.isArray(db.nurture) ? db.nurture : []).slice().sort((a, b) => ageDays(a.addedAt || a.lastSeenAt) - ageDays(b.addedAt || b.lastSeenAt));
  const prospects = (Array.isArray(db.cronProspects) ? db.cronProspects : []).slice().sort((a, b) => (b.score || 0) - (a.score || 0));
  let hot = 0;
  const now = new Date().toISOString();
  const drafts = [];
  let warm = 0, cold_ = 0;

  // 1. Warm reactivation: enquired, not paid, not already a won/live client.
  for (const c of clients) {
    if (warm >= CAP_WARM) break;
    const email = c.delivery_email || c.email;
    if (!isEmail(email)) continue;
    const stage = (c.stage || '').toLowerCase();
    if (['won', 'live', 'paid', 'lost'].includes(stage)) continue;
    if (c.paid) continue;
    if (queuedTo.has(email.toLowerCase())) continue;
    if (await isSuppressed(email)) continue;
    if (tooSoon(email)) { skippedFreq++; continue; }
    const d = reactivation(c);
    const heat = clientHeat(c); const isHot = heat >= 70;
    if (isHot) hot++;
    drafts.push({ to: email, category: 'outreach', subject: d.subject, body: d.body, prospect: { business: c.business_name, stage, segment: 'reactivation', heat, hot: isHot } });
    queuedTo.add(email.toLowerCase()); warm++;
  }

  // 2. Non-buyer win-back (lead-magnet / website-check signups).
  for (const r of nurture) {
    if (warm >= CAP_WARM) break;
    const email = r.email;
    if (!isEmail(email) || queuedTo.has(email.toLowerCase())) continue;
    if (await isSuppressed(email)) continue;
    if (tooSoon(email)) { skippedFreq++; continue; }
    const d = winback(r);
    drafts.push({ to: email, category: 'outreach', subject: d.subject, body: d.body, prospect: { segment: 'winback', source: r.source } });
    queuedTo.add(email.toLowerCase()); warm++;
  }

  // 3. Cold first-touch to prospects that actually have an email.
  for (const p of prospects) {
    if (cold_ >= CAP_COLD) break;
    const email = p.email;
    if (!isEmail(email) || queuedTo.has(email.toLowerCase())) continue;
    if (await isSuppressed(email)) continue;
    if (tooSoon(email)) { skippedFreq++; continue; }
    const d = cold(p);
    drafts.push({ to: email, category: 'outreach', subject: d.subject, body: d.body, prospect: { business: p.companyName || p.bizname || p.name, trade: p.trade || p.type, town: p.town || p.location, segment: 'cold' } });
    queuedTo.add(email.toLowerCase()); cold_++;
  }

  // Push all drafts to the queue (pending).
  // Hottest drafts to the top so they are approved and sent first.
  drafts.sort((a, b) => ((b.prospect && b.prospect.heat) || 0) - ((a.prospect && a.prospect.heat) || 0));
  for (const d of drafts) {
    items.push({
      id: 'q_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      createdAt: now, status: 'pending', category: d.category, to: d.to,
      subject: d.subject, body: d.body, prospect: d.prospect,
      meta: { blitz: true, segment: d.prospect && d.prospect.segment, hot: !!(d.prospect && d.prospect.hot), heat: (d.prospect && d.prospect.heat) || 0 },
    });
  }
  await saveItems(store, items);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ok: true,
      drafted: drafts.length,
      reactivation: warm, cold: cold_, hot,
      skippedAlreadyContacted: skippedFreq,
      contactsEverReached: Object.keys(touches).length,
      note: drafts.length
        ? drafts.length + ' emails drafted and waiting in your approval queue. Approve the batch and the dispatcher sends them within the daily cap.'
        : 'No contactable warm leads or emailed prospects to draft right now. New Companies House prospects need a contact found first (the Contact Finder runs on the Mac shift).',
    }),
  };
};
