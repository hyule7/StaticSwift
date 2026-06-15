/*
 * contact-enrich.js — the Contact Finder. The multiplier that turns scavenged
 * businesses into emailable prospects, the way a real BD floor does it:
 *   1. Visit the business website (from the scan queue).
 *   2. Extract a published email (mailto: links + on-page text). Best quality.
 *   3. If none, derive the standard role address (info@domain) and verify the
 *      domain actually accepts mail (MX records exist). Marked as derived so
 *      the writer/dispatcher treat it carefully; bounce hard-stop protects us.
 *   4. Write the prospect (with email + trade + town + provenance) into
 *      cronProspects so blitz-push emails them.
 *
 * Public-data only, provenance recorded. Capped per run to stay in the time
 * budget; runs every blitz and every shift so the pool keeps filling.
 */
const { readDB, writeDB } = require('./_db');
const dns = require('dns').promises;

const PER_RUN = 14;
const ROLE_PREFS = ['info', 'hello', 'enquiries', 'enquiry', 'contact', 'admin', 'office', 'sales'];
const JUNK = /(example|sentry|wixpress|\.png|\.jpg|\.gif|\.webp|@2x|noreply|no-reply|donotreply|@sentry|@example)/i;
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

async function fetchText(url, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal, redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 StaticSwiftBot' } });
    if (!r.ok) return '';
    return (await r.text()).slice(0, 400000);
  } catch { return ''; } finally { clearTimeout(t); }
}

function pickEmail(emails, host) {
  const clean = [...new Set(emails.map(e => e.toLowerCase().trim()))].filter(e => !JUNK.test(e));
  if (!clean.length) return null;
  // Prefer an address on the business's own domain.
  const onDomain = clean.filter(e => host && e.endsWith('@' + host.replace(/^www\./, '')));
  const pool = onDomain.length ? onDomain : clean;
  pool.sort((a, b) => {
    const ra = ROLE_PREFS.indexOf(a.split('@')[0]); const rb = ROLE_PREFS.indexOf(b.split('@')[0]);
    return (ra === -1 ? 99 : ra) - (rb === -1 ? 99 : rb);
  });
  return pool[0];
}

async function hasMx(domain) {
  try { const mx = await dns.resolveMx(domain); return Array.isArray(mx) && mx.length > 0; } catch { return false; }
}

exports.handler = async (event) => {
  const auth = event.headers['x-admin-password'];
  const agent = event.headers['x-agent-token'];
  if (!((process.env.ADMIN_PASSWORD && auth === process.env.ADMIN_PASSWORD) || (process.env.AGENT_TOKEN && agent === process.env.AGENT_TOKEN))) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  let db; try { db = await readDB(); } catch (e) { return { statusCode: 200, body: JSON.stringify({ ok: false, reason: e.message }) }; }
  if (!Array.isArray(db.scanQueue)) db.scanQueue = [];
  if (!Array.isArray(db.cronProspects)) db.cronProspects = [];

  // Targets: scanned websites we have not enriched yet.
  const targets = db.scanQueue.filter(x => x && x.url && !x.enriched).slice(0, PER_RUN);
  if (!targets.length) return { statusCode: 200, body: JSON.stringify({ ok: true, enriched: 0, note: 'No new websites to enrich. Run the scavenger first.' }) };

  const existingEmails = new Set(db.cronProspects.map(p => (p.email || '').toLowerCase()).filter(Boolean));
  let found = 0, derived = 0, none = 0;

  for (const t of targets) {
    t.enriched = true; t.enrichedAt = new Date().toISOString();
    let host = ''; try { host = new URL(t.url).hostname; } catch {}
    const domain = host.replace(/^www\./, '');
    const meta = t.meta || {};
    // 1) on-site published email
    const html = await fetchText(t.url, 4500);
    let email = null, provenance = '';
    if (html) {
      const mailtos = [...html.matchAll(/mailto:([^"'?>\s]+)/gi)].map(m => m[1]);
      const inText = html.match(EMAIL_RE) || [];
      email = pickEmail([...mailtos, ...inText], host);
      if (email) provenance = 'published on website';
    }
    // 2) derive + MX-verify the standard role address
    if (!email && domain && await hasMx(domain)) {
      email = 'info@' + domain; provenance = 'derived (info@), domain accepts mail';
      derived++;
    }
    if (!email) { none++; continue; }
    if (existingEmails.has(email.toLowerCase())) continue;
    existingEmails.add(email.toLowerCase());
    found++;
    db.cronProspects.unshift({
      id: 'enr-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      bizname: meta.name || domain,
      email,
      phone: meta.phone || '',
      website: t.url,
      location: meta.area || meta.addr || '',
      type: meta.niche || '',
      siteScore: t.score || null,
      status: 'new',
      addedAt: new Date().toISOString(),
      source: 'contact-enrich',
      emailProvenance: provenance,
      notes: 'Contact found via ' + provenance + '. Has a website (likely weak) so pitch the upgrade.',
    });
  }

  if (db.cronProspects.length > 10000) db.cronProspects = db.cronProspects.slice(0, 10000);
  await writeDB(db);
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, processed: targets.length, found, derived, none, note: found + ' new emailable prospects found (' + derived + ' derived + MX-verified). They are in the pool for the next push.' }),
  };
};
