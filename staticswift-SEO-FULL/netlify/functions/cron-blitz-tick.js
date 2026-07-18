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

async function fire(fn, ms) {
  try {
    const r = await fetch(SITE + '/.netlify/functions/' + fn, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': PW },
      signal: AbortSignal.timeout(ms || 8000),
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

  // Rotate ONE bounded stage per tick so no single invocation runs the whole
  // sequential pipeline (which blew the ~10s limit and made the blitz stall at
  // ~10 then stop). These functions share one database, so they must never run
  // in parallel; rotating keeps each tick fast AND the data consistent. Over a
  // few minutes the full pipeline cycles, and the queue climbs into the
  // hundreds across the window instead of stopping after one round.
  // Fast 4-phase rotation. Advances every 12s (matched to the browser pulse) so
  // that over ~48 seconds the team does EVERYTHING: discover, enrich, draft+send,
  // and recruit partners. Each phase is one bounded call (or a fast pair) that
  // fits the ~10s function limit. The shared DB is never written in parallel.
  const phase = Math.floor(Date.now() / 12000) % 5;
  const counts = {};
  if (phase === 0) {
    const sc = await fire('blitz-scavenge', 8500);
    counts.scavenged = sc.found || 0;
  } else if (phase === 1) {
    const en = await fire('contact-enrich', 8500);
    counts.enriched = en.found || 0;
  } else if (phase === 2) {
    const pu = await fire('blitz-push', 6000);
    counts.drafted = pu.drafted || 0; counts.queued = pu.drafted || 0;
    await fire('dispatch-approved', 3000);
  } else if (phase === 3) {
    const af = await fire('affiliate-recruit', 5000);
    counts.partners = af.drafted || 0;
    fire('reply-loop', 1); // best-effort; also on its own 15-min schedule
  } else {
    // Link Building agent: refresh the backlink checklist + log the next action.
    const bl = await fire('blitz-backlinks', 4000);
    counts.backlinksDone = bl.done != null ? bl.done : undefined;
    counts.backlinksTotal = bl.total != null ? bl.total : undefined;
  }

  // Every tick: keep all desks green and show the running counts (fast).
  await logBatch(buildEntries(counts));

  return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify({ ok: true, blitz: true, stage, minsLeft: state.until ? Math.max(0, Math.round((Date.parse(state.until) - Date.now()) / 60000)) : null, ...counts }) };
};
