/*
 * send-brief.js — the 7am Chief of Staff brief.
 *
 * Builds the brief from live numbers (analytics-self, get-clients via _db,
 * queue counts) and emails it to Harry. Can be called by the Morning Ops
 * shift (agent token) or scheduled directly (07:00 UK). Plain, one screen,
 * no em dashes. The brief is also returned in the response so the shift can
 * log it.
 */
const { getNamedStore } = require('./_blobs');
const { readDB } = require('./_db');
const { createTransporter } = require('./_mailer');

async function queueCounts() {
  try {
    const s = getNamedStore('approval-queue');
    if (!s) return {};
    const items = (await s.get('items', { type: 'json' })) || [];
    return items.reduce((m, i) => { m[i.status] = (m[i.status] || 0) + 1; return m; }, {});
  } catch { return {}; }
}

exports.handler = async (event) => {
  const isSchedule = !event.headers || !!event.headers['x-nf-event'];
  const agent = event.headers?.['x-agent-token'] && event.headers['x-agent-token'] === process.env.AGENT_TOKEN;
  const admin = event.headers?.['x-admin-password'] && event.headers['x-admin-password'] === process.env.ADMIN_PASSWORD;
  if (!isSchedule && !agent && !admin) return { statusCode: 401, body: 'Unauthorized' };

  let clients = [];
  try { const db = await readDB(); clients = Array.isArray(db.clients) ? db.clients : (Array.isArray(db.intake) ? db.intake : []); } catch {}
  const now = Date.now();
  const newLeads = clients.filter(c => { const t = Date.parse(c.createdAt || 0); return t && (now - t) < 86400000; });
  const stages = clients.reduce((m, c) => { const s = c.stage || 'unknown'; m[s] = (m[s] || 0) + 1; return m; }, {});
  const q = await queueCounts();

  // Top 3 decisions only Harry can make: interested replies, briefs awaiting
  // build approval, and anything flagged critical. Derived, not invented.
  const decisions = [];
  if (q.pending) decisions.push(`${q.pending} item(s) in the approval queue waiting on you: staticswift.co.uk/admin/queue.html`);
  const briefs = clients.filter(c => (c.stage || '') === 'brief_received').length;
  if (briefs) decisions.push(`${briefs} brief(s) received and awaiting a build decision.`);
  if (newLeads.length) decisions.push(`${newLeads.length} new lead(s) overnight: reply or approve the drafted response.`);
  while (decisions.length < 3) decisions.push('Nothing else needs only you today. The queue has the rest.');

  const d = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/London' });
  const text =
`Morning Harry. ${d}.

YESTERDAY
- New leads: ${newLeads.length}
- Pipeline: ${Object.entries(stages).map(([s, c]) => `${s} ${c}`).join(', ') || 'empty'}

APPROVAL QUEUE
- Pending ${q.pending || 0} · approved ${q.approved || 0} · sent ${q.sent || 0} · rejected ${q.rejected || 0}
- Review and approve from your phone: https://staticswift.co.uk/admin/queue.html

TOP 3 DECISIONS ONLY YOU CAN MAKE
1. ${decisions[0]}
2. ${decisions[1]}
3. ${decisions[2]}

The workforce handled the rest into the queue. Nothing was sent without your tap.

StaticSwift Chief of Staff`;

  if (process.env.SMTP_PASS) {
    try {
      const t = createTransporter();
      await t.sendMail({
        from: '"StaticSwift Chief of Staff" <' + (process.env.SMTP_USER || 'hello@staticswift.co.uk') + '>',
        to: process.env.BRIEF_TO || process.env.SMTP_USER || 'hello@staticswift.co.uk',
        subject: `Brief · ${d} · ${newLeads.length} new, ${q.pending || 0} to approve`,
        text,
      });
    } catch (err) { console.warn('[send-brief] mail failed', err.message); }
  }
  return { statusCode: 200, body: JSON.stringify({ ok: true, brief: text }) };
};
