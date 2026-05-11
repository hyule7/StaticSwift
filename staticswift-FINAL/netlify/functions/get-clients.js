const { getClientStore } = require('./_store');

exports.handler = async (event) => {
  const auth = event.headers['x-admin-password'];
  const validPw = process.env.ADMIN_PASSWORD || 'Harry2001!';
  if (auth !== validPw) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const store = getClientStore();
    let clients = [];

    try {
      const { blobs } = await store.list();
      for (const { key } of blobs) {
        if (key === 'invoice_counter') continue;
        try {
          const c = await store.get(key, { type: 'json' });
          if (c && c.clientId) clients.push(c);
        } catch { continue; }
      }
    } catch (e) {
      console.log('[get-clients] list failed:', e.message);
    }

    clients.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clients)
    };
  } catch (err) {
    console.error('[get-clients] error:', err.message);
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([]) };
  }
};
