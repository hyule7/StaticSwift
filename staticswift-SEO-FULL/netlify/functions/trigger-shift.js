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

// The whole org, inlined at build time (single source of truth, same file the
// admin and workforce-status read). Lets a blitz light up EVERY desk.
let ORG = [];
try { ORG = require('../../data/org.json').departments.map(d => [d.dept, d.roles]); } catch (_) {}

// Log a whole batch of activity in ONE write so all 94 desks light up at once
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

  // 3. ALL HANDS. Every one of the 94 desks comes online so Harry watches the
  //    whole company work the blitz at once. The no-AI desks did real work above
  //    (their lines carry live counts); the rest are on task and the Mac AI
  //    shift (blitz.md) carries them out. One batched write lights them all up.
  const okt = fired.find(x => x.fn === 'discover-companies-house');

  // Specific, current-task lines for the revenue desks (with live counts).
  const SPECIFIC = {
    'Companies House Watcher': ['Scanning Companies House for brand-new UK trade companies', okt && okt.status === 200 ? 'fresh prospects pulled' : 'scan triggered'],
    'Website Checker': [scavenged ? ('Scavenged ' + scavenged + ' businesses with bad or no websites') : 'Hunting businesses with weak websites across the UK', 'full web sweep, not just Companies House'],
    'Contact Finder': [enriched ? ('Found ' + enriched + ' new email contacts') : 'Digging out contact details', 'published + MX-verified'],
    'Writer': [drafted ? ('Drafted ' + drafted + ' personalised emails into the queue') : 'Drafting personalised first emails', 'hottest first'],
    'Preview Builder': ['Building cinematic one-page previews for the top prospects', 'I already built you this'],
    'Lead Reactivation Specialist': ['Mining the CRM for warm leads to win back today', ''],
    'Sales Closer': ['On the inbox for every hot reply', 'answering within minutes'],
    'Reply Triage Specialist': ['Reading every inbound reply and routing the hot ones', 'interested / objection / stop'],
    'Proposal Writer': ['Turning interested replies into proposals', '499 pounds once, preview in 24h'],
    'Payment Chaser': ['Chasing any unpaid invoices, gently and on schedule', ''],
    'Invoice Drafter': ['Prepping invoices for anyone who says yes', ''],
    'Fact Checker': ['Checking every drafted message against the facts and the voice', ''],
    'CEO Agent': ['BLITZ ordered: all hands, one goal, a sale today', 'sprint running on the Mac'],
  };
  // Department-level task for every other desk, so all 94 read as on the blitz.
  const DEPT_TASK = {
    'Executive': 'Steering the blitz and clearing blockers',
    'Chief of Staff': 'Coordinating every desk on the sprint',
    'Business Development': 'Hunting and qualifying fresh prospects',
    'Customer Service': 'Watching the inbox so nothing waits',
    'Design Studio': 'Polishing previews and page design',
    'Client Success': 'Looking after live clients and chasing reviews',
    'Growth & Conversion': 'Working the funnel and every hot lead',
    'Analytics & Data': 'Reading live numbers for the next move',
    'Marketing': 'Pushing the brand and content out',
    'Creative Production': 'Producing fresh creative in the brand style',
    'Search': 'Pushing winnable pages up the rankings',
    'Operations & Finance': 'Keeping the pipeline and sends flowing',
    'Finance': 'Tracking revenue against the plan',
    'Quality & Risk': 'Checking work against the facts and the voice',
    'Partnerships & Referrals': 'Chasing referral and partner leads',
    'Legal & Admin': 'Keeping every send compliant',
    'Resilience': 'Watching the systems stay up',
    'Technical': 'Keeping the site fast and live',
  };
  const entries = [];
  for (const [dept, roles] of ORG) {
    for (const role of roles) {
      const sp = SPECIFIC[role];
      entries.push({ role, dept, action: sp ? sp[0] : (DEPT_TASK[dept] || ('On the blitz with ' + dept)), detail: sp ? sp[1] : '' });
    }
  }
  await logBatch(entries);

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
