const { getFileStore } = require('./_filestore');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const auth = event.headers['x-admin-password'];
  if (auth !== (process.env.ADMIN_PASSWORD || 'Harry2001!')) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const { clientId, fileType, htmlBase64, filename } = JSON.parse(event.body || '{}');
    if (!clientId || !htmlBase64) return { statusCode: 400, body: JSON.stringify({ error: 'clientId and htmlBase64 required' }) };

    const safeName = (filename || 'preview.html').replace(/[^a-zA-Z0-9._-]/g, '-');
    const isZip = safeName.toLowerCase().endsWith('.zip');
    const mimeType = isZip ? 'application/zip' : 'text/html';
    const fileId = clientId + '_' + fileType + '_' + Date.now();
    const fileBuffer = Buffer.from(htmlBase64, 'base64');

    const store = getFileStore();
    await store.set(fileId, fileBuffer, {
      metadata: { filename: safeName, mimeType, clientId, fileType, uploadedAt: new Date().toISOString() }
    });

    const siteUrl = (process.env.URL || 'https://staticswift.co.uk').replace(/\/$/, '');
    const previewUrl = `${siteUrl}/.netlify/functions/serve-preview?id=${fileId}`;

    console.log('[upload-preview] stored:', fileId, safeName, fileBuffer.length, 'bytes');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, fileId, previewUrl, cdnUrl: previewUrl, filename: safeName })
    };

  } catch (err) {
    console.error('[upload-preview] error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
