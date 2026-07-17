/*
 * sync-prospects.js — persist prospects found by the in-admin scanner.
 *
 * The admin's always-on scanner stored everything it found in the browser's
 * localStorage only (ss_prospects), so prospects were lost on a cache clear or
 * device switch and never entered the server pipeline. This endpoint merges the
 * admin's prospect list into db.cronProspects (the same store the funnel and
 * outreach drafting read), deduped, so nothing found is ever dropped.
 *
 * Admin-auth. POST { prospects: [...] }. Returns { ok, added, total }.
 */
const { readDB, writeDB } = require('./_db');

// Stable identity for a prospect so we never store the same business twice.
const keyOf = p => (
  (p.website || p.host || '').toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '') ||
  ((p.bizname || p.business_name || p.name || '') + '|' + (p.location || p.town || '')).toLowerCase()
).trim();

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const auth = event.headers['x-admin-password'];
  if (!process.env.ADMIN_PASSWORD || auth !== process.env.ADMIN_PASSWORD) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  let incoming;
  try { incoming = JSON.parse(event.body || '{}').prospects; } catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }
  if (!Array.isArray(incoming)) return { statusCode: 400, body: JSON.stringify({ error: 'prospects array required' }) };
  if (!incoming.length) return { statusCode: 200, body: JSON.stringify({ ok: true, added: 0, total: 0, note: 'nothing to sync' }) };

  let db;
  try { db = await readDB(); } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ ok: false, error: 'Could not read CRM: ' + err.message }) };
  }
  if (!Array.isArray(db.cronProspects)) db.cronProspects = [];

  const seen = new Set(db.cronProspects.map(keyOf).filter(Boolean));
  let added = 0;
  for (const p of incoming) {
    const k = keyOf(p);
    if (!k || seen.has(k)) continue;         // skip blanks + duplicates
    if (!(p.email || p.phone)) continue;      // unusable without a contact route
    seen.add(k);
    db.cronProspects.unshift({
      bizname: p.bizname || p.business_name || p.name || '',
      location: p.location || p.town || '',
      email: p.email || '',
      phone: p.phone || '',
      type: p.type || p.trade || 'Other',
      website: p.website || p.host || '',
      siteScore: p.siteScore ?? null,
      sitePlatform: p.sitePlatform || '',
      notes: p.notes || '',
      status: p.status || 'new',
      source: p.source || 'admin-scanner',
      addedAt: p.addedAt || new Date().toISOString(),
    });
    added++;
  }
  if (db.cronProspects.length > 10000) db.cronProspects = db.cronProspects.slice(0, 10000);

  try { await writeDB(db); } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ ok: false, error: 'Could not save to CRM: ' + err.message }) };
  }

  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, added, total: db.cronProspects.length }) };
};
