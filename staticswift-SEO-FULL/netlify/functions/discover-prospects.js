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
  // Strategy: use a bounding-box-by-area lookup that's tolerant of name variants.
  // OSM stores area names under different keys for cities vs regions; we try a
  // broader filter that accepts city/town/admin_level matches.
  const filters = tags.map(([k, v]) => `nwr["${k}"="${v}"]["website"](area.search);`).join('\n  ');
  const safeName = areaName.replace(/["\\]/g, '');
  return `
[out:json][timeout:25];
(
  area["name"="${safeName}"]["boundary"="administrative"];
  area["name"="${safeName}"]["place"~"city|town|village|suburb"];
  area["name:en"="${safeName}"]["boundary"="administrative"];
)->.search;
(
  ${filters}
);
out tags 200;
`.trim();
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const auth = event.headers['x-admin-password'];
  const validPw = process.env.ADMIN_PASSWORD || 'Harry2001!';
  if (auth !== validPw) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

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
    // Extract websites + dedupe
    const seen = new Set();
    const businesses = [];
    for (const el of elements) {
      const t = el.tags || {};
      let website = t.website || t['contact:website'] || t.url;
      if (!website) continue;
      if (!/^https?:\/\//i.test(website)) website = 'https://' + website;
      try {
        const u = new URL(website);
        const host = u.hostname.replace(/^www\./, '');
        if (seen.has(host)) continue;
        seen.add(host);
        businesses.push({
          name: t.name || t['name:en'] || '',
          website: u.toString(),
          host,
          phone: t.phone || t['contact:phone'] || '',
          email: t.email || t['contact:email'] || '',
          addr: [t['addr:street'], t['addr:city']].filter(Boolean).join(', '),
        });
      } catch { /* invalid URL — skip */ }
    }

    // Push the URLs into the persistent scan queue
    const db = await readDB();
    if (!Array.isArray(db.scanQueue)) db.scanQueue = [];
    const existingUrls = new Set(db.scanQueue.map(x => x.url || x));
    let added = 0;
    for (const b of businesses) {
      if (existingUrls.has(b.website)) continue;
      db.scanQueue.push({
        url: b.website,
        addedAt: Date.now(),
        source: 'osm',
        meta: { name: b.name, phone: b.phone, email: b.email, addr: b.addr, niche, area, country },
      });
      added++;
    }
    // Cap at 5000 to keep JSONBin small
    if (db.scanQueue.length > 5000) db.scanQueue = db.scanQueue.slice(-5000);
    await writeDB(db);

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        found: businesses.length,
        addedToQueue: added,
        queueSize: db.scanQueue.length,
        sample: businesses.slice(0, 8),
        note: 'URLs added to scan queue. Cron-scan will process them every 15 min, or start the manual scanner.',
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message, hint: 'Overpass API may be busy — retry in a minute. Or try a smaller area.' }) };
  }
};
