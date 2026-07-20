/*
 * discover-prospects.js
 * ---------------------------------------------------------------
 * Auto-pulls businesses (with websites) by trade + location using
 * the OpenStreetMap Overpass API — completely free, no API key,
 * no ToS issues. OSM has community-contributed business data
 * with the "website" tag attached to most listings.
 *
 * Each discovered business is added to the scan queue → the cron
 * scanner picks them up → those that score <70 with public
 * contacts become prospects automatically.
 *
 * Usage:
 *   POST { niche: "barber", area: "Edinburgh", country: "UK" }
 *   → returns count of URLs found + adds them to db.scanQueue
 */

const { readDB, writeDB } = require('./_db');

// ── Buying-signal engine ────────────────────────────────────────────────────
// The point: stop drafting random companies and rank prospects by how READY-TO-
// BUY they are. A small independent local with no website but an email on file
// is a perfect £499 target; a national chain is a waste. We score each on the
// signals OSM actually exposes, filter out chains/big orgs, and rank hottest
// first so the workforce works the best leads before the rest.

// Chains / franchises / big orgs — never a £499 hand-coded-site buyer. Skipped.
const CHAINS = /\b(greggs|costa|starbucks|mcdonald|kfc|subway|domino|papa john|pizza hut|nando|wetherspoon|premier inn|travelodge|tesco|sainsbury|asda|morrison|aldi|lidl|co-?op|iceland|boots|superdrug|specsavers|vision express|screwfix|toolstation|b&q|wickes|halfords|kwik fit|national tyres|autoglass|hays travel|timpson|card factory|poundland|home bargains|wh smith|greene king|marston|pret|caffe nero|toni ?& ?guy|regis|snap fitness|puregym|the gym group|anytime fitness|jd gym|david lloyd)\b/i;

function scoreProspect(b) {
  // b: { name, phone, email, addr, hasWebsite, facebook, brand, startDate }
  const signals = [];
  let heat = 0;
  if (!b.hasWebsite) { heat += 45; signals.push('No website at all'); }
  if (b.email) { heat += 30; signals.push('Email on file (ready for a cold pitch today)'); }
  if (b.phone) { heat += 12; signals.push('Phone listed'); }
  if (b.facebook && !b.hasWebsite) { heat += 15; signals.push('Facebook page but no website'); }
  if (b.startDate) {
    const yrs = (Date.now() - Date.parse(b.startDate + '-01-01')) / 3.15576e10;
    if (yrs >= 0 && yrs <= 2) { heat += 15; signals.push('Recently opened (' + b.startDate + ')'); }
  }
  if (!b.brand) { heat += 6; signals.push('Independent local'); }
  return { heat: Math.max(0, Math.min(100, heat)), signals };
}

// OSM tag mapping — each "niche" → array of OSM tag/value pairs to OR together
const NICHE_TAGS = {
  barber:           [['shop','hairdresser'], ['shop','barber'], ['amenity','beauty_salon']],
  plumber:          [['craft','plumber'], ['shop','plumbing'], ['office','plumber']],
  electrician:      [['craft','electrician'], ['office','electrician']],
  photographer:     [['craft','photographer'], ['shop','photo'], ['shop','photographer']],
  restaurant:       [['amenity','restaurant']],
  cafe:             [['amenity','cafe']],
  'personal-trainer': [['leisure','fitness_centre'], ['leisure','sports_centre'], ['amenity','gym']],
  'beauty-salon':   [['shop','beauty'], ['amenity','beauty_salon']],
  'dog-groomer':    [['shop','pet_grooming'], ['shop','pet']],
  florist:          [['shop','florist']],
  mechanic:         [['shop','car_repair'], ['craft','mechanic']],
  optician:         [['shop','optician']],
  vet:              [['amenity','veterinary']],
  dentist:          [['amenity','dentist']],
  solicitor:        [['office','lawyer']],
  accountant:       [['office','accountant'], ['office','tax_advisor']],
  gardener:         [['craft','gardener'], ['shop','garden_centre']],
  locksmith:        [['shop','locksmith'], ['craft','locksmith']],
  builder:          [['craft','builder'], ['craft','carpenter']],
  cleaner:          [['shop','cleaning'], ['office','cleaning']],
  roofer:           [['craft','roofer']],
  plasterer:        [['craft','plasterer']],
  carpenter:        [['craft','carpenter'], ['craft','joiner']],
  tiler:            [['craft','tiler']],
  painter:          [['craft','painter'], ['shop','paint']],
  landscaper:       [['craft','gardener'], ['shop','garden_centre']],
  'heating-engineer': [['craft','plumber'], ['craft','hvac']],
  'gas-engineer':   [['craft','plumber'], ['craft','hvac']],
};

// Country code → OSM area name (for nominatim lookup)
const COUNTRY_CODES = {
  UK: 'United Kingdom', GB: 'United Kingdom',
  US: 'United States', CA: 'Canada', AU: 'Australia',
  NZ: 'New Zealand', IE: 'Ireland', ZA: 'South Africa',
};

// Multiple Overpass mirrors — failover on 406/429/500
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
];

async function overpassFetch(query) {
  let lastErr;
  for (const url of OVERPASS_MIRRORS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': 'StaticSwift Prospect Discovery (+https://staticswift.co.uk)',
        },
        body: 'data=' + encodeURIComponent(query),
      });
      if (res.status === 406 || res.status === 429 || res.status >= 500) {
        lastErr = new Error('Overpass ' + res.status + ' at ' + url);
        continue;
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error('Overpass ' + res.status + ': ' + text.slice(0, 200));
      }
      return await res.json();
    } catch (err) {
      lastErr = err;
      continue;
    }
  }
  throw lastErr || new Error('All Overpass mirrors failed');
}

function buildOverpassQuery(tags, areaName, country) {
  // Pull ALL matching businesses, not just those with a `website` tag —
  // most real shops/services don't bother adding their URL to OSM, but they
  // ARE on OSM (you'll get phone, address, website-if-present). Then we
  // filter in JS: keep entries with EITHER website OR phone OR contact.
  const filters = tags.map(([k, v]) => `nwr["${k}"="${v}"](area.search);`).join('\n  ');
  const safeName = areaName.replace(/["\\]/g, '');
  return `
[out:json][timeout:30];
(
  area["name"="${safeName}"]["boundary"="administrative"];
  area["name"="${safeName}"]["place"~"city|town|village|suburb|hamlet"];
  area["name:en"="${safeName}"]["boundary"="administrative"];
  area["alt_name"="${safeName}"]["boundary"="administrative"];
)->.search;
(
  ${filters}
);
out center tags 500;
`.trim();
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const auth = event.headers['x-admin-password'];
  const validPw = process.env.ADMIN_PASSWORD;
  if (!validPw || auth !== validPw) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

  let niche, area, country;
  try { ({ niche, area, country } = JSON.parse(event.body || '{}')); } catch {}
  niche = (niche || '').toLowerCase();
  area = (area || '').trim();
  country = (country || 'UK').toUpperCase();

  if (!niche || !area) {
    return { statusCode: 400, body: JSON.stringify({ error: 'niche and area required' }) };
  }
  const tags = NICHE_TAGS[niche];
  if (!tags) {
    return { statusCode: 400, body: JSON.stringify({
      error: 'Unknown niche. Supported: ' + Object.keys(NICHE_TAGS).join(', '),
    }) };
  }

  try {
    const query = buildOverpassQuery(tags, area);
    const data = await overpassFetch(query);
    const elements = data.elements || [];
    // Extract everything — websites go to scan queue, no-website businesses
    // become direct prospects (the best leads — they NEED a site).
    const seenHosts = new Set();
    const seenNoSite = new Set();
    const withWebsite = [];
    const withoutWebsite = [];
    for (const el of elements) {
      const t = el.tags || {};
      const name = t.name || t['name:en'] || '';
      if (!name) continue;
      // Buying-signal filter: skip national chains / big orgs (a brand tag or a
      // known chain name) — they never buy a £499 hand-coded site.
      if (t.brand || t['brand:wikidata'] || CHAINS.test(name)) continue;
      const phone = t.phone || t['contact:phone'] || t['contact:mobile'] || '';
      const email = t.email || t['contact:email'] || '';
      const facebook = t['contact:facebook'] || t.facebook || '';
      const startDate = (t.start_date || '').slice(0, 4).match(/^\d{4}$/) ? t.start_date.slice(0, 4) : '';
      const addr = [t['addr:housenumber'], t['addr:street'], t['addr:city']].filter(Boolean).join(' ');
      let website = t.website || t['contact:website'] || t.url || '';
      if (website && !/^https?:\/\//i.test(website)) website = 'https://' + website;
      if (website) {
        try {
          const u = new URL(website);
          const host = u.hostname.replace(/^www\./, '');
          if (seenHosts.has(host)) continue;
          seenHosts.add(host);
          withWebsite.push({ name, website: u.toString(), host, phone, email, addr });
        } catch { continue; }
      } else if (phone || email) {
        // No website — these are the HOTTEST leads. Dedupe by name + addr.
        const key = (name + '|' + addr).toLowerCase();
        if (seenNoSite.has(key)) continue;
        seenNoSite.add(key);
        withoutWebsite.push({ name, phone, email, addr, facebook, startDate });
      }
    }

    // Push the websites into the scan queue
    const db = await readDB();
    if (!Array.isArray(db.scanQueue)) db.scanQueue = [];
    if (!Array.isArray(db.cronProspects)) db.cronProspects = [];
    const existingUrls = new Set(db.scanQueue.map(x => x.url || x));
    let added = 0;
    for (const b of withWebsite) {
      if (existingUrls.has(b.website)) continue;
      db.scanQueue.push({
        url: b.website,
        addedAt: Date.now(),
        source: 'osm',
        meta: { name: b.name, phone: b.phone, email: b.email, addr: b.addr, niche, area, country },
      });
      added++;
    }
    // No-website businesses become direct prospects. Score each on buying
    // signals and add HOTTEST first so the workforce works the best leads first.
    let directProspects = 0;
    const existingHosts = new Set(db.cronProspects.map(p => (p.bizname || '') + '|' + (p.location || '')));
    const scored = withoutWebsite
      .map(b => ({ b, ...scoreProspect({ ...b, hasWebsite: false }) }))
      .sort((a, z) => z.heat - a.heat); // hottest first
    for (const { b, heat, signals } of scored) {
      const key = (b.name + '|' + (b.addr || area)).toLowerCase();
      if (existingHosts.has(key)) continue;
      db.cronProspects.unshift({
        id: 'osm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        bizname: b.name,
        email: b.email,
        phone: b.phone,
        website: '',
        location: b.addr || area,
        type: niche,
        siteScore: 0,
        sitePlatform: 'No website',
        siteIssues: signals,
        heat,
        signals,
        status: 'new',
        addedAt: new Date().toISOString(),
        source: 'osm-no-website',
        notes: 'Buying signals (' + heat + '/100): ' + signals.join(' · '),
      });
      directProspects++;
    }
    // Cap at 5000 to keep JSONBin small
    if (db.scanQueue.length > 5000) db.scanQueue = db.scanQueue.slice(-5000);
    if (db.cronProspects.length > 10000) db.cronProspects = db.cronProspects.slice(0, 10000);
    await writeDB(db);

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        found: withWebsite.length + withoutWebsite.length,
        withWebsite: withWebsite.length,
        withoutWebsite: withoutWebsite.length,
        addedToQueue: added,
        directProspects,
        queueSize: db.scanQueue.length,
        sample: [...withWebsite, ...withoutWebsite].slice(0, 8),
        note: 'URLs queued for scanning. Businesses without websites added as direct prospects (highest-value leads).',
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message, hint: 'Overpass API may be busy — retry in a minute. Or try a smaller area.' }) };
  }
};
