const { updateClient, getClient } = require('./_db');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const auth = event.headers['x-admin-password'];
  if (auth !== (process.env.ADMIN_PASSWORD || 'Harry2001!')) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const { clientId, fileType, htmlBase64, filename } = JSON.parse(event.body || '{}');
    if (!clientId || !htmlBase64) return { statusCode: 400, body: JSON.stringify({ error: 'clientId and htmlBase64 required' }) };

    const UPLOADCARE_PUB = process.env.UPLOADCARE_PUBLIC_KEY;
    const UPLOADCARE_SEC = process.env.UPLOADCARE_SECRET_KEY;
    if (!UPLOADCARE_PUB || !UPLOADCARE_SEC) {
      return { statusCode: 500, body: JSON.stringify({ error: 'UPLOADCARE_PUBLIC_KEY and UPLOADCARE_SECRET_KEY not set in Netlify env vars' }) };
    }

    // Convert base64 to buffer
    const fileBuffer = Buffer.from(htmlBase64, 'base64');
    const safeName = (filename || 'preview.html').replace(/[^a-zA-Z0-9._-]/g, '-');

    // Upload to Uploadcare via REST API
    const FormData = require('form-data');
    const form = new FormData();
    form.append('UPLOADCARE_PUB_KEY', UPLOADCARE_PUB);
    form.append('UPLOADCARE_STORE', '1');
    form.append('file', fileBuffer, { filename: safeName, contentType: 'text/html' });

    const uploadRes = await fetch('https://upload.uploadcare.com/base/', {
      method: 'POST',
      headers: form.getHeaders(),
      body: form,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error('Uploadcare upload failed: ' + errText);
    }

    const uploadData = await uploadRes.json();
    const fileUUID = uploadData.file;
    if (!fileUUID) throw new Error('No file UUID returned from Uploadcare');

    // Public URL for the file
    const fileUrl = 'https://ucarecdn.com/' + fileUUID + '/' + safeName;

    console.log('[upload-preview] uploaded to Uploadcare:', fileUrl);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, fileId: fileUUID, previewUrl: fileUrl })
    };

  } catch (err) {
    console.error('[upload-preview] error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
