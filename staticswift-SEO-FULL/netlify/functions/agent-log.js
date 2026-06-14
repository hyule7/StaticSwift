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
    if (!p.action) return { statusCode: 400, body: 'action required' };
    if (s) {
      const feed = (await s.get(KEY, { type: 'json' })) || [];
      feed.unshift({
        at: new Date().toISOString(),
        role: String(p.role || 'unknown').slice(0, 60),
        dept: String(p.dept || '').slice(0, 40),
        action: String(p.action).slice(0, 200),
        detail: String(p.detail || '').slice(0, 300),
        shift: String(p.shift || '').slice(0, 20),
      });
      await s.setJSON(KEY, feed.slice(0, CAP));
    }
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }

  // GET — admin only
  const auth = event.headers['x-admin-password'];
  if (!process.env.ADMIN_PASSWORD || auth !== process.env.ADMIN_PASSWORD) return { statusCode: 401, body: 'Unauthorized' };
  const feed = s ? ((await s.get(KEY, { type: 'json' })) || []) : [];
  return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify({ ok: true, activity: feed.slice(0, 80) }) };
};
