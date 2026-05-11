const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const auth = event.headers['x-admin-password'];
  const validPw = process.env.ADMIN_PASSWORD || 'Harry2001!';
  if (auth !== validPw) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  try {
    const { clientId, updates } = JSON.parse(event.body || '{}');
    if (!clientId) return { statusCode: 400, body: JSON.stringify({ error: 'clientId required' }) };
    const store = getStore('clients');
    const existing = await store.get(clientId, { type: 'json' });
    if (!existing) return { statusCode: 404, body: JSON.stringify({ error: 'Client not found' }) };
    const updated = { ...existing, ...updates, clientId };
    await store.setJSON(clientId, updated);
    return { statusCode: 200, body: JSON.stringify({ ok: true, client: updated }) };
  } catch (err) {
    console.error('update-client error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
