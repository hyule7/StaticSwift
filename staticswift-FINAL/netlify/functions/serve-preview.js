/**
 * serve-preview.js
 * Serves a stored HTML preview file publicly by ID
 */
const db = require('./_db');

exports.handler = async (event) => {
  const fileId = event.queryStringParameters?.id;
  if (!fileId) return { statusCode: 400, body: 'Missing id' };

  try {
    const data = await db.readDB();
    const file = data.previews?.[fileId];
    if (!file) return { statusCode: 404, body: 'Preview not found' };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      body: file.html
    };
  } catch (err) {
    console.error('[serve-preview] error:', err.message);
    return { statusCode: 500, body: 'Error loading preview' };
  }
};
