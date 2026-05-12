/**
 * upload-preview.js
 * Accepts a base64-encoded HTML file, stores it in JSONBin under a unique key,
 * returns a public URL: /.netlify/functions/serve-preview?id=XXXX
 */
const { readDB, writeDB } = require('./_db');

// We need to expose readDB/writeDB - let's add them to _db.js
const db = require('./_db');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const auth = event.headers['x-admin-password'];
  if (auth !== (process.env.ADMIN_PASSWORD || 'Harry2001!')) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const { clientId, fileType, htmlBase64, filename } = JSON.parse(event.body || '{}');
    if (!clientId || !htmlBase64) return { statusCode: 400, body: JSON.stringify({ error: 'clientId and htmlBase64 required' }) };

    const html = Buffer.from(htmlBase64, 'base64').toString('utf-8');
    const fileId = clientId + '_' + (fileType || 'preview') + '_' + Date.now();

    // Store in JSONBin under previews key
    const data = await db.readDB();
    if (!data.previews) data.previews = {};
    data.previews[fileId] = { html, clientId, fileType, filename, uploadedAt: new Date().toISOString() };
    await db.writeDB(data);

    const siteUrl = process.env.URL || 'https://staticswift.co.uk';
    const previewUrl = `${siteUrl}/.netlify/functions/serve-preview?id=${fileId}`;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, fileId, previewUrl })
    };
  } catch (err) {
    console.error('[upload-preview] error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
