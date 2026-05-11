const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  const auth = event.headers['x-admin-password'];
  if (auth !== process.env.ADMIN_PASSWORD) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  try {
    const store = getStore('clients');
    const { blobs } = await store.list();
    const clients = [];
    for (const { key } of blobs) {
      if (key === 'invoice_counter') continue;
      try {
        const c = await store.get(key, { type: 'json' });
        if (c && c.clientId) clients.push(c);
      } catch { continue; }
    }
    clients.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clients)
    };
  } catch (err) {
    console.error('get-clients error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
