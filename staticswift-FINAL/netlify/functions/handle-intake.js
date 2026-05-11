const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  console.log('[handle-intake] method:', event.httpMethod);
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: ''
    };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    let data = {};
    const ct = (event.headers['content-type'] || '');
    console.log('[handle-intake] content-type:', ct);

    if (ct.includes('application/json')) {
      data = JSON.parse(event.body || '{}');
    } else {
      const params = new URLSearchParams(event.body || '');
      data = Object.fromEntries(params.entries());
    }

    // Honeypot
    if (data['bot-field']) return { statusCode: 200, body: 'OK' };

    console.log('[handle-intake] saving client for:', data.business_name || data.name || 'unknown');

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
    console.log('[handle-intake] saved OK:', clientId);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ ok: true, clientId })
    };
  } catch (err) {
    console.error('[handle-intake] ERROR:', err.message, err.stack);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
