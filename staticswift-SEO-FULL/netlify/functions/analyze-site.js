/*
 * analyze-site.js
 * ---------------------------------------------------------------
 * Server-side site analyzer for prospect research.
 * Takes a URL → fetches it → returns:
 *   - Performance signals (response time, HTML size)
 *   - Quality signals (SSL, mobile viewport, has-favicon)
 *   - Platform fingerprinting (Wix, Squarespace, Shopify, GoDaddy, WordPress)
 *   - Public contact details extracted from page text (emails, phones, socials)
 *   - Business identity (title, h1, description)
 *   - Prospect score 0-100 (lower = poorer site = better prospect for outreach)
 *
 * Legal note: we only fetch publicly-accessible HTML, no auth bypass.
 * Extracted emails/phones must have been publicly published by the business
 * on that page — same as a human reading the page. This is fine under PECR
 * for B2B research. Sending unsolicited bulk mail off the back of it is not.
 */

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const auth = event.headers['x-admin-password'];
  const validPw = process.env.ADMIN_PASSWORD || 'Harry2001!';
  if (auth !== validPw) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

  let url;
  try { ({ url } = JSON.parse(event.body || '{}')); } catch { return { statusCode: 400, body: JSON.stringify({ error: 'Bad JSON' }) }; }
  if (!url) return { statusCode: 400, body: JSON.stringify({ error: 'url required' }) };

  // Normalise URL — accept "smithplumbing.co.uk" without scheme
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  let parsed;
  try { parsed = new URL(url); } catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid URL' }) }; }

  const start = Date.now();
  let res, html, headers, fetchError;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 12000);
    res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (StaticSwift Prospect Research; +https://staticswift.co.uk)' },
    });
    clearTimeout(t);
    headers = Object.fromEntries(res.headers.entries());
    html = await res.text();
  } catch (err) {
    fetchError = err.name === 'AbortError' ? 'Timeout (12s)' : (err.message || 'Fetch failed');
  }
  const responseMs = Date.now() - start;

  if (fetchError || !html) {
    // Even a failed fetch is signal: site is down / unreachable
    return {
      statusCode: 200,
      body: JSON.stringify({
        url, ok: false, error: fetchError || 'No HTML returned',
        responseMs, score: 5, summary: ['Site unreachable — prime candidate (replace it)'],
      }),
    };
  }

  // === EXTRACT IDENTITY ===
  const m = (re, src = html) => { const r = src.match(re); return r ? r[1].trim() : ''; };
  const title = m(/<title[^>]*>([^<]*)<\/title>/i);
  const description = m(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
  const h1 = m(/<h1[^>]*>([\s\S]*?)<\/h1>/i).replace(/<[^>]+>/g, '').trim();
  const hasViewport = /<meta\s+[^>]*name=["']viewport["']/i.test(html);
  const hasFavicon = /<link\s+[^>]*rel=["'][^"']*icon[^"']*["']/i.test(html);
  const isSSL = parsed.protocol === 'https:';

  // === PLATFORM FINGERPRINTING ===
  const platform =
    /wix-bolt|wixstatic|static\.wixstatic|_wix/i.test(html) ? 'Wix' :
    /squarespace\.com|squarespace-cdn|sqsp/i.test(html) ? 'Squarespace' :
    /cdn\.shopify\.com|shopify-section/i.test(html) ? 'Shopify' :
    /wp-content|wp-includes|wordpress/i.test(html) ? 'WordPress' :
    /godaddy|godaddy-sites|websitebuilder/i.test(html) ? 'GoDaddy Builder' :
    /webflow\.com/i.test(html) ? 'Webflow' :
    /facebook\.com\/pages|fb\.com/i.test(parsed.hostname) ? 'Facebook page' :
    'Custom / unknown';

  // === CONTACT EXTRACTION ===
  // Strip script + style blocks first so we don't pick up tracking-pixel emails
  const visibleText = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  const emailRe = /[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const rawEmails = Array.from(new Set((visibleText.match(emailRe) || [])));
  const emails = rawEmails
    .map(e => e.toLowerCase().trim().replace(/[.,;:)]$/, ''))
    .filter(e =>
      !/example\.|sentry|googleapis|wixpress|w3\.org|sentry|gstatic|jsdelivr/.test(e) &&
      e.length < 80
    )
    .slice(0, 6);

  // UK phone formats (07x, 01x, 02x) and US (xxx) xxx-xxxx
  const phoneRe = /(?:\+?44\s?7\d{3}|07\d{3}|\+?44\s?\(?0?\d{2,4}\)?|0\d{2,4})[\s.-]?\d{3,4}[\s.-]?\d{3,4}|\(\d{3}\)\s?\d{3}[-.]?\d{4}/g;
  const rawPhones = Array.from(new Set((visibleText.match(phoneRe) || [])));
  const phones = rawPhones
    .map(p => p.replace(/[\s.-]+/g, ' ').trim())
    .filter(p => p.replace(/\D/g, '').length >= 9)
    .slice(0, 4);

  // Socials
  const socials = {};
  const fb  = m(/(https?:\/\/(?:www\.)?facebook\.com\/[A-Za-z0-9._-]+)/i, visibleText);
  const ig  = m(/(https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9._-]+)/i, visibleText);
  const tw  = m(/(https?:\/\/(?:www\.)?twitter\.com\/[A-Za-z0-9._-]+)/i, visibleText);
  const tt  = m(/(https?:\/\/(?:www\.)?tiktok\.com\/@?[A-Za-z0-9._-]+)/i, visibleText);
  const li  = m(/(https?:\/\/(?:www\.)?linkedin\.com\/[A-Za-z0-9._\/-]+)/i, visibleText);
  if (fb) socials.facebook  = fb;
  if (ig) socials.instagram = ig;
  if (tw) socials.twitter   = tw;
  if (tt) socials.tiktok    = tt;
  if (li) socials.linkedin  = li;

  // === SCORING (lower = poorer site = better prospect) ===
  const issues = [];
  let score = 50;
  if (!isSSL)                   { score -= 12; issues.push('No HTTPS — flagged "Not Secure" by Chrome'); }
  if (!hasViewport)             { score -= 12; issues.push('No mobile viewport — broken on phones'); }
  if (responseMs > 4000)        { score -= 10; issues.push('Slow page (' + responseMs + 'ms)'); }
  else if (responseMs > 2000)   { score -= 5;  issues.push('Sluggish load (' + responseMs + 'ms)'); }
  if (platform === 'Wix')         { score -= 6; issues.push('Built on Wix (slow, templated, ranks poorly)'); }
  if (platform === 'GoDaddy Builder') { score -= 8; issues.push('GoDaddy builder — outdated tech, poor SEO'); }
  if (platform === 'Squarespace') { score -= 4; issues.push('Squarespace template (looks like every other one)'); }
  if (platform === 'WordPress')   { score -= 3; issues.push('WordPress (often abandoned / vulnerable plugins)'); }
  if (platform === 'Facebook page') { score -= 15; issues.push('Facebook-only — invisible on Google'); }
  if (html.length > 800000)     { score -= 6; issues.push('Bloated HTML (' + Math.round(html.length / 1024) + 'KB)'); }
  if (!hasFavicon)              { score -= 2; issues.push('No favicon — looks unfinished'); }
  if (!description)             { score -= 4; issues.push('No meta description (kills SEO)'); }
  if (!h1)                      { score -= 3; issues.push('No H1 heading (kills SEO)'); }
  if (/©.*20(?:0[0-9]|1[0-9]|2[0-3])/.test(visibleText)) { score -= 4; issues.push('Copyright year is stale (last updated years ago)'); }
  score = Math.max(0, Math.min(100, score));

  return {
    statusCode: 200,
    body: JSON.stringify({
      ok: true,
      url: parsed.toString(),
      host: parsed.hostname,
      responseMs,
      isSSL,
      hasViewport,
      hasFavicon,
      platform,
      title,
      description,
      h1,
      emails,
      phones,
      socials,
      htmlSizeKB: Math.round(html.length / 1024),
      score,
      issues,
      analyzedAt: new Date().toISOString(),
    }),
  };
};
