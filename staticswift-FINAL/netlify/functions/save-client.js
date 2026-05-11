// Called by admin New Sales Order form to save manually entered clients to Blobs
const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const auth = event.headers['x-admin-password'];
  const validPw = process.env.ADMIN_PASSWORD || 'Harry2001!';
  if (auth !== validPw) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  try {
    const data = JSON.parse(event.body || '{}');
    const clientId = data.clientId || `client_${Date.now()}_${Math.random().toString(36).substr(2,9)}`;
    const store = getStore('clients');
    const client = {
      ...data,
      clientId,
      createdAt: data.createdAt || new Date().toISOString(),
      stage: data.stage || 'new-lead',
      source: data.source || 'admin-manual',
    };
    await store.setJSON(clientId, client);
    return { statusCode: 200, body: JSON.stringify({ ok: true, clientId, client }) };
  } catch (err) {
    console.error('save-client error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
