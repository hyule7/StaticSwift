/*
 * serve-preview-site.js — serves an UNZIPPED multi-file preview as a real,
 * browsable mini-site so the client-portal iframe renders it properly.
 *
 * upload-preview unpacks a .zip build into the file store under keys
 * `${fileId}/relative/path`. This function is mounted at /preview/* (see
 * netlify.toml) and maps /preview/{fileId}/{asset} back to that blob, serving
 * each file with the right content-type. Relative asset URLs in index.html
 * (styles.css, /img/logo.png, etc.) therefore resolve, which they cannot when
 * a zip is served as a single download.
 */
const { getFileStore } = require('./_filestore');

const MIME = {
  html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8', json: 'application/json; charset=utf-8',
  svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', ico: 'image/x-icon',
  woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf', eot: 'application/vnd.ms-fontobject',
  txt: 'text/plain; charset=utf-8', xml: 'application/xml', webmanifest: 'application/manifest+json',
  mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg', pdf: 'application/pdf',
};
const extOf = p => (p.split('.').pop() || '').toLowerCase();

async function trackView(fileId, ua) {
  if (/bot|crawler|spider|preview|facebookexternalhit|slackbot|whatsapp/i.test(ua || '')) return;
  try {
    const { getNamedStore } = require('./_blobs');
    const ops = getNamedStore('ops'); if (!ops) return;
    const s = (await ops.get('preview-stats', { type: 'json' })) || { total: 0, byId: {}, viewers: {} };
    s.total = (s.total || 0) + 1;
    s.byId[fileId] = (s.byId[fileId] || 0) + 1;
    if (!s.viewers[fileId]) s.viewers[fileId] = new Date().toISOString();
    s.lastViewAt = new Date().toISOString();
    await ops.setJSON('preview-stats', s);
  } catch (_) {}
}

exports.handler = async (event) => {
  // Path arrives as /preview/{fileId}/{asset...} via the netlify.toml rewrite.
  const rawPath = (event.path || (event.rawUrl ? new URL(event.rawUrl).pathname : '') || '').replace(/\/+$/, m => m.length ? '/' : '');
  const m = rawPath.match(/^\/preview\/([^/]+)(?:\/(.*))?$/);
  if (!m) return { statusCode: 400, body: 'Bad preview path' };
  const fileId = m[1];
  let asset = decodeURIComponent(m[2] || '');
  if (!asset || asset.endsWith('/')) asset += 'index.html';
  asset = asset.replace(/^\/+/, '').replace(/\.\.(\/|$)/g, ''); // no traversal

  const notFound = {
    statusCode: 404, headers: { 'Content-Type': 'text/html' },
    body: '<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px"><h2>Preview file not found</h2><p>Try re-uploading the build from the admin panel.</p></body></html>',
  };

  try {
    const store = getFileStore();
    const entry = await store.getWithMetadata(`${fileId}/${asset}`, { type: 'arrayBuffer' });
    if (!entry || !entry.data) return notFound;

    const buf = Buffer.from(entry.data);
    const ct = MIME[extOf(asset)] || entry.metadata?.mimeType || 'application/octet-stream';
    if (/index\.html?$/i.test(asset)) {
      await trackView(fileId, event.headers && (event.headers['user-agent'] || event.headers['User-Agent']));
    }
    return {
      statusCode: 200,
      headers: { 'Content-Type': ct, 'Cache-Control': 'no-store' },
      body: buf.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (err) {
    console.error('[serve-preview-site] error:', err.message);
    return { statusCode: 500, headers: { 'Content-Type': 'text/html' }, body: '<h2>Error</h2><p>' + err.message + '</p>' };
  }
};
