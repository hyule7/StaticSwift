const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  const auth = event.headers['x-admin-password'];
  const validPw = process.env.ADMIN_PASSWORD || 'Harry2001!';
  if (auth !== validPw) {
    console.log('[get-clients] 401 - bad password');
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const store = getStore('clients');
    let clients = [];

    try {
      const { blobs } = await store.list();
      console.log('[get-clients] blobs found:', blobs.length);
      for (const { key } of blobs) {
        if (key === 'invoice_counter') continue;
        try {
          const c = await store.get(key, { type: 'json' });
          if (c && c.clientId) clients.push(c);
        } catch (e) {
          console.error('[get-clients] failed to read key:', key, e.message);
          continue;
        }
      }
    } catch (listErr) {
      console.log('[get-clients] store empty or list failed:', listErr.message);
    }

    clients.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    console.log('[get-clients] returning', clients.length, 'clients');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clients)
    };
  } catch (err) {
    console.error('[get-clients] ERROR:', err.message);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([])
    };
  }
};
