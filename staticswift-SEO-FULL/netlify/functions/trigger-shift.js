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

  // 3. ALL HANDS. The whole company comes online so Harry can watch every desk
  //    work the blitz in parallel. The no-AI desks did real work above; the rest
  //    are kicked off here and the Mac AI shift (blitz.md) carries them out.
  const okt = fired.find(x => x.fn === 'discover-companies-house');
  await Promise.all([
    // Business Development
    log('Companies House Watcher', 'Business Development', 'Scanning Companies House for brand-new UK trade companies', okt && okt.status === 200 ? 'fresh prospects pulled' : 'scan triggered'),
    log('Website Checker', 'Business Development', scavenged ? ('Scavenged ' + scavenged + ' businesses with bad or no websites') : 'Hunting businesses with weak websites', 'busiest UK towns'),
    log('Contact Finder', 'Business Development', enriched ? ('Found ' + enriched + ' new email contacts') : 'Digging out contact details', 'published + MX-verified'),
    log('Writer', 'Business Development', drafted ? ('Drafted ' + drafted + ' personalised emails into the queue') : 'Drafting personalised first emails', 'hottest first'),
    log('Sequencer', 'Business Development', 'Scheduling day-2 and day-5 follow-ups for everyone emailed', ''),
    log('Preview Builder', 'Business Development', 'Building one-page previews for the top prospects', 'I already built you this'),
    // Growth & Conversion (the sales floor)
    log('Lead Reactivation Specialist', 'Growth & Conversion', 'Mining the CRM for warm leads to win back today', ''),
    log('Brief Chaser', 'Growth & Conversion', 'Chasing started-but-unfinished briefs', ''),
    log('Win-back Specialist', 'Growth & Conversion', 'Re-engaging old non-buyers with a fresh angle', ''),
    log('Sales Closer', 'Growth & Conversion', 'On the phones and inbox for every hot reply', 'answering within minutes'),
    log('Conversion Optimiser', 'Growth & Conversion', 'Reviewing the funnel for the one change that lifts sign-ups', ''),
    log('Landing Page Tester', 'Growth & Conversion', 'Testing the highest-traffic pages for drop-off', ''),
    log('Email Lifecycle Specialist', 'Growth & Conversion', 'Tuning the nurture sequence for replies', ''),
    log('Paid Ads Manager', 'Growth & Conversion', 'Reviewing cost-per-lead and briefing a fresh creative', ''),
    // Analytics & Data (watching people leave, in real time)
    log('Data Analyst', 'Analytics & Data', 'Watching live sessions and bounce rate as visitors land', ''),
    log('Attribution Analyst', 'Analytics & Data', 'Tracing which channel is bringing the best leads today', ''),
    log('Reporting Analyst', 'Analytics & Data', 'Building the live blitz scoreboard', ''),
    // Search (looking at pages)
    log('Strike List Builder', 'Search', 'Pulling pages ranking 4 to 15 to push onto page one', ''),
    log('On-Page Optimiser', 'Search', 'Deepening the winnable pages and pointing internal links at them', ''),
    log('Index Watcher', 'Search', 'Pinging IndexNow and checking crawl coverage', ''),
    // Creative
    log('Ad Creative Designer', 'Creative Production', 'Producing fresh TikTok ad creatives in the brand style', 'downloadable in admin'),
    log('Hook Researcher', 'Creative Production', 'Checking live trends for the angle that stops the scroll', ''),
    // Customer Service + Client Success
    log('Triage', 'Customer Service', 'Watching the inbox so no enquiry waits', ''),
    log('Reputation Manager', 'Client Success', 'Chasing reviews from happy clients for fresh proof', ''),
    // Ops + Quality + Exec
    log('Dispatcher', 'Operations & Finance', 'Sending approved outreach, hottest leads first', ''),
    log('Fact Checker', 'Quality & Risk', 'Checking every drafted message against the facts and the voice', ''),
    log('CEO Agent', 'Executive', 'BLITZ ordered: all hands, one goal, a sale today', 'sprint running on the Mac'),
  ]);

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
