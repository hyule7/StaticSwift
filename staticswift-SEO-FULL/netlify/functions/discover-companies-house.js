/*
 * discover-companies-house.js  (scheduled — daily 07:00 UTC)
 * ---------------------------------------------------------------
 * Fetches newly-incorporated UK trade companies from the Companies House
 * Public Data API and seeds them straight into db.cronProspects with
 * source='companies-house' and score=0. Brand-new companies don't have
 * websites yet — they're the ideal cold-outreach pool.
 *
 * Pipeline:
 *   1. Pull incorporations from the last LOOKBACK_DAYS, filtered by UK
 *      trade SIC codes (see SIC_CODES below).
 *   2. De-dupe against existing db.cronProspects by company number.
 *   3. Append new prospects with status='new', source='companies-house'.
 *   4. daily-followup will then queue cold-1 drafts the next 06:30 UTC.
 *
 * Schedule in netlify.toml:
 *   [functions."discover-companies-house"]
 *     schedule = "0 7 * * *"
 *
 * Manual trigger:
 *   POST /.netlify/functions/discover-companies-house
 *     header: x-admin-password: <ADMIN_PASSWORD>
 *     body:   { "dryRun": true }   // logs only, doesn't write
 *     body:   { "lookbackDays": 14 }
 *
 * ─────────────────────────────────────────────────────────────────
 *  ‼  EDIT THE API KEY BELOW ONCE.  ‼
 * Get a free key at https://developer.company-information.service.gov.uk/
 * (register → "Application" → "Live application" → copy the key)
 * ─────────────────────────────────────────────────────────────────
 */

const COMPANIES_HOUSE_API_KEY = 'PASTE_YOUR_FREE_API_KEY_HERE';

// UK trade SIC codes we want. Curated for StaticSwift's actual buyer profile:
// trades & local services. Companies House supports multi-code filtering.
const SIC_CODES = [
  '41100', // Development of building projects
  '41202', // Construction of domestic buildings
  '43210', // Electrical installation
  '43220', // Plumbing, heat & air-con installation
  '43310', // Plastering
  '43320', // Joinery installation
  '43330', // Floor & wall covering
  '43341', // Painting
  '43342', // Glazing
  '43390', // Other completion
  '43990', // Other specialised construction
  '45200', // Maintenance & repair of motor vehicles
  '47710', // Retail clothing
  '56102', // Unlicensed restaurants & cafes
  '56103', // Take away food shops
  '56210', // Event catering
  '56302', // Public houses & bars
  '74201', // Portrait photographic activities
  '74202', // Other specialist photography
  '81210', // General cleaning of buildings
  '81221', // Window cleaning services
  '81222', // Specialised cleaning services
  '81299', // Other cleaning services
  '85590', // Other education n.e.c. (driving instructors etc.)
  '93130', // Fitness facilities
  '96021', // Hairdressing & barbering
  '96022', // Beauty treatment
  '96040', // Physical well-being activities
  '96090', // Other personal service activities
];

const LOOKBACK_DAYS_DEFAULT = 7;
const MAX_PAGES = 5;       // each page = 100 results, so up to 500/run
const PAGE_SIZE = 100;
const REQUEST_TIMEOUT_MS = 12_000;

const { readDB, writeDB } = require('./_db');

function ymd(d){ return d.toISOString().split('T')[0]; }

async function fetchPage(fromDate, startIndex){
  const url = new URL('https://api.company-information.service.gov.uk/advanced-search/companies');
  url.searchParams.set('incorporated_from', fromDate);
  url.searchParams.set('company_status', 'active');
  url.searchParams.set('size', String(PAGE_SIZE));
  url.searchParams.set('start_index', String(startIndex));
  SIC_CODES.forEach(c => url.searchParams.append('sic_codes', c));

  const auth = Buffer.from(COMPANIES_HOUSE_API_KEY + ':').toString('base64');
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const r = await fetch(url.toString(), {
      headers: { 'Authorization': 'Basic ' + auth, 'Accept': 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(t);
    if (r.status === 401) throw new Error('Companies House API key rejected — check the constant at the top of discover-companies-house.js');
    if (r.status === 429) throw new Error('Companies House rate-limited (429) — back off and retry');
    if (!r.ok) throw new Error('Companies House HTTP ' + r.status);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

function normaliseAddress(addr){
  if (!addr) return '';
  return [addr.premises, addr.address_line_1, addr.locality, addr.region, addr.postal_code]
    .filter(Boolean).join(', ');
}

function pickTown(addr){
  if (!addr) return '';
  return addr.locality || addr.region || '';
}

async function run(opts){
  if (!COMPANIES_HOUSE_API_KEY || COMPANIES_HOUSE_API_KEY === 'PASTE_YOUR_FREE_API_KEY_HERE'){
    return { ok:false, error:'Companies House API key not set — edit COMPANIES_HOUSE_API_KEY at the top of discover-companies-house.js' };
  }

  const lookbackDays = Math.max(1, Math.min(30, opts.lookbackDays || LOOKBACK_DAYS_DEFAULT));
  const from = new Date(Date.now() - lookbackDays * 86400000);
  const fromDate = ymd(from);

  let allHits = [];
  let totalReported = 0;
  for (let page = 0; page < MAX_PAGES; page++){
    const startIndex = page * PAGE_SIZE;
    let data;
    try {
      data = await fetchPage(fromDate, startIndex);
    } catch (err) {
      return { ok:false, error: err.message, partial: allHits.length };
    }
    if (page === 0) totalReported = data.hits || 0;
    const items = Array.isArray(data.items) ? data.items : [];
    allHits = allHits.concat(items);
    if (items.length < PAGE_SIZE) break;        // last page
    if (allHits.length >= totalReported) break; // we have them all
  }

  // Normalise into the shape that lives in db.cronProspects so daily-followup
  // can treat them identically to scan-discovered prospects.
  const normalised = allHits.map(item => {
    const addr = item.registered_office_address || {};
    return {
      // identity
      host:           (item.company_name || '').toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60),
      companyName:    item.company_name || '',
      companyNumber:  item.company_number || '',
      sicCode:        (item.sic_codes && item.sic_codes[0]) || null,

      // location
      town:           pickTown(addr),
      postcode:       addr.postal_code || '',
      address:        normaliseAddress(addr),

      // outreach state
      url:            '',                          // no website yet — the whole point
      email:          null,                        // not exposed by CH; daily-followup will look it up
      phone:          null,
      score:          0,                           // fresh incorporation, no site = perfect target
      issues:         ['no-website', 'newly-incorporated'],
      status:         'new',
      source:         'companies-house',
      discoveredAt:   new Date().toISOString(),
      incorporatedOn: item.date_of_creation || null,
    };
  });

  if (opts.dryRun){
    return { ok:true, dryRun:true, fetched: allHits.length, normalised: normalised.length, sample: normalised.slice(0, 3) };
  }

  // Merge into db.cronProspects, de-duping by companyNumber.
  const db = await readDB(true);
  if (!Array.isArray(db.cronProspects)) db.cronProspects = [];
  const existing = new Set(db.cronProspects.map(p => p.companyNumber).filter(Boolean));
  const fresh = normalised.filter(p => p.companyNumber && !existing.has(p.companyNumber));

  for (const p of fresh){
    db.cronProspects.unshift(p);
  }
  // Cap the prospect list to avoid unbounded growth; keep newest 2000.
  if (db.cronProspects.length > 2000){
    db.cronProspects = db.cronProspects.slice(0, 2000);
  }
  db.lastCompaniesHouseRun = new Date().toISOString();
  await writeDB(db);

  return {
    ok: true,
    fromDate,
    fetched: allHits.length,
    added: fresh.length,
    duplicates: normalised.length - fresh.length,
    totalProspects: db.cronProspects.length,
  };
}

exports.handler = async (event) => {
  const isManual = event && event.httpMethod === 'POST';
  let opts = { dryRun:false, lookbackDays:LOOKBACK_DAYS_DEFAULT };

  if (isManual){
    const auth = (event.headers && (event.headers['x-admin-password'] || event.headers['X-Admin-Password'])) || '';
    const want = process.env.ADMIN_PASSWORD || 'Harry2001!';
    if (auth !== want) return { statusCode:401, body:JSON.stringify({ error:'Unauthorized' }) };
    try {
      const body = event.body ? JSON.parse(event.body) : {};
      if (body.dryRun)        opts.dryRun = true;
      if (body.lookbackDays)  opts.lookbackDays = parseInt(body.lookbackDays, 10) || LOOKBACK_DAYS_DEFAULT;
    } catch(_){}
  }

  try {
    const result = await run(opts);
    console.log('[discover-companies-house]', JSON.stringify(result));
    return { statusCode: result.ok ? 200 : 500, headers: { 'Content-Type':'application/json' }, body: JSON.stringify(result) };
  } catch (err) {
    console.error('[discover-companies-house] fatal:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
