/*
 * queue-list.js — admin reads the approval queue (mobile-first dashboard).
 * Returns pending items first, plus autonomy state and kill switches.
 */
const { load } = require('./_queue');

exports.handler = async (event) => {
  const auth = event.headers['x-admin-password'];
  if (!process.env.ADMIN_PASSWORD || auth !== process.env.ADMIN_PASSWORD) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  const { items, control } = await load();
  const status = (event.queryStringParameters || {}).status || 'pending';
  const filtered = items
    .filter(i => status === 'all' ? true : i.status === status)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const counts = items.reduce((m, i) => { m[i.status] = (m[i.status] || 0) + 1; return m; }, {});
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify({ ok: true, items: filtered.slice(0, 200), counts, autonomy: control.autonomy, kill: control.kill }),
  };
};
