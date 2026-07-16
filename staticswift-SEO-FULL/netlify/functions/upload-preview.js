const { getFileStore } = require('./_filestore');

const MAX_BODY_BYTES = 5_500_000; // Netlify Lambda hard limit ~6 MB — leave headroom for JSON overhead

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const auth = event.headers['x-admin-password'];
  if (auth !== (process.env.ADMIN_PASSWORD)) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  // Reject before JSON.parse so we don't OOM on huge bodies
  const rawSize = event.body ? Buffer.byteLength(event.body, event.isBase64Encoded ? 'base64' : 'utf8') : 0;
  if (rawSize > MAX_BODY_BYTES) {
    return {
      statusCode: 413,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: false,
        error: 'File too large for direct upload (' + (rawSize / 1024 / 1024).toFixed(1) + ' MB). Netlify functions cap at 6 MB. Inline images as data URLs sparingly, or zip the build and request a chunked upload.',
      }),
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Invalid JSON body' }) };
  }
  const { clientId, fileType, htmlBase64, filename } = parsed;
  if (!clientId || !htmlBase64) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'clientId and htmlBase64 required' }) };
  }

  // Strip a possible data-URL prefix if the client forgot to
  const cleanB64 = String(htmlBase64).replace(/^data:[^;]+;base64,/, '');

  const safeName = (filename || 'preview.html').replace(/[^a-zA-Z0-9._-]/g, '-');
  const lower = safeName.toLowerCase();
  const isZip = lower.endsWith('.zip');
  const isHtml = lower.endsWith('.html') || lower.endsWith('.htm');
  if (!isZip && !isHtml) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Filename must end in .html or .zip' }) };
  }
  const mimeType = isZip ? 'application/zip' : 'text/html';
  const fileId = clientId + '_' + (fileType || 'preview') + '_' + Date.now();
  const fileBuffer = Buffer.from(cleanB64, 'base64');

  if (!fileBuffer.length) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Decoded file is empty — base64 may be malformed' }) };
  }

  let store;
  try {
    store = getFileStore();
  } catch (err) {
    console.error('[upload-preview] blob store unavailable:', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: false,
        error: 'Blob storage not configured: ' + err.message + '. Add NETLIFY_AUTH_TOKEN in Netlify → Site → Environment.',
      }),
    };
  }

  const siteUrl = (process.env.URL || 'https://staticswift.co.uk').replace(/\/$/, '');
  const ft = fileType || 'preview';

  // A PREVIEW zip is a whole multi-file site. Unpack it and serve it as a
  // browsable mini-site (/preview/{fileId}/...) so the portal iframe renders it
  // and relative CSS/JS/image links resolve. (A FINAL zip stays a download.)
  if (isZip && ft === 'preview') {
    try {
      const JSZip = require('jszip');
      const zip = await JSZip.loadAsync(fileBuffer);
      const files = Object.values(zip.files).filter(f => !f.dir && !/(^|\/)(__MACOSX|\.DS_Store)/.test(f.name));
      const index = files
        .filter(f => /(^|\/)index\.html?$/i.test(f.name))
        .sort((a, b) => a.name.length - b.name.length)[0];
      if (!index) {
        return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, error: 'The zip has no index.html at any level. Add one and re-upload.' }) };
      }
      const root = index.name.replace(/index\.html?$/i, ''); // directory the site lives in
      const extMime = { html: 'text/html', htm: 'text/html', css: 'text/css', js: 'text/javascript', json: 'application/json', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', ico: 'image/x-icon', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf' };
      let stored = 0;
      for (const f of files) {
        let rel = f.name;
        if (root) { if (!rel.startsWith(root)) continue; rel = rel.slice(root.length); }
        rel = rel.replace(/^\/+/, '');
        if (!rel) continue;
        const content = await f.async('nodebuffer');
        const ext = (rel.split('.').pop() || '').toLowerCase();
        await store.set(`${fileId}/${rel}`, content, { metadata: { mimeType: extMime[ext] || 'application/octet-stream', sitefile: true, clientId, uploadedAt: new Date().toISOString() } });
        stored++;
      }
      const previewUrl = `${siteUrl}/preview/${fileId}/`;
      console.log('[upload-preview] unpacked site', fileId, stored, 'files, root=', root || '(zip root)');
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, fileId, previewUrl, cdnUrl: previewUrl, filename: safeName, files: stored, mode: 'site' }) };
    } catch (err) {
      console.error('[upload-preview] unzip failed:', err.message);
      return { statusCode: 502, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, error: 'Could not unpack the zip: ' + err.message }) };
    }
  }

  // Single HTML preview, or a FINAL delivery zip (served as a download).
  try {
    await store.set(fileId, fileBuffer, {
      metadata: { filename: safeName, mimeType, clientId, fileType: ft, uploadedAt: new Date().toISOString() },
    });
  } catch (err) {
    console.error('[upload-preview] blob.set failed:', err.message);
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'Could not store file: ' + err.message }),
    };
  }

  const previewUrl = `${siteUrl}/.netlify/functions/serve-preview?id=${fileId}`;

  console.log('[upload-preview] stored', fileId, safeName, fileBuffer.length, 'bytes');

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, fileId, previewUrl, cdnUrl: previewUrl, filename: safeName, bytes: fileBuffer.length }),
  };
};
