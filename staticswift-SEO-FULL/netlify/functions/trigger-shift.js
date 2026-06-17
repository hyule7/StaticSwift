/*
 * trigger-shift.js — "Start everyone working now" from the browser.
 *
 * The AI shifts run on Harry's Mac (headless Claude), so the browser can't
 * launch them directly. This does two things on one tap:
 *   1. Writes a manual-run request to Blobs (ops/manual-shift). The Mac's
 *      run-watcher (installed by install-autostart.sh) polls this every few
 *      minutes and runs the requested shift, then clears the flag.
 *   2. Immediately fires the NO-AI Netlify pieces that don't need the Mac, so
 *      Harry sees instant movement: restock prospects (Companies House),
 *      dispatch any approved mail, ping sitemaps. These are safe and gated.
 *
 * Admin-only. Returns what fired so the UI can confirm.
 */
const { getNamedStore } = require('./_blobs');

const SITE = process.env.URL || 'https://staticswift.co.uk';

// Call a sibling function with a hard timeout so one slow call can never make
// the button hang past Netlify's ~10s sync-function limit (a timeout there is
// what made the war room wrongly report "check password"). Returns parsed JSON.
async function fire(fn, ms) {
  try {
    const r = await fetch(SITE + '/.netlify/functions/' + fn, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': process.env.ADMIN_PASSWORD || '' },
      signal: AbortSignal.timeout(ms || 7000),
    });
    return await r.json().catch(() => ({ status: r.status }));
  } catch (e) { return { error: e.message }; }
}

// Build one activity line per role from the single source of truth, so a blitz
// lights up EVERY desk. Shared with cron-blitz-tick (the server heartbeat).
const { buildEntries } = require('./_blitz-roster');

// Log a whole batch of activity in ONE write so all desks light up at once
// the moment Harry hits Blitz (not just when the Mac AI shift finishes).
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
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const auth = event.headers['x-admin-password'];
  if (!process.env.ADMIN_PASSWORD || auth !== process.env.ADMIN_PASSWORD) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  let body = {}; try { body = JSON.parse(event.body || '{}'); } catch {}
  // The "Start everyone working now" button sends shift:'blitz' = all hands,
  // one goal, a sale today. Other values run a normal scheduled shift.
  const shift = ['morning', 'midday', 'evening', 'all', 'blitz'].includes(body.shift) ? body.shift : 'blitz';
  const blitz = shift === 'blitz' || shift === 'all';

  // 1. Flag for the Mac watcher to run the blitz shift (agents/shifts/blitz.md).
  const ops = getNamedStore('ops');
  if (ops) {
    await ops.setJSON('manual-shift', { shift: blitz ? 'blitz' : shift, requestedAt: new Date().toISOString(), claimed: false });
  }

  // 2. Instant movement, BOUNDED so the button can never time out. We await
  //    only the fast queue-fillers (draft from the existing pool, then send).
  //    The heavy discovery (scavenge -> enrich -> reply) is run reliably every
  //    2 minutes by the scheduled cron-blitz-tick while blitz-mode is active,
  //    so it does not block this request.
  let drafted = 0;
  if (blitz) {
    const push = await fire('blitz-push', 8500);
    drafted = (push && push.drafted) || 0;
    await fire('dispatch-approved', 5000);
  } else {
    await fire('dispatch-approved', 5000);
  }

  // 3. ALL HANDS. Every desk lights up green immediately. One batched write.
  await logBatch(buildEntries({ drafted }));

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ok: true,
      requested: shift,
      blitz,
      drafted,
      note: blitz
        ? (drafted ? ('Drafted ' + drafted + ' emails into your queue. The team keeps scavenging, enriching and drafting every 2 minutes for the rest of the blitz, so the queue climbs toward hundreds.') : 'War room live. The team is scavenging and drafting now; the queue fills over the next few minutes.')
        : 'Shift requested; the Mac will run it on its next watcher tick.',
    }),
  };
};
