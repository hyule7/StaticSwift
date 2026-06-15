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

// High-intent trades (distress/compliance/visual) x big UK demand centres.
const TRADES = ['plumber', 'electrician', 'builder', 'mechanic', 'locksmith', 'gardener', 'beauty-salon', 'dog-groomer'];
const TOWNS = ['Manchester', 'Leeds', 'Birmingham', 'Bristol', 'Liverpool', 'Sheffield', 'Nottingham', 'Leicester', 'Glasgow', 'Cardiff', 'Newcastle', 'Sunderland'];

exports.handler = async (event) => {
  const auth = event.headers['x-admin-password'];
  const agent = event.headers['x-agent-token'];
  const ok = (process.env.ADMIN_PASSWORD && auth === process.env.ADMIN_PASSWORD) || (process.env.AGENT_TOKEN && agent === process.env.AGENT_TOKEN);
  if (!ok) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  if (!process.env.ADMIN_PASSWORD) return { statusCode: 200, body: JSON.stringify({ ok: false, reason: 'ADMIN_PASSWORD needed to call discovery' }) };

  // Rotate combos by hour so each blitz hunts fresh ground.
  const h = new Date().getUTCHours();
  const combos = [];
  for (let i = 0; i < 4; i++) {
    const trade = TRADES[(h + i) % TRADES.length];
    const town = TOWNS[(h * 3 + i * 5) % TOWNS.length];
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
