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

async function fire(fn, body) {
  try {
    const r = await fetch(SITE + '/.netlify/functions/' + fn, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': process.env.ADMIN_PASSWORD || '' },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { fn, status: r.status };
  } catch (e) { return { fn, error: e.message }; }
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

  // 2. Fire the full revenue stack NOW (best-effort, parallel). On a blitz we
  //    also restock prospects, run the outreach follow-up engine, and re-engage
  //    non-buyers, so money-path work starts before the AI shift even spins up.
  const jobs = [fire('discover-companies-house'), fire('dispatch-approved'), fire('ping-sitemaps'), fire('reply-loop')];
  let drafted = 0, scavenged = 0, enriched = 0;
  if (blitz) {
    jobs.push(fire('daily-followup'));
    jobs.push(fire('cron-nurture'));
    // 1) SCAVENGE: hunt real local businesses with bad/no websites + their
    //    published contacts, into the prospect pool (cold-outreach fuel).
    try {
      const s = await fetch(SITE + '/.netlify/functions/blitz-scavenge', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-password': process.env.ADMIN_PASSWORD || '' } });
      const sj = await s.json().catch(() => ({}));
      scavenged = sj.found || 0;
    } catch (_) {}
    // 1b) ENRICH: turn the scavenged websites into emailable contacts.
    try {
      const e = await fetch(SITE + '/.netlify/functions/contact-enrich', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-password': process.env.ADMIN_PASSWORD || '' } });
      const ej = await e.json().catch(() => ({}));
      enriched = ej.found || 0;
    } catch (_) {}
    // 2) PUSH: draft warm reactivation + win-back + cold emails (to everyone
    //    contactable, hottest first) into the approval queue NOW.
    try {
      const r = await fetch(SITE + '/.netlify/functions/blitz-push', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-password': process.env.ADMIN_PASSWORD || '' } });
      const j = await r.json().catch(() => ({}));
      drafted = j.drafted || 0;
    } catch (_) {}
  }
  const fired = await Promise.all(jobs);

  // 3. ALL HANDS. Every desk in the org lights up green so Harry watches the
  //    whole company work the blitz at once. One batched write does it.
  await logBatch(buildEntries({ scavenged, enriched, drafted }));

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ok: true,
      requested: shift,
      blitz,
      drafted,
      scavenged,
      enriched,
      note: ops ? (blitz ? ('Scavenged ' + scavenged + ' businesses, found ' + enriched + ' new email contacts, drafted ' + drafted + ' emails into your queue. Approve the batch and they send within the daily cap. The AI sprint (previews + deeper enrichment) also starts on the Mac.') : 'Shift requested; the Mac will run it on its next watcher tick.') : 'Blobs unavailable; only the instant pieces ran.',
      fired,
    }),
  };
};
