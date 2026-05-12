const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  const fileId = event.queryStringParameters?.id;
  if (!fileId) return { statusCode: 400, body: 'Missing id' };

  try {
    const store = getStore({ name: 'client-files', consistency: 'strong' });
    const { data, metadata } = await store.getWithMetadata(fileId, { type: 'arrayBuffer' });

    if (!data) return {
      statusCode: 404,
      headers: { 'Content-Type': 'text/html' },
      body: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family:sans-serif;padding:40px;background:#07090f;color:#f0f2f8"><h2>Preview not found</h2><p style="color:#8890a8">Try re-uploading from the admin panel.</p></body></html>`
    };

    const isZip = metadata?.mimeType === 'application/zip';
    const buf = Buffer.from(data);

    if (isZip) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${metadata?.filename || 'delivery.zip'}"`,
        },
        body: buf.toString('base64'),
        isBase64Encoded: true,
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      body: buf.toString('utf-8'),
    };

  } catch (err) {
    console.error('[serve-preview] error:', err.message, 'id:', fileId);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/html' },
      body: `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;background:#07090f;color:#f0f2f8"><h2>Error loading file</h2><p style="color:#8890a8">${err.message}</p><p style="color:#8890a8;font-size:13px">Try re-uploading from the admin panel.</p></body></html>`
    };
  }
};
