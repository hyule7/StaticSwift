const { getClient, updateClient } = require('./_db');
const { createTransporter, LOGO_HTML } = require('./_mailer');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const auth = event.headers['x-admin-password'];
  if (auth !== (process.env.ADMIN_PASSWORD || 'Harry2001!')) return { statusCode: 401, body: 'Unauthorized' };
  try {
    const { clientId, previewUrl } = JSON.parse(event.body || '{}');
    const client = await getClient(clientId);
    if (!client) return { statusCode: 404, body: JSON.stringify({ error: 'Client not found' }) };
    // Send preview email via send-email function logic (reuse that endpoint)
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
