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

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const auth = event.headers['x-admin-password'];
  if (!process.env.ADMIN_PASSWORD || auth !== process.env.ADMIN_PASSWORD) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  let body = {}; try { body = JSON.parse(event.body || '{}'); } catch {}
  const shift = ['morning', 'midday', 'evening', 'all'].includes(body.shift) ? body.shift : 'all';

  // 1. Flag for the Mac watcher.
  const ops = getNamedStore('ops');
  if (ops) {
    await ops.setJSON('manual-shift', { shift, requestedAt: new Date().toISOString(), claimed: false });
  }

  // 2. Fire the no-AI pieces now (best-effort, parallel).
  const fired = await Promise.all([
    fire('discover-companies-house'),
    fire('dispatch-approved'),
    fire('ping-sitemaps'),
  ]);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ok: true,
      requested: shift,
      note: ops ? 'Shift requested; the Mac will run it on its next watcher tick (within minutes).' : 'Blobs unavailable; only the instant pieces ran.',
      fired,
    }),
  };
};
