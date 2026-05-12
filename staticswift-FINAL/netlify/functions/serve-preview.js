/**
 * serve-preview.js
 * Proxies HTML files from Uploadcare so they render in browser/iframe
 * Accepts either:
 *   ?id=UUID&base=https://subdomain.ucarecd.net  (preferred - full CDN base)
 *   ?id=UUID  (fallback - tries to fetch from passed URL)
 *   ?url=FULL_CDN_URL  (most direct)
 */
exports.handler = async (event) => {
  const { id, base, url } = event.queryStringParameters || {};

  // Build the fetch URL
  let fetchUrl;
  if (url) {
    // Full URL passed directly
    fetchUrl = decodeURIComponent(url);
  } else if (id && base) {
    // UUID + base domain
    fetchUrl = `${decodeURIComponent(base)}${id}/`;
  } else if (id) {
    // UUID only — try ucarecdn.com as last resort
    fetchUrl = `https://ucarecdn.com/${id}/`;
  } else {
    return { statusCode: 400, body: 'Missing url or id parameter' };
  }

  try {
    const r = await fetch(fetchUrl, {
      headers: { 'Accept': 'text/html,*/*' }
    });

    if (!r.ok) {
      console.error('[serve-preview]', r.status, fetchUrl);
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'text/html' },
        body: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
          <body style="font-family:sans-serif;padding:40px;background:#07090f;color:#f0f2f8">
          <h2 style="margin-bottom:12px">Preview unavailable</h2>
          <p style="color:#8890a8">Could not load preview (HTTP ${r.status}).</p>
          <p style="color:#8890a8;font-size:13px">Try re-uploading the file from the admin panel.</p>
          </body></html>`
      };
    }

    const html = await r.text();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      body: html
    };
  } catch (err) {
    console.error('[serve-preview] error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/html' },
      body: `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;background:#07090f;color:#f0f2f8">
        <h2>Error loading preview</h2><p style="color:#8890a8">${err.message}</p>
        </body></html>`
    };
  }
};
