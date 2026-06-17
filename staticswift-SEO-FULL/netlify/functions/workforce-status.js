/*
 * workforce-status.js — one call that powers the admin Workforce tab.
 *
 * Returns the whole org's live state: the org chart (departments + roles),
 * each shift's health (running/idle/stale), the recent agent activity feed,
 * approval-queue counts + pending items, kill switches, and a per-role last-seen
 * derived from the activity feed and the queue. Admin-only.
 */
const { getNamedStore } = require('./_blobs');

// The full org from data/org.json (one source of truth, shared with the admin
// client-side render). require() so esbuild inlines it into the bundle.
let ORG;
try {
  ORG = require('../../data/org.json').departments.map(d => [d.dept, d.roles]);
} catch (_) {
  ORG = [['Executive', ['CEO Agent', 'CFO Agent']], ['Chief of Staff', ['Chief of Staff']]];
}

const SHIFTS = { morning: 6, midday: 12, evening: 20 };

exports.handler = async (event) => {
  const auth = event.headers['x-admin-password'];
  if (!process.env.ADMIN_PASSWORD || auth !== process.env.ADMIN_PASSWORD) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  const ops = getNamedStore('ops');
  const queue = getNamedStore('approval-queue');
  const now = Date.now();

  // Shift health
  const health = ops ? ((await ops.get('shift-health', { type: 'json' })) || {}) : {};
  const shifts = {};
  for (const [name, hour] of Object.entries(SHIFTS)) {
    const last = health[name]?.end || health[name]?.start || null;
    const ageH = last ? (now - Date.parse(last)) / 3600000 : null;
    shifts[name] = {
      hour, last,
      lastExit: health[name]?.lastExit ?? null,
      running: !!(health[name]?.start && (!health[name]?.end || Date.parse(health[name].start) > Date.parse(health[name].end))),
      stale: ageH === null || ageH > 26,
    };
  }

  // Activity feed
  const activity = ops ? ((await ops.get('agent-activity', { type: 'json' })) || []) : [];
  const lastByRole = {};
  for (const a of activity) { if (a.role && !lastByRole[a.role]) lastByRole[a.role] = { at: a.at, action: a.action }; }

  // Queue
  let items = [], counts = {}, kill = { global: false }, autonomy = {};
  if (queue) {
    items = (await queue.get('items', { type: 'json' })) || [];
    const control = (await queue.get('control', { type: 'json' })) || {};
    kill = control.kill || { global: false };
    autonomy = control.autonomy || {};
    counts = items.reduce((m, i) => { m[i.status] = (m[i.status] || 0) + 1; return m; }, {});
  }
  const pending = items.filter(i => i.status === 'pending').sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 50);
  const today = new Date().toISOString().slice(0, 10);
  const sentToday = items.filter(i => i.status === 'sent' && (i.sentAt || '').slice(0, 10) === today).length;

  // Org with live overlay
  const org = ORG.map(([dept, roles]) => ({
    dept,
    roles: roles.map(r => ({ name: r, last: lastByRole[r] || null })),
  }));

  // Setup health: which critical env vars are present. Booleans only, never
  // values. This turns the silent failures (empty activity feed, no sends,
  // no live preview links) into a visible checklist in the admin.
  const env = {
    agentToken: !!process.env.AGENT_TOKEN,        // agents can log activity -> board + brief fill
    smtp: !!process.env.SMTP_PASS,                // outreach can actually send
    supportSmtp: !!process.env.SUPPORT_SMTP_PASS, // reply-loop can read the support inbox
    netlifyToken: !!process.env.NETLIFY_AUTH_TOKEN, // live preview links work
    openai: !!process.env.OPENAI_API_KEY,         // sharper reply classification (optional)
  };

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify({ ok: true, org, shifts, activity: activity.slice(0, 40), queue: { counts, pending, sentToday, kill, autonomy }, env }),
  };
};
