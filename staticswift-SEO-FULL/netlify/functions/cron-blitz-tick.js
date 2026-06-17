/*
 * cron-blitz-tick.js — the server-side heartbeat that keeps a blitz ALIVE.
 *
 * The problem this fixes: the old sustained loop only ran on Harry's Mac. If
 * the Mac is closed or the watcher is not installed, a blitz fired once and
 * then "everyone switched off". This runs on Netlify's schedule instead, so a
 * blitz keeps working with no Mac at all.
 *
 * Every 2 minutes: if blitz-mode is ACTIVE, run the no-AI revenue stack
 *   scavenge -> enrich -> draft -> reply -> dispatch
 * and re-log the whole roster so all desks stay green. Each pass adds more
 * prospects and more drafts to the approval queue, so the queue climbs toward
 * hundreds over the window instead of stalling after one round. Does nothing
 * when no blitz is running (cheap no-op).
 */
const { getNamedStore } = require('./_blobs');
const { buildEntries } = require('./_blitz-roster');

const SITE = process.env.URL || 'https://staticswift.co.uk';
const PW = process.env.ADMIN_PASSWORD || '';

async function fire(fn) {
  try {
    const r = await fetch(SITE + '/.netlify/functions/' + fn, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': PW },
    });
    return await r.json().catch(() => ({}));
  } catch (_) { return {}; }
}
async function logBatch(entries) {
  try {
    await fetch(SITE + '/.netlify/functions/agent-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-agent-token': process.env.AGENT_TOKEN || '' },
      body: JSON.stringify({ shift: 'blitz', entries }),
    });
  } catch (_) {}
}

exports.handler = async (event) => {
  // Scheduled invocations carry x-nf-event; allow admin to poke it too.
  const isSchedule = !event.headers || !!(event.headers && event.headers['x-nf-event']);
  const manual = event.headers && process.env.ADMIN_PASSWORD && event.headers['x-admin-password'] === process.env.ADMIN_PASSWORD;
  if (!isSchedule && !manual) return { statusCode: 401, body: 'Unauthorized' };
  if (!PW) return { statusCode: 200, body: JSON.stringify({ ok: false, reason: 'no ADMIN_PASSWORD' }) };

  // Only do anything while a blitz is live.
  const ops = getNamedStore('ops');
  if (!ops) return { statusCode: 200, body: JSON.stringify({ ok: true, blitz: false, reason: 'Blobs unavailable' }) };
  let state = (await ops.get('blitz-mode', { type: 'json' })) || { active: false };
  if (state.active && state.until && Date.parse(state.until) <= Date.now()) state = { active: false };
  if (!state.active) return { statusCode: 200, body: JSON.stringify({ ok: true, blitz: false, skipped: 'no blitz running' }) };

  // Run the no-AI revenue stack, sequentially so each step feeds the next.
  const sc = await fire('blitz-scavenge');
  const en = await fire('contact-enrich');
  const pu = await fire('blitz-push');
  const rl = await fire('reply-loop');
  await fire('dispatch-approved');

  const counts = {
    scavenged: sc.found || 0,
    enriched: en.found || 0,
    drafted: pu.drafted || 0,
    replies: rl.drafted || 0,
    queued: (pu.drafted || 0),
  };
  // Keep every desk green and show the running counts.
  await logBatch(buildEntries(counts));

  return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify({ ok: true, blitz: true, minsLeft: state.until ? Math.max(0, Math.round((Date.parse(state.until) - Date.now()) / 60000)) : null, ...counts }) };
};
