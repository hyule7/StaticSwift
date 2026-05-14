const { getFileStore } = require('./_filestore');

exports.handler = async (event) => {
  const fileId = event.queryStringParameters?.id;
  if (!fileId) return { statusCode: 400, body: 'Missing id' };

  try {
    const store = getFileStore();
    const entry = await store.getWithMetadata(fileId, { type: 'arrayBuffer' });

    if (!entry || !entry.data) return {
      statusCode: 404,
      headers: { 'Content-Type': 'text/html' },
      body: '<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;background:#07090f;color:#f0f2f8"><h2>Preview not found</h2><p style="color:#8890a8">Try re-uploading from the admin panel.</p></body></html>'
    };

    const buf = Buffer.from(entry.data);
    const isZip = entry.metadata?.mimeType === 'application/zip';

    if (isZip) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${entry.metadata?.filename || 'delivery.zip'}"`,
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
    console.error('[serve-preview] error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/html' },
      body: `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;background:#07090f;color:#f0f2f8"><h2>Error</h2><p style="color:#8890a8">${err.message}</p></body></html>`
    };
  }
};
