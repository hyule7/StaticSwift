exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const auth = event.headers['x-admin-password'];
  if (auth !== (process.env.ADMIN_PASSWORD || 'Harry2001!')) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const { clientId, fileType, htmlBase64, filename } = JSON.parse(event.body || '{}');
    if (!clientId || !htmlBase64) return { statusCode: 400, body: JSON.stringify({ error: 'clientId and htmlBase64 required' }) };

    const PUB_KEY = process.env.UPLOADCARE_PUBLIC_KEY;
    if (!PUB_KEY) return { statusCode: 500, body: JSON.stringify({ error: 'UPLOADCARE_PUBLIC_KEY not set in Netlify env vars' }) };

    const fileBuffer = Buffer.from(htmlBase64, 'base64');
    const safeName = (filename || 'preview.html').replace(/[^a-zA-Z0-9._-]/g, '-');

    // Uploadcare direct upload via multipart — using raw boundary approach, no form-data package
    const boundary = '----NetlifyBoundary' + Date.now();
    const CRLF = '\r\n';

    const textPart = (name, value) =>
      `--${boundary}${CRLF}Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}${value}${CRLF}`;

    const header =
      textPart('UPLOADCARE_PUB_KEY', PUB_KEY) +
      textPart('UPLOADCARE_STORE', '1') +
      `--${boundary}${CRLF}Content-Disposition: form-data; name="file"; filename="${safeName}"${CRLF}Content-Type: text/html${CRLF}${CRLF}`;
    const footer = `${CRLF}--${boundary}--${CRLF}`;

    const headerBuf = Buffer.from(header, 'utf-8');
    const footerBuf = Buffer.from(footer, 'utf-8');
    const body = Buffer.concat([headerBuf, fileBuffer, footerBuf]);

    const uploadRes = await fetch('https://upload.uploadcare.com/base/', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length.toString(),
      },
      body,
    });

    const responseText = await uploadRes.text();
    if (!uploadRes.ok) throw new Error('Uploadcare upload failed: ' + responseText);

    const uploadData = JSON.parse(responseText);
    const fileUUID = uploadData.file;
    if (!fileUUID) throw new Error('No file UUID from Uploadcare: ' + responseText);

    const fileUrl = 'https://ucarecdn.com/' + fileUUID + '/' + safeName;
    console.log('[upload-preview] uploaded:', fileUrl);

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
