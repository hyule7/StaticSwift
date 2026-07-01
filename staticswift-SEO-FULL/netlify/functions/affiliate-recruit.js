/*
 * affiliate-recruit.js — recruits commission-only partners (affiliates).
 *
 * Reaches out to businesses that already have UK trades as clients (accountants,
 * bookkeepers, trade suppliers, business coaches, marketers) and offers them a
 * cut for every client they refer who goes live. No cost to them, pure upside.
 * This is a compounding, no-ad-spend lead source.
 *
 * Drafts into the approval queue (category outreach, segment affiliate). Reuses
 * suppression + dedupe + a per-lead cadence so it is never spammy. Admin or
 * agent token. AFFILIATE_FEE (default 100) sets the referral fee per live client.
 */
const { readDB } = require('./_db');
const { load, saveItems } = require('./_queue');
const { isSuppressed, unsubUrl } = require('./_suppression');

const FEE = Number(process.env.AFFILIATE_FEE || 100);   // £ per referred client that goes live
const CAP = 30;
const WA = '07502 731 799';
const isEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim());
const first = n => (n && String(n).trim().split(/\s+/)[0]) || 'there';
// Business types that make good referrers (they have trade clients to refer).
const REFERRER = /account|bookkeep|market|consult|coach|advisor|adviser|supplier|wholesale|merchant|insur|mortgage|solicitor|finance|agency|signage|print|van|tool/i;

function pitch(p) {
  const biz = p.companyName || p.bizname || p.name || 'your business';
  const fn = first(p.contactName);
  const town = p.town || p.location || 'your area';
  return {
    subject: 'A simple way to earn from your trade clients',
    body:
`Hi${fn !== 'there' ? ' ' + fn : ''},

I am Harry at StaticSwift. I hand-code websites for UK tradespeople: free working preview in 24 hours, 499 pounds once if they keep it, 60-day lead guarantee.

You already work with the exact people I build for. So here is a straight offer: introduce me to a tradesperson who needs a website, and if they go live I pay you ${FEE} pounds. No cost to you, no lock-in, no catch. You just make the introduction and I do the rest.

Plenty of accountants, suppliers and coaches are quietly earning this way. If it is of interest, reply and I will set you up with a simple referral link, or we can keep it as easy as you forwarding my details.

Harry
StaticSwift, Manchester
WhatsApp ${WA}
Reason for this email: you work with UK trades and this is a partner introduction, not marketing. Not interested? Reply STOP. Unsubscribe: ${unsubUrl(p.email, 'affiliate')}`,
  };
}

exports.handler = async (event) => {
  const auth = event.headers && event.headers['x-admin-password'];
  const agent = event.headers && event.headers['x-agent-token'];
  const isSchedule = !event.headers || !!(event.headers && event.headers['x-nf-event']);
  const okAdmin = process.env.ADMIN_PASSWORD && auth === process.env.ADMIN_PASSWORD;
  const okAgent = process.env.AGENT_TOKEN && agent === process.env.AGENT_TOKEN;
  if (!isSchedule && !okAdmin && !okAgent) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

  let db; try { db = await readDB(); } catch (e) { return { statusCode: 200, body: JSON.stringify({ ok: false, reason: 'CRM unavailable: ' + e.message }) }; }
  const { store, items } = await load();
  if (!store) return { statusCode: 200, body: JSON.stringify({ ok: false, reason: 'Blobs unavailable' }) };

  const queuedTo = new Set(items.filter(i => i.status === 'pending' || i.status === 'approved').map(i => (i.to || '').toLowerCase()));
  const everSent = new Set(items.filter(i => i.status === 'sent' && i.to).map(i => i.to.toLowerCase()));

  const prospects = (Array.isArray(db.cronProspects) ? db.cronProspects : []);
  // Prefer referrer-type businesses; they have trades to refer.
  const targets = prospects.filter(p => isEmail(p.email) && REFERRER.test(String(p.type || p.trade || p.bizname || p.companyName || '')));

  const now = new Date().toISOString();
  let drafted = 0;
  for (const p of targets) {
    if (drafted >= CAP) break;
    const email = p.email.toLowerCase();
    if (queuedTo.has(email) || everSent.has(email)) continue;
    if (await isSuppressed(p.email)) continue;
    const d = pitch(p);
    items.push({
      id: 'q_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      createdAt: now, status: 'pending', category: 'outreach', to: p.email,
      subject: d.subject, body: d.body,
      prospect: { business: p.companyName || p.bizname || p.name, segment: 'affiliate' },
      meta: { affiliate: true, segment: 'affiliate' },
    });
    queuedTo.add(email); drafted++;
  }
  await saveItems(store, items);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, drafted, fee: FEE, candidates: targets.length, note: drafted ? (drafted + ' partner-recruitment emails drafted into your queue at ' + FEE + ' pounds per referral. Approve to send.') : 'No new referrer-type businesses in the pool yet. The blitz finds accountants, suppliers and coaches as it sweeps.' }),
  };
};
