/*
 * shift-healthcheck.js — records shift start/end pings so a MISSED shift is
 * visible on Harry's phone. The shift runner posts {shift,event,at,exit};
 * a GET returns the last-seen times per shift and flags any shift that has
 * not checked in within its expected window.
 *
 * No auth on POST (the ping carries no secrets and is harmless); GET is
 * admin-only so the dashboard can show shift health.
 */
const { getNamedStore } = require('./_blobs');
const KEY = 'shift-health';

exports.handler = async (event) => {
  const s = getNamedStore('ops');
  if (event.httpMethod === 'POST') {
    let p; try { p = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, body: 'bad JSON' }; }
    if (!p.shift) return { statusCode: 400, body: 'shift required' };
    if (s) {
      const state = (await s.get(KEY, { type: 'json' })) || {};
      state[p.shift] = { ...(state[p.shift] || {}), [p.event || 'ping']: p.at || new Date().toISOString(), lastExit: p.exit ?? state[p.shift]?.lastExit };
      await s.setJSON(KEY, state);
    }
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }
  // GET: admin-only health view
  const auth = event.headers['x-admin-password'];
  if (!process.env.ADMIN_PASSWORD || auth !== process.env.ADMIN_PASSWORD) return { statusCode: 401, body: 'Unauthorized' };
  const state = s ? ((await s.get(KEY, { type: 'json' })) || {}) : {};
  const now = Date.now();
  // Expected windows (UK): morning ~06:00, midday ~12:00, evening ~20:00.
  const expected = { morning: 6, midday: 12, evening: 20 };
  const health = {};
  for (const [shift, hour] of Object.entries(expected)) {
    const last = state[shift]?.end || state[shift]?.start;
    const ageH = last ? (now - Date.parse(last)) / 3600000 : null;
    health[shift] = { last: last || null, lastExit: state[shift]?.lastExit ?? null, stale: ageH === null || ageH > 26 };
  }
  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, health }) };
};
