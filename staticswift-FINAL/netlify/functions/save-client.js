const { getClientStore } = require('./_store');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const auth = event.headers['x-admin-password'];
  const validPw = process.env.ADMIN_PASSWORD || 'Harry2001!';
  if (auth !== validPw) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

  try {
    const data = JSON.parse(event.body || '{}');
    const clientId = data.clientId || 'client_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const client = { ...data, clientId, createdAt: data.createdAt || new Date().toISOString(), stage: data.stage || 'new-lead', source: data.source || 'admin-manual' };
    const store = getClientStore();
    await store.setJSON(clientId, client);
    return { statusCode: 200, body: JSON.stringify({ ok: true, clientId, client }) };
  } catch (err) {
    console.error('[save-client] error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
