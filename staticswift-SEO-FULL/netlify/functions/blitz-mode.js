/*
 * blitz-mode.js — the war-room switch. When Harry starts a blitz it stays ON
 * for a set window (default 2 hours) and the Mac watcher runs the all-hands
 * blitz shift over and over until it expires or Harry hits Stop. This is what
 * makes "everyone works flat out for the next hour or two" real, instead of a
 * one-shot trigger.
 *
 * State in Blobs (ops/blitz-mode): { active, startedAt, until, by }.
 *   GET                      -> current state (admin or agent token)
 *   POST {action:'start', hours} -> turn on for N hours (default 2)
 *   POST {action:'stop'}     -> turn off now
 */
const { getNamedStore } = require('./_blobs');
const KEY = 'blitz-mode';

exports.handler = async (event) => {
  const auth = event.headers['x-admin-password'];
  const agent = event.headers['x-agent-token'];
  const okAdmin = process.env.ADMIN_PASSWORD && auth === process.env.ADMIN_PASSWORD;
  const okAgent = process.env.AGENT_TOKEN && agent === process.env.AGENT_TOKEN;
  if (!okAdmin && !okAgent) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

  const ops = getNamedStore('ops');
  if (!ops) return { statusCode: 200, body: JSON.stringify({ active: false, reason: 'Blobs unavailable' }) };

  const now = Date.now();
  let state = (await ops.get(KEY, { type: 'json' })) || { active: false };
  // Auto-expire.
  if (state.active && state.until && Date.parse(state.until) <= now) state = { active: false, endedAt: new Date(now).toISOString() };

  if (event.httpMethod === 'POST') {
    if (!okAdmin) return { statusCode: 401, body: 'Admin only' };
    let p = {}; try { p = JSON.parse(event.body || '{}'); } catch {}
    if (p.action === 'start') {
      const hours = Math.min(Math.max(Number(p.hours) || 2, 1), 6); // 1 to 6 hours
      state = { active: true, startedAt: new Date(now).toISOString(), until: new Date(now + hours * 3600000).toISOString(), hours };
      await ops.setJSON(KEY, state);
      return { statusCode: 200, body: JSON.stringify({ ok: true, ...state }) };
    }
    if (p.action === 'stop') {
      state = { active: false, endedAt: new Date(now).toISOString() };
      await ops.setJSON(KEY, state);
      return { statusCode: 200, body: JSON.stringify({ ok: true, ...state }) };
    }
    return { statusCode: 400, body: JSON.stringify({ error: 'unknown action' }) };
  }

  // GET: include minutes remaining for the UI countdown.
  const minsLeft = state.active && state.until ? Math.max(0, Math.round((Date.parse(state.until) - now) / 60000)) : 0;
  return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify({ ...state, minsLeft }) };
};
