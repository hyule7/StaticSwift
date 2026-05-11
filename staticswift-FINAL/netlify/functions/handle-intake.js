const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  try {
    let data = {};
    const ct = (event.headers['content-type'] || '');
    if (ct.includes('application/json')) {
      data = JSON.parse(event.body || '{}');
    } else {
      const params = new URLSearchParams(event.body || '');
      data = Object.fromEntries(params.entries());
    }

    if (data['bot-field']) return { statusCode: 200, body: 'OK' };

    const clientId = 'client_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const store = getStore('clients');
    const client = {
      ...data,
      clientId,
      stage: 'new-lead',
      createdAt: new Date().toISOString(),
      source: 'intake-form',
      emailLog: [],
    };
    await store.setJSON(clientId, client);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, clientId })
    };
  } catch (err) {
    console.error('handle-intake error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
