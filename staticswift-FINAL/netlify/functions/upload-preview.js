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
    const SEC_KEY = process.env.UPLOADCARE_SECRET_KEY;
    if (!PUB_KEY) return { statusCode: 500, body: JSON.stringify({ error: 'UPLOADCARE_PUBLIC_KEY not set in Netlify env vars' }) };

    const fileBuffer = Buffer.from(htmlBase64, 'base64');
    const origName = filename || (fileType === 'final' ? 'website-final.html' : 'website-preview.html');
    const safeName = origName.replace(/[^a-zA-Z0-9._-]/g, '-');
    const isZip = safeName.toLowerCase().endsWith('.zip');
    const mimeType = isZip ? 'application/zip' : 'text/html';

    // ── Step 1: Upload to Uploadcare ──────────────────────────────────────
    const boundary = '----UCBoundary' + Date.now();
    const CRLF = '\r\n';
    const field = (name, val) =>
      `--${boundary}${CRLF}Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}${val}${CRLF}`;

    const body = Buffer.concat([
      Buffer.from(field('UPLOADCARE_PUB_KEY', PUB_KEY)),
      Buffer.from(field('UPLOADCARE_STORE', '1')),
      Buffer.from(
        `--${boundary}${CRLF}` +
        `Content-Disposition: form-data; name="file"; filename="${safeName}"${CRLF}` +
        `Content-Type: ${mimeType}${CRLF}${CRLF}`
      ),
      fileBuffer,
      Buffer.from(`${CRLF}--${boundary}--${CRLF}`),
    ]);

    const uploadRes = await fetch('https://upload.uploadcare.com/base/', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': String(body.length),
      },
      body,
    });

    const uploadText = await uploadRes.text();
    if (!uploadRes.ok) throw new Error('Uploadcare upload failed (' + uploadRes.status + '): ' + uploadText);

    const uploadData = JSON.parse(uploadText);
    const fileUUID = uploadData.file;
    if (!fileUUID) throw new Error('No UUID in Uploadcare response: ' + uploadText);

    // ── Step 2: Explicitly store file via REST API and get correct CDN URL ──
    // The REST API response contains the correct cdn_url for this account
    // (new accounts use subdomain.ucarecd.net, not ucarecdn.com)
    let cdnUrl = `https://ucarecdn.com/${fileUUID}/`; // fallback only

    if (SEC_KEY) {
      try {
        const storeRes = await fetch(`https://api.uploadcare.com/files/${fileUUID}/storage/`, {
          method: 'PUT',
          headers: {
            'Authorization': `Uploadcare.Simple ${PUB_KEY}:${SEC_KEY}`,
            'Accept': 'application/vnd.uploadcare-v0.7+json',
          },
        });
        if (storeRes.ok) {
          const storeData = await storeRes.json();
          // Use the cdn_url from the API — this has the correct subdomain for new accounts
          if (storeData.cdn_url) {
            cdnUrl = storeData.cdn_url;
            console.log('[upload-preview] stored, cdn_url:', cdnUrl);
          }
        } else {
          console.warn('[upload-preview] store failed:', storeRes.status);
        }
      } catch (storeErr) {
        console.warn('[upload-preview] store call error:', storeErr.message);
      }
    } else {
      // No secret key — try to get cdn_url from info endpoint
      try {
        const infoRes = await fetch(`https://api.uploadcare.com/files/${fileUUID}/`, {
          headers: {
            'Authorization': `Uploadcare.Simple ${PUB_KEY}:`,
            'Accept': 'application/vnd.uploadcare-v0.7+json',
          },
        });
        if (infoRes.ok) {
          const info = await infoRes.json();
          if (info.cdn_url) cdnUrl = info.cdn_url;
        }
      } catch {}
    }

    // For HTML: proxy through serve-preview so it renders in browser
    // For ZIP: CDN URL directly (download behaviour is correct for ZIP)
    const siteUrl = (process.env.URL || 'https://staticswift.co.uk').replace(/\/$/, '');
    const previewUrl = isZip
      ? cdnUrl
      : `${siteUrl}/.netlify/functions/serve-preview?url=${encodeURIComponent(cdnUrl)}`;

    console.log('[upload-preview] done:', fileUUID, mimeType, '→', previewUrl);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, fileId: fileUUID, previewUrl, cdnUrl, filename: safeName })
    };

  } catch (err) {
    console.error('[upload-preview] error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
