/**
 * serve-preview.js
 * Proxies HTML files from Uploadcare so they render in browser/iframe
 * instead of being forced as a download.
 */
exports.handler = async (event) => {
  const fileId = event.queryStringParameters?.id;
  const filename = event.queryStringParameters?.name || 'preview.html';

  if (!fileId) return { statusCode: 400, body: 'Missing id parameter' };

  try {
    // Fetch the file from Uploadcare CDN
    const ucUrl = `https://ucarecdn.com/${fileId}/${encodeURIComponent(filename)}`;
    const r = await fetch(ucUrl);

    if (!r.ok) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'text/html' },
        body: `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;background:#07090f;color:#f0f2f8">
          <h2>Preview not found</h2>
          <p style="color:#8890a8">The file could not be loaded. It may have been removed from Uploadcare.</p>
          <p style="color:#8890a8;font-size:13px">UUID: ${fileId}</p>
          </body></html>`
      };
    }

    const html = await r.text();
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Frame-Options': 'ALLOWALL',
      },
      body: html
    };
  } catch (err) {
    console.error('[serve-preview] error:', err.message);
    return { statusCode: 500, body: 'Error loading preview: ' + err.message };
  }
};
