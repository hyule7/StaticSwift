/*
 * manual-shift-state.js — the Mac watcher reads/claims the "Start everyone now"
 * request here. GET returns the current flag; POST {action:'claim'} marks it
 * claimed so it runs once. Admin-only.
 */
const { getNamedStore } = require('./_blobs');
const KEY = 'manual-shift';

exports.handler = async (event) => {
  const auth = event.headers['x-admin-password'];
  if (!process.env.ADMIN_PASSWORD || auth !== process.env.ADMIN_PASSWORD) return { statusCode: 401, body: 'Unauthorized' };
  const ops = getNamedStore('ops');
  if (!ops) return { statusCode: 200, body: JSON.stringify({}) };

  if (event.httpMethod === 'POST') {
    let p = {}; try { p = JSON.parse(event.body || '{}'); } catch {}
    const cur = (await ops.get(KEY, { type: 'json' })) || {};
    if (p.action === 'claim') { cur.claimed = true; cur.claimedAt = new Date().toISOString(); await ops.setJSON(KEY, cur); }
    if (p.action === 'clear') { await ops.setJSON(KEY, {}); }
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }
  const cur = (await ops.get(KEY, { type: 'json' })) || {};
  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cur) };
};
