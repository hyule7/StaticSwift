/*
 * agent-log.js — the live activity feed for the workforce.
 *
 * Shifts and agents POST a line as they work ({role, dept, action, detail});
 * the admin Workforce tab GETs the recent feed so Harry can watch what the
 * staff are doing in real time. Stored in Blobs store 'ops', key 'agent-activity'
 * (capped). POST takes the agent token; GET takes the admin password.
 */
const { getNamedStore } = require('./_blobs');
const KEY = 'agent-activity';
const CAP = 500;

exports.handler = async (event) => {
  const s = getNamedStore('ops');

  if (event.httpMethod === 'POST') {
    if (!process.env.AGENT_TOKEN || event.headers['x-agent-token'] !== process.env.AGENT_TOKEN) {
      return { statusCode: 401, body: 'Unauthorized' };
    }
    let p; try { p = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, body: 'bad JSON' }; }
    // Batch mode: { entries: [{role,dept,action,detail,shift}, ...] } writes the
    // whole set in ONE blob write. This is how a blitz lights up all 94 desks at
    // once without 94 racing round-trips (which would drop entries).
    const batch = Array.isArray(p.entries) ? p.entries : (p.action ? [p] : null);
    if (!batch || !batch.length) return { statusCode: 400, body: 'action or entries required' };
    if (s) {
      const feed = (await s.get(KEY, { type: 'json' })) || [];
      const now = new Date().toISOString();
      const clean = batch.filter(e => e && e.action).map(e => ({
        at: e.at || now,
        role: String(e.role || 'unknown').slice(0, 60),
        dept: String(e.dept || '').slice(0, 40),
        action: String(e.action).slice(0, 200),
        detail: String(e.detail || '').slice(0, 300),
        shift: String(e.shift || p.shift || '').slice(0, 20),
      }));
      feed.unshift(...clean); // newest first, batch order preserved
      await s.setJSON(KEY, feed.slice(0, CAP));
      return { statusCode: 200, body: JSON.stringify({ ok: true, logged: clean.length }) };
    }
    return { statusCode: 200, body: JSON.stringify({ ok: true, logged: 0 }) };
  }

  // GET — admin only
  const auth = event.headers['x-admin-password'];
  if (!process.env.ADMIN_PASSWORD || auth !== process.env.ADMIN_PASSWORD) return { statusCode: 401, body: 'Unauthorized' };
  const feed = s ? ((await s.get(KEY, { type: 'json' })) || []) : [];
  return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify({ ok: true, activity: feed.slice(0, 80) }) };
};
