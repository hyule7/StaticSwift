const { deleteClient } = require('./_db');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const auth = event.headers['x-admin-password'];
  const validPw = process.env.ADMIN_PASSWORD || 'Harry2001!';
  if (auth !== validPw) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

  try {
    const { clientId } = JSON.parse(event.body || '{}');
    if (!clientId) return { statusCode: 400, body: JSON.stringify({ error: 'clientId required' }) };
    const result = await deleteClient(clientId);
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (err) {
    console.error('[delete-client] error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
