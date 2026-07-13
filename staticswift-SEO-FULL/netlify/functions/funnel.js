/*
 * funnel.js — the conversion funnel for the admin. Aggregates the whole
 * pipeline into one honest set of numbers so Harry can see WHERE leads die:
 *   prospects found -> emails drafted -> sent -> preview views -> replies ->
 *   claims/bookings -> paid.
 * Admin only. Read-only; pulls from the queue, the messages store, the preview
 * view counter, and the CRM.
 */
const { getNamedStore } = require('./_blobs');

exports.handler = async (event) => {
  const auth = event.headers['x-admin-password'];
  if (!process.env.ADMIN_PASSWORD || auth !== process.env.ADMIN_PASSWORD) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const out = { prospects: 0, drafted: 0, sent: 0, previewViews: 0, previewsSeen: 0, replies: 0, claims: 0, bookings: 0, leads: 0, paid: 0, revenue: 0 };

  // Queue: drafted + sent outreach/replies.
  try {
    const q = getNamedStore('approval-queue');
    const items = (q && (await q.get('items', { type: 'json' }))) || [];
    const outreachy = i => ['outreach', 'outreach-followup', 'cs-reply'].includes(i.category);
    out.drafted = items.filter(outreachy).length;
    out.sent = items.filter(i => outreachy(i) && i.status === 'sent').length;
    out.replies = items.filter(i => i.category === 'cs-reply').length;
  } catch (_) {}

  // Durable send total. The queue only keeps the last 2000 items, so sent rows
  // get evicted once the pipeline is busy and the queue-derived count above
  // under-reports. dispatch-approved keeps a never-trimmed tally in ops; use the
  // larger of the two so "Emailed" is always the truth, never fewer than reality.
  try {
    const ops = getNamedStore('ops');
    const ss = (ops && (await ops.get('send-stats', { type: 'json' }))) || {};
    if (Number(ss.total) > out.sent) out.sent = Number(ss.total);
    out.sentToday = (ss.byDay && ss.byDay[new Date().toISOString().slice(0, 10)]) || 0;
    out.lastSentAt = ss.lastSentAt || null;
  } catch (_) {}

  // Preview views.
  try {
    const ops = getNamedStore('ops');
    const s = (ops && (await ops.get('preview-stats', { type: 'json' }))) || {};
    out.previewViews = s.total || 0;
    out.previewsSeen = s.byId ? Object.keys(s.byId).length : 0;
  } catch (_) {}

  // Messages: claims + bookings (high intent).
  try {
    const m = getNamedStore('messages');
    const threads = (m && (await m.get('threads', { type: 'json' }))) || [];
    out.claims = threads.filter(t => t.kind === 'claim').length;
    out.bookings = threads.filter(t => t.kind === 'booking').length;
  } catch (_) {}

  // CRM: prospects, leads, paid, revenue.
  try {
    const { readDB } = require('./_db');
    const db = await readDB();
    out.prospects = Array.isArray(db.cronProspects) ? db.cronProspects.length : 0;
    const clients = Array.isArray(db.clients) ? db.clients : [];
    out.leads = clients.length;
    const paid = clients.filter(c => c.paid || ['won', 'live', 'paid'].includes((c.stage || '').toLowerCase()));
    out.paid = paid.length;
    // Never show a retired/banned price (149/299/29/871) from stale client data:
    // if the stored amount is a banned figure, use the current price instead.
    const BANNED = [149, 299, 29, 871];
    const realAmt = c => { const a = Number(c.amount); const isPro = c.package === 'advanced' || c.package === 'pro'; return (a && !BANNED.includes(a)) ? a : (isPro ? 999 : 499); };
    out.revenue = paid.reduce((s, c) => s + realAmt(c), 0);
  } catch (_) {}

  return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify({ ok: true, funnel: out }) };
};
