/*
 * blitz-scavenge.js — the cold-outreach scavenger. Runs the OSM discovery
 * engine across a rotating set of trade+town combos so the blitz pulls in real
 * local businesses with bad-or-no websites AND their published contact details,
 * straight into db.cronProspects. blitz-push then drafts cold emails to the
 * ones with an email.
 *
 * Rotates which combos it hunts each run (by hour) so over a day it sweeps the
 * map instead of hammering the same towns. Sequential with a tight per-call
 * budget so it stays inside the function time limit.
 */
const SITE = process.env.URL || 'https://staticswift.co.uk';

// Full-sweep discovery: every trade we sell to, across the whole UK map, not
// just Companies House. The OSM engine returns businesses WITH a website tag
// (so we can spot weak ones) and those WITHOUT (instant cold prospects), plus
// published contacts. Over the day the rotation walks the entire grid.
const TRADES = [
  'plumber', 'electrician', 'builder', 'roofer', 'plasterer', 'carpenter', 'tiler',
  'painter', 'landscaper', 'gardener', 'mechanic', 'locksmith', 'cleaner',
  'heating-engineer', 'gas-engineer', 'barber', 'beauty-salon', 'dog-groomer',
  'florist', 'photographer', 'restaurant', 'cafe', 'personal-trainer', 'accountant',
];
const TOWNS = [
  'Manchester', 'Leeds', 'Birmingham', 'Bristol', 'Liverpool', 'Sheffield', 'Nottingham',
  'Leicester', 'Glasgow', 'Cardiff', 'Newcastle', 'Sunderland', 'London', 'Edinburgh',
  'Coventry', 'Hull', 'Stoke-on-Trent', 'Derby', 'Wolverhampton', 'Plymouth', 'Southampton',
  'Reading', 'Bolton', 'Bradford', 'Preston', 'Middlesbrough', 'Swansea', 'Aberdeen',
];
// Combos hunted per run. Higher = a wider sweep each blitz tick (each combo is
// one Overpass query, kept inside the function time budget).
const COMBOS_PER_RUN = 10;

exports.handler = async (event) => {
  const auth = event.headers['x-admin-password'];
  const agent = event.headers['x-agent-token'];
  const ok = (process.env.ADMIN_PASSWORD && auth === process.env.ADMIN_PASSWORD) || (process.env.AGENT_TOKEN && agent === process.env.AGENT_TOKEN);
  if (!ok) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  if (!process.env.ADMIN_PASSWORD) return { statusCode: 200, body: JSON.stringify({ ok: false, reason: 'ADMIN_PASSWORD needed to call discovery' }) };

  // Rotate combos by the minute so back-to-back blitz ticks hunt fresh ground
  // and, over time, sweep the entire trade x town grid.
  const now = new Date();
  const tick = now.getUTCHours() * 60 + now.getUTCMinutes();
  const combos = [];
  const seen = new Set();
  for (let i = 0; i < COMBOS_PER_RUN; i++) {
    const trade = TRADES[(tick + i * 7) % TRADES.length];
    const town = TOWNS[(tick * 3 + i * 11) % TOWNS.length];
    const key = trade + '|' + town;
    if (seen.has(key)) continue;
    seen.add(key);
    combos.push({ niche: trade, area: town });
  }

  const results = [];
  let totalProspects = 0, withEmail = 0;
  for (const c of combos) {
    try {
      const r = await fetch(SITE + '/.netlify/functions/discover-prospects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': process.env.ADMIN_PASSWORD },
        body: JSON.stringify({ niche: c.niche, area: c.area, country: 'UK' }),
      });
      const j = await r.json().catch(() => ({}));
      // discover-prospects returns directProspects (no-website businesses added
      // to cronProspects) + addedToQueue (sites to score). Count the prospects.
      const added = (j.directProspects || 0);
      const emails = (j.sample || []).filter(s => s && s.email).length;
      totalProspects += added;
      withEmail += emails;
      results.push({ ...c, status: r.status, directProspects: added, toScan: j.addedToQueue || 0 });
    } catch (e) {
      results.push({ ...c, error: e.message });
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, hunted: combos, found: totalProspects, withEmail, results }),
  };
};
