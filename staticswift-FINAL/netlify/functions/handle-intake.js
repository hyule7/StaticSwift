const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' }, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // Parse body
    const data = JSON.parse(event.body || '{}');

    // Ignore honeypot
    if (data['bot-field']) return { statusCode: 200, body: JSON.stringify({ ok: true }) };

    // Build client record
    const clientId = 'client_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const client = {
      ...data,
      clientId,
      stage: 'new-lead',
      createdAt: new Date().toISOString(),
      source: 'intake-form',
      emailLog: [],
    };

    // Save to Blobs
    const store = getStore('clients');
    await store.setJSON(clientId, client);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: true, clientId })
    };

  } catch (err) {
    console.error('handle-intake error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};
