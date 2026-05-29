/*
 * companies-house.js
 * ---------------------------------------------------------------
 * Looks up a UK business in the official Companies House register
 * to determine its legal status.
 *
 * Legal status matters for PECR compliance:
 *   - Limited companies (ltd, plc) → corporate subscribers → CAN be
 *     cold-emailed for B2B marketing without prior consent
 *   - Sole traders, partnerships, individuals → NOT corporate subscribers
 *     → cold email requires prior consent (consent under PECR Reg 22)
 *
 * Uses the official Companies House public search API which has a free
 * tier without API key for limited searches; if CH_API_KEY is provided
 * we use authenticated requests for higher quota.
 */

const CH_KEY = process.env.CH_API_KEY || '';

function authHeader() {
  if (!CH_KEY) return null;
  return 'Basic ' + Buffer.from(CH_KEY + ':').toString('base64');
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const auth = event.headers['x-admin-password'];
  const validPw = process.env.ADMIN_PASSWORD || 'Harry2001!';
  if (auth !== validPw) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

  let name;
  try { ({ name } = JSON.parse(event.body || '{}')); } catch {}
  name = (name || '').trim();
  if (!name) return { statusCode: 400, body: JSON.stringify({ error: 'name required' }) };

  try {
    const headers = { 'Accept': 'application/json' };
    const a = authHeader(); if (a) headers['Authorization'] = a;
    const url = 'https://api.company-information.service.gov.uk/search/companies?q=' + encodeURIComponent(name) + '&items_per_page=5';
    const r = await fetch(url, { headers });
    if (r.status === 401 && !CH_KEY) {
      // No key + the API now requires auth — fall back to "unknown" with guidance
      return {
        statusCode: 200,
        body: JSON.stringify({
          ok: false,
          status: 'unknown',
          verdict: 'Companies House requires an API key to search. Get a free key at developer.company-information.service.gov.uk and set CH_API_KEY env var.',
        }),
      };
    }
    if (!r.ok) {
      return { statusCode: 200, body: JSON.stringify({ ok: false, status: 'unknown', error: 'CH API ' + r.status }) };
    }
    const data = await r.json();
    const hits = (data.items || []).filter(c => c.company_status === 'active').slice(0, 5);
    if (!hits.length) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          ok: true,
          status: 'not-found',
          isLtdCompany: false,
          pecrSafe: false,
          verdict: '⚠ NOT found in Companies House — likely sole trader or partnership. Cold email requires explicit consent under PECR. Consider phone/manual outreach instead.',
        }),
      };
    }
    // Classify each match
    const matches = hits.map(c => ({
      name: c.title,
      number: c.company_number,
      type: c.company_type,
      status: c.company_status,
      incorporated: c.date_of_creation,
      address: c.address_snippet,
      isLtd: /ltd|plc|llp/i.test(c.company_type || ''),
    }));
    const bestLtd = matches.find(m => m.isLtd);
    if (bestLtd) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          ok: true,
          status: 'limited-company',
          isLtdCompany: true,
          pecrSafe: true,
          incorporated: bestLtd.incorporated,
          companyNumber: bestLtd.number,
          companyName: bestLtd.name,
          companyType: bestLtd.type,
          matches,
          verdict: '✓ Active limited company (' + (bestLtd.type || 'ltd') + ') — corporate subscriber under PECR. Cold B2B email is permitted with opt-out + sender ID.',
        }),
      };
    }
    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        status: 'other-entity',
        isLtdCompany: false,
        pecrSafe: false,
        matches,
        verdict: 'Found in CH but not a limited company (' + (matches[0]?.type || 'unknown') + '). Cold email likely requires consent.',
      }),
    };
  } catch (err) {
    return { statusCode: 200, body: JSON.stringify({ ok: false, status: 'error', error: err.message }) };
  }
};
