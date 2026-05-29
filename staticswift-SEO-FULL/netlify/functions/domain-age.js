/*
 * domain-age.js
 * ---------------------------------------------------------------
 * Returns domain registration date and age in years using RDAP
 * (the modern WHOIS replacement). Free, no API key.
 *
 * Older domains = established business = bigger budget = better lead.
 * A site that hasn't been redesigned in 8 years + scores 30/100 is
 * the perfect outreach target.
 */

const RDAP_BOOTSTRAP = {
  'uk':  'https://rdap.nominet.uk/uk/domain/',
  'co.uk': 'https://rdap.nominet.uk/uk/domain/',
  'com': 'https://rdap.verisign.com/com/v1/domain/',
  'net': 'https://rdap.verisign.com/net/v1/domain/',
  'org': 'https://rdap.publicinterestregistry.org/rdap/domain/',
  'io':  'https://rdap.nic.io/domain/',
  'us':  'https://rdap.publicinterestregistry.net/rdap/domain/',
  'ca':  'https://rdap.cira.ca/cira/rdap/domain/',
  'au':  'https://rdap.auda.org.au/rdap/domain/',
  'nz':  'https://rdap.dns.nz/rdap/domain/',
  'ie':  'https://rdap.weare.ie/rdap/domain/',
};

function rdapUrlFor(host) {
  const lower = host.toLowerCase();
  // Try most specific suffix first
  for (const suffix of Object.keys(RDAP_BOOTSTRAP).sort((a,b) => b.length - a.length)) {
    if (lower.endsWith('.' + suffix)) {
      const base = RDAP_BOOTSTRAP[suffix];
      // Most TLDs want the second-level + suffix, e.g. "example.co.uk"
      const parts = lower.split('.');
      const tldParts = suffix.split('.').length;
      const domain = parts.slice(-tldParts - 1).join('.');
      return base + domain;
    }
  }
  // Fallback to the IANA RDAP lookup
  return 'https://rdap.org/domain/' + lower;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const auth = event.headers['x-admin-password'];
  const validPw = process.env.ADMIN_PASSWORD || 'Harry2001!';
  if (auth !== validPw) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

  let domain;
  try { ({ domain } = JSON.parse(event.body || '{}')); } catch {}
  domain = (domain || '').replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/^www\./i, '').toLowerCase().trim();
  if (!domain) return { statusCode: 400, body: JSON.stringify({ error: 'domain required' }) };

  try {
    const url = rdapUrlFor(domain);
    const r = await fetch(url, {
      headers: { 'Accept': 'application/rdap+json' },
      // Some RDAP servers can be slow
      signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined,
    });
    if (!r.ok) {
      return { statusCode: 200, body: JSON.stringify({ ok: false, error: 'RDAP ' + r.status, domain }) };
    }
    const data = await r.json();
    // RDAP events shape: events: [{eventAction: "registration", eventDate: "ISO date"}, ...]
    const events = data.events || [];
    const reg = events.find(e => e.eventAction === 'registration');
    const exp = events.find(e => e.eventAction === 'expiration');
    const upd = events.find(e => e.eventAction === 'last changed' || e.eventAction === 'last update of RDAP database');
    if (!reg) {
      return { statusCode: 200, body: JSON.stringify({ ok: false, error: 'No registration date in RDAP response', domain }) };
    }
    const regDate = new Date(reg.eventDate);
    const ageYears = (Date.now() - regDate.getTime()) / (365.25 * 86400000);
    const ageBand =
      ageYears < 1 ? 'brand-new'    :
      ageYears < 3 ? 'young'        :
      ageYears < 8 ? 'established'  :
      ageYears < 15 ? 'mature'      :
                     'legacy';
    const verdict =
      ageYears < 1 ? 'Brand new domain — likely a new biz; outreach risk depends on whether site exists.' :
      ageYears < 3 ? 'Young business (1-3y) — usually growing, often receptive to new sites.' :
      ageYears < 8 ? '★ Established (3-8y) — established cashflow, ideal pitch target if site is outdated.' :
      ageYears < 15 ? '★★ Mature (8-15y) — solid budget, often stuck with a 2010s site. Best target.' :
                     '★★★ Legacy (15+y) — long-standing local business, biggest opportunity if site is poor.';

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        domain,
        registered: reg.eventDate,
        ageYears: Math.round(ageYears * 10) / 10,
        ageBand,
        expires: exp?.eventDate || null,
        lastUpdated: upd?.eventDate || null,
        registrar: (data.entities || []).find(e => (e.roles || []).includes('registrar'))?.vcardArray?.[1]?.find(v => v[0] === 'fn')?.[3] || null,
        verdict,
      }),
    };
  } catch (err) {
    return { statusCode: 200, body: JSON.stringify({ ok: false, error: err.message, domain }) };
  }
};
