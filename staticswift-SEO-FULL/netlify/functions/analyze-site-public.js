/*
 * analyze-site-public.js
 * ---------------------------------------------------------------
 * Public lead-magnet endpoint. Same scoring engine as analyze-site,
 * but rate-limited and contact-extraction stripped (privacy).
 * Visitor pastes their own URL → gets a free score + issues list.
 * No auth, no admin features — just the audit.
 */

// Simple in-memory rate limiter — best effort against accidental abuse.
// (Each Netlify function instance is its own bucket; if it cold-starts you lose state.)
const RATE = new Map(); // ip -> { count, windowStart }
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 8;

function ipOf(event) {
  return event.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || event.headers['x-nf-client-connection-ip']
    || event.headers['client-ip']
    || 'unknown';
}

function checkRate(ip) {
  const now = Date.now();
  const r = RATE.get(ip);
  if (!r || (now - r.windowStart) > WINDOW_MS) {
    RATE.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (r.count >= MAX_PER_WINDOW) return false;
  r.count++;
  return true;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const ip = ipOf(event);
  if (!checkRate(ip)) {
    return { statusCode: 429, body: JSON.stringify({ error: 'Too many audits — try again in 10 minutes.' }) };
  }

  let url;
  try { ({ url } = JSON.parse(event.body || '{}')); } catch { return { statusCode: 400, body: JSON.stringify({ error: 'Bad JSON' }) }; }
  if (!url) return { statusCode: 400, body: JSON.stringify({ error: 'url required' }) };

  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  let parsed;
  try { parsed = new URL(url); } catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid URL' }) }; }

  const start = Date.now();
  let html, fetchError;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (StaticSwift Free Site Audit; +https://staticswift.co.uk)' },
    });
    clearTimeout(t);
    html = await res.text();
  } catch (err) {
    fetchError = err.name === 'AbortError' ? 'Site took too long to respond (timed out at 12s)' : (err.message || 'Site unreachable');
  }
  const responseMs = Date.now() - start;

  if (fetchError || !html) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        url: parsed.toString(),
        host: parsed.hostname,
        score: 10,
        issues: [fetchError || 'Site unreachable', 'A new site will fix this in 24 hours'],
        responseMs,
      }),
    };
  }

  const m = (re) => { const r = html.match(re); return r ? r[1].trim() : ''; };
  const hasViewport = /<meta\s+[^>]*name=["']viewport["']/i.test(html);
  const hasFavicon = /<link\s+[^>]*rel=["'][^"']*icon[^"']*["']/i.test(html);
  const isSSL = parsed.protocol === 'https:';
  const description = m(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
  const h1 = m(/<h1[^>]*>([\s\S]*?)<\/h1>/i).replace(/<[^>]+>/g, '').trim();
  const visibleText = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  const platform =
    /wix-bolt|wixstatic|static\.wixstatic|_wix/i.test(html) ? 'Wix' :
    /squarespace\.com|squarespace-cdn|sqsp/i.test(html) ? 'Squarespace' :
    /cdn\.shopify\.com|shopify-section/i.test(html) ? 'Shopify' :
    /wp-content|wp-includes|wordpress/i.test(html) ? 'WordPress' :
    /godaddy|godaddy-sites|websitebuilder/i.test(html) ? 'GoDaddy Builder' :
    /webflow\.com/i.test(html) ? 'Webflow' :
    'Custom';

  const issues = [];
  let score = 50;
  if (!isSSL)                 { score -= 12; issues.push('No HTTPS — Chrome flags your site "Not secure" in the address bar'); }
  if (!hasViewport)           { score -= 12; issues.push('No mobile viewport — site is broken on phones (where 70% of UK searches happen)'); }
  if (responseMs > 4000)      { score -= 12; issues.push('Slow load time (' + responseMs + 'ms) — Google penalises sites over 2.5s'); }
  else if (responseMs > 2000) { score -= 6;  issues.push('Sluggish load time (' + responseMs + 'ms) — could be much faster'); }
  if (platform === 'Wix')         { score -= 8; issues.push('Built on Wix — heavy templates, slow scripts, weak ranking'); }
  if (platform === 'GoDaddy Builder') { score -= 10; issues.push('GoDaddy site builder — outdated tech, very poor SEO'); }
  if (platform === 'Squarespace') { score -= 5; issues.push('Squarespace template — looks like every other Squarespace site'); }
  if (platform === 'WordPress')   { score -= 4; issues.push('WordPress detected — often abandoned / vulnerable plugins'); }
  if (html.length > 800000)   { score -= 6; issues.push('Bloated HTML (' + Math.round(html.length / 1024) + 'KB) — slows the page, hurts SEO'); }
  if (!hasFavicon)            { score -= 3; issues.push('No favicon — looks unfinished in browser tabs and bookmarks'); }
  if (!description)           { score -= 5; issues.push('No meta description — Google has nothing to show in search results'); }
  if (!h1)                    { score -= 4; issues.push('No H1 heading — Google can\'t tell what your page is about'); }
  if (/©.*20(?:0[0-9]|1[0-9]|2[0-3])/.test(visibleText)) { score -= 5; issues.push('Copyright year is stale — looks abandoned to visitors'); }
  score = Math.max(0, Math.min(100, score));

  return {
    statusCode: 200,
    body: JSON.stringify({
      ok: true,
      url: parsed.toString(),
      host: parsed.hostname,
      responseMs,
      platform,
      score,
      issues,
    }),
  };
};
