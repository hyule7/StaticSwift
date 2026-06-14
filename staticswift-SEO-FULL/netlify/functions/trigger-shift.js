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

// Log activity so the Workforce tab lights up the moment Harry hits Start,
// not only when the full AI shift completes.
async function log(role, dept, action, detail) {
  try {
    await fetch(SITE + '/.netlify/functions/agent-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-agent-token': process.env.AGENT_TOKEN || '' },
      body: JSON.stringify({ role, dept, action, detail, shift: 'manual' }),
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
  const jobs = [fire('discover-companies-house'), fire('dispatch-approved'), fire('ping-sitemaps')];
  if (blitz) { jobs.push(fire('daily-followup')); jobs.push(fire('cron-nurture')); }
  const fired = await Promise.all(jobs);

  // 3. Light up the whole revenue team so Harry watches the blitz live.
  const okt = fired.find(x => x.fn === 'discover-companies-house');
  await Promise.all([
    log('Companies House Watcher', 'Business Development', 'Scanning Companies House for brand-new UK trade companies', okt && okt.status === 200 ? 'fresh prospects pulled' : 'scan triggered'),
    log('Lead Reactivation Specialist', 'Growth & Conversion', 'Mining the CRM for warm leads to win back today', ''),
    log('Brief Chaser', 'Growth & Conversion', 'Chasing started-but-unfinished briefs with the free-preview offer', ''),
    log('Sales Closer', 'Growth & Conversion', 'Standing by to answer every hot reply within minutes', ''),
    log('Preview Builder', 'Business Development', 'Building one-page previews for the top prospects', '"I already built you this"'),
    log('Writer', 'Business Development', 'Drafting personalised first emails for the queue', ''),
    log('Dispatcher', 'Operations & Finance', 'Sending all approved outreach now', ''),
    log('Conversion Optimiser', 'Growth & Conversion', 'Checking the funnel for one change that lifts sign-ups today', ''),
    log('CEO Agent', 'Executive', 'BLITZ ordered: all hands, one goal, a sale today', 'AI sprint starts on the Mac within minutes'),
  ]);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ok: true,
      requested: shift,
      blitz,
      note: ops ? (blitz ? 'BLITZ on. The team is restocking, dispatching and re-engaging now; the AI sales sprint starts on the Mac within minutes.' : 'Shift requested; the Mac will run it on its next watcher tick.') : 'Blobs unavailable; only the instant pieces ran.',
      fired,
    }),
  };
};
