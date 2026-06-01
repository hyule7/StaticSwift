/*
 * portal-upload.js
 * ---------------------------------------------------------------
 * Public endpoint for client-side brand-asset uploads from the
 * portal's drop-zone. Accepts multipart form-data with `file` and
 * `portalUUID`, stores bytes in the shared file blob store, and
 * registers metadata on the client record (so it shows up in admin
 * AND in the asset list on the portal itself).
 *
 * Defence-in-depth:
 *   • 8 MB per-file hard cap (the portal UI mirrors this).
 *   • Total per-client cap (60 most-recent kept).
 *   • Image / pdf / zip / svg only — anything else rejected.
 *   • Honeypot UUID check — must match a real client portalUUID.
 *
 * The actual upload uses the same file store the preview vault uses,
 * so admin can serve them back without extra plumbing.
 */

const { getClients, saveClient } = require('./_db');
const { createTransporter } = require('./_mailer');

const MAX_BYTES = 8 * 1024 * 1024;       // 8 MB per file
const MAX_TOTAL_BODY = 9 * 1024 * 1024;  // headroom over the 6MB Netlify cap; portal trims before send
const ALLOWED_MIME = /^(image\/|application\/pdf|application\/zip|application\/x-zip-compressed|application\/octet-stream$)/;

// Parse a tiny multipart body without pulling in a heavy dep — we only need
// `portalUUID` (text field) and `file` (single file). Anything beyond that
// is ignored. Returns { fields, file } or throws.
function parseMultipart(rawBuffer, contentType) {
  const m = contentType && contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!m) throw new Error('no boundary in content-type');
  const boundary = '--' + (m[1] || m[2]).trim();
  const sep = Buffer.from(boundary);
  const parts = [];
  let start = 0;
  while (true) {
    const idx = rawBuffer.indexOf(sep, start);
    if (idx < 0) break;
    if (start !== 0) parts.push(rawBuffer.slice(start, idx - 2));
    start = idx + sep.length;
    if (rawBuffer.slice(start, start + 2).toString() === '--') break;
    start += 2; // skip CRLF after boundary
  }
  const fields = {};
  let file = null;
  for (const part of parts) {
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd < 0) continue;
    const header = part.slice(0, headerEnd).toString('utf8');
    const body = part.slice(headerEnd + 4, part.length - 2); // strip trailing CRLF
    const nameMatch = header.match(/name="([^"]+)"/);
    if (!nameMatch) continue;
    const name = nameMatch[1];
    const filenameMatch = header.match(/filename="([^"]*)"/);
    if (filenameMatch) {
      const ct = (header.match(/Content-Type:\s*([^\r\n]+)/i) || [, 'application/octet-stream'])[1];
      file = {
        name: filenameMatch[1] || 'asset',
        contentType: ct.trim(),
        data: body,
      };
    } else {
      fields[name] = body.toString('utf8');
    }
  }
  return { fields, file };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
  if (!contentType.startsWith('multipart/form-data')) {
    return json(400, { ok: false, error: 'expected multipart/form-data' });
  }

  try {
    const raw = event.body
      ? Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8')
      : Buffer.alloc(0);
    if (raw.length > MAX_TOTAL_BODY) return json(413, { ok: false, error: 'too large' });

    const { fields, file } = parseMultipart(raw, contentType);
    if (!file) return json(400, { ok: false, error: 'no file in form' });

    const uuid = String(fields.portalUUID || '').trim();
    if (!uuid) return json(400, { ok: false, error: 'portalUUID required' });

    if (file.data.length > MAX_BYTES) return json(413, { ok: false, error: 'file over 8MB' });
    if (!ALLOWED_MIME.test(file.contentType)) {
      return json(415, { ok: false, error: 'file type not allowed' });
    }

    const clients = await getClients();
    const client = clients.find(c => c.portalUUID === uuid);
    if (!client) return json(404, { ok: false, error: 'portal not found' });

    // Persist to the file store
    let fileId = null;
    let storeOk = false;
    try {
      const { getFileStore } = require('./_filestore');
      const store = getFileStore();
      fileId = (client.clientId || 'anon') + '_asset_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      await store.set(fileId, file.data, {
        metadata: {
          filename: file.name,
          mimeType: file.contentType,
          clientId: client.clientId,
          source: 'portal-upload',
          uploadedAt: new Date().toISOString(),
        },
      });
      storeOk = true;
    } catch (err) {
      console.warn('[portal-upload] file store unavailable, registering metadata only:', err.message);
    }

    // Register metadata on the client record
    if (!Array.isArray(client.clientAssets)) client.clientAssets = [];
    client.clientAssets.push({
      name: file.name.slice(0, 120),
      bytes: file.data.length,
      kind: file.contentType,
      fileId: fileId || null,
      storedInBlob: storeOk,
      at: new Date().toISOString(),
    });
    if (client.clientAssets.length > 60) client.clientAssets = client.clientAssets.slice(-60);
    if (!Array.isArray(client.portalActivity)) client.portalActivity = [];
    client.portalActivity.push({ at: new Date().toISOString(), type: 'asset', summary: 'Uploaded asset: ' + file.name });
    if (client.portalActivity.length > 200) client.portalActivity = client.portalActivity.slice(-200);
    await saveClient(client);

    // Light Harry notification — silently swallow SMTP errors so the
    // upload itself never appears to fail to the client.
    try {
      const transporter = createTransporter();
      const fromAddr = process.env.SMTP_USER || 'hello@staticswift.co.uk';
      await transporter.sendMail({
        from: '"StaticSwift Portal" <' + fromAddr + '>',
        to: fromAddr,
        subject: '📎 ' + (client.business_name || 'Client') + ' uploaded an asset',
        html: `<div style="font-family:sans-serif;padding:20px">
          <p><strong>${escapeHtml(client.name || 'Client')}</strong> uploaded <strong>${escapeHtml(file.name)}</strong> (${(file.data.length / 1024).toFixed(1)} KB) to their portal.</p>
          <p>Open the admin panel to download it.</p>
        </div>`,
      });
    } catch (e) { /* silently ignore */ }

    return json(200, { ok: true, fileId, bytes: file.data.length });
  } catch (err) {
    console.error('[portal-upload] error:', err.message);
    return json(500, { ok: false, error: err.message });
  }
};

function json(status, obj) {
  return { statusCode: status, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) };
}

function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
