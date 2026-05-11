const { updateClient } = require('./_db');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const auth = event.headers['x-admin-password'];
  const validPw = process.env.ADMIN_PASSWORD || 'Harry2001!';
  if (auth !== validPw) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

  try {
    const { clientId, updates } = JSON.parse(event.body || '{}');
    if (!clientId) return { statusCode: 400, body: JSON.stringify({ error: 'clientId required' }) };
    const client = await updateClient(clientId, updates);
    return { statusCode: 200, body: JSON.stringify({ ok: true, client }) };
  } catch (err) {
    console.error('[update-client] error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
