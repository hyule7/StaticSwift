/*
 * cron-scan.js  (scheduled)
 * ---------------------------------------------------------------
 * Runs every 15 minutes. Pulls URLs from the persistent scan queue
 * in JSONBin, analyzes them (5 at a time), and auto-adds prospects
 * that score <70 and have a public email or phone.
 *
 * Server-side scanner — runs even when admin tab is closed.
 *
 * Schedule is set in netlify.toml (see [[plugins]] / scheduled).
 * Each invocation processes up to BATCH_SIZE URLs from the queue.
 */

const { readDB, writeDB } = require('./_db');

const BATCH_SIZE = 8;
const TIMEOUT_MS = 11_000;

async function analyzeOne(url) {
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  let parsed;
  try { parsed = new URL(url); } catch { return { ok: false, url, error: 'Invalid URL' }; }
  const start = Date.now();
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(url, {
      redirect: 'follow', signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (StaticSwift Cron Scanner; +https://staticswift.co.uk)' },
    });
    clearTimeout(t);
    const html = await res.text();
    const responseMs = Date.now() - start;
    return scoreHtml(html, parsed, responseMs);
  } catch (err) {
    return { ok: false, url: parsed.toString(), host: parsed.hostname, score: 5, issues: [err.name === 'AbortError' ? 'Timeout' : err.message] };
  }
}

function scoreHtml(html, parsed, responseMs) {
  const m = (re) => { const r = html.match(re); return r ? r[1].trim() : ''; };
  const title = m(/<title[^>]*>([^<]*)<\/title>/i);
  const description = m(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
  const h1 = m(/<h1[^>]*>([\s\S]*?)<\/h1>/i).replace(/<[^>]+>/g, '').trim();
  const hasViewport = /<meta\s+[^>]*name=["']viewport["']/i.test(html);
  const isSSL = parsed.protocol === 'https:';
  const visibleText = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const emails = Array.from(new Set((visibleText.match(/[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [])
    .map(e => e.toLowerCase()).filter(e => !/example\.|sentry|googleapis|wixpress|w3\.org|gstatic|jsdelivr/.test(e) && e.length < 80))).slice(0, 4);
  const phones = Array.from(new Set((visibleText.match(/(?:\+?44\s?7\d{3}|07\d{3}|\+?44\s?\(?0?\d{2,4}\)?|0\d{2,4})[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g) || [])
    .map(p => p.replace(/[\s.-]+/g, ' ').trim()).filter(p => p.replace(/\D/g, '').length >= 9))).slice(0, 3);
  const platform =
    /wix-bolt|wixstatic|_wix/i.test(html) ? 'Wix' :
    /squarespace\.com|sqsp/i.test(html) ? 'Squarespace' :
    /cdn\.shopify\.com/i.test(html) ? 'Shopify' :
    /wp-content|wp-includes/i.test(html) ? 'WordPress' :
    /godaddy/i.test(html) ? 'GoDaddy Builder' : 'Custom';
  const issues = [];
  let score = 50;
  if (!isSSL) { score -= 12; issues.push('No HTTPS'); }
  if (!hasViewport) { score -= 12; issues.push('No mobile viewport'); }
  if (responseMs > 4000) { score -= 10; issues.push('Slow load ' + responseMs + 'ms'); }
  if (platform === 'Wix') { score -= 6; issues.push('Wix template'); }
  if (platform === 'GoDaddy Builder') { score -= 8; issues.push('GoDaddy outdated builder'); }
  if (!description) { score -= 4; issues.push('No meta description'); }
  if (!h1) { score -= 3; issues.push('No H1'); }
  return { ok: true, url: parsed.toString(), host: parsed.hostname, title, platform, emails, phones, score: Math.max(0, Math.min(100, score)), issues, responseMs };
}

const handler = async (event) => {
  try {
    const db = await readDB();
    if (!Array.isArray(db.scanQueue) || db.scanQueue.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, scanned: 0, prospectsAdded: 0, note: 'Queue empty' }) };
    }
    const batch = db.scanQueue.splice(0, BATCH_SIZE);
    if (!Array.isArray(db.scanLog)) db.scanLog = [];
    if (!Array.isArray(db.cronProspects)) db.cronProspects = [];
    const results = await Promise.all(batch.map(item => analyzeOne(item.url || item)));
    let added = 0;
    for (const d of results) {
      if (!d.ok) continue;
      if (d.score < 70 && ((d.emails && d.emails[0]) || (d.phones && d.phones[0]))) {
        const existing = db.cronProspects.find(p => p.host === d.host);
        if (existing) continue;
        db.cronProspects.unshift({
          id: 'cron-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          bizname: (d.title || d.host || '').split(/[|·–-]/)[0].trim().slice(0, 80) || d.host,
          email: (d.emails || [])[0] || '',
          phone: (d.phones || [])[0] || '',
          website: d.url,
          host: d.host,
          siteScore: d.score,
          sitePlatform: d.platform,
          siteIssues: d.issues || [],
          status: 'new',
          addedAt: new Date().toISOString(),
          source: 'cron-scanner',
        });
        added++;
      }
    }
    db.scanLog.unshift({ ranAt: new Date().toISOString(), scanned: results.length, added });
    if (db.scanLog.length > 100) db.scanLog.length = 100;
    // ss:outreach-dashboard — surfaced by get-outreach-status.js + admin/outreach.html
    db.lastCronScan = new Date().toISOString();
    await writeDB(db);
    return { statusCode: 200, body: JSON.stringify({ ok: true, scanned: results.length, prospectsAdded: added, queueRemaining: db.scanQueue.length }) };
  } catch (err) {
    console.error('[cron-scan]', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

exports.handler = handler;
// Netlify scheduled function (v2 syntax — schedule string in netlify.toml as fallback)
exports.config = { schedule: '*/15 * * * *' };
