const { getFileStore } = require('./_filestore');

const MAX_BODY_BYTES = 5_500_000; // Netlify Lambda hard limit ~6 MB — leave headroom for JSON overhead

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const auth = event.headers['x-admin-password'];
  if (auth !== (process.env.ADMIN_PASSWORD || 'Harry2001!')) {
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

  try {
    await store.set(fileId, fileBuffer, {
      metadata: { filename: safeName, mimeType, clientId, fileType: fileType || 'preview', uploadedAt: new Date().toISOString() },
    });
  } catch (err) {
    console.error('[upload-preview] blob.set failed:', err.message);
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'Could not store file: ' + err.message }),
    };
  }

  const siteUrl = (process.env.URL || 'https://staticswift.co.uk').replace(/\/$/, '');
  const previewUrl = `${siteUrl}/.netlify/functions/serve-preview?id=${fileId}`;

  console.log('[upload-preview] stored', fileId, safeName, fileBuffer.length, 'bytes');

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, fileId, previewUrl, cdnUrl: previewUrl, filename: safeName, bytes: fileBuffer.length }),
  };
};
