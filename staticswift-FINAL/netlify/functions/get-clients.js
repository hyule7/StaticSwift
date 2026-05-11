const { getClients } = require('./_db');

exports.handler = async (event) => {
  const auth = event.headers['x-admin-password'];
  const validPw = process.env.ADMIN_PASSWORD || 'Harry2001!';
  if (auth !== validPw) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

  try {
    const clients = await getClients();
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
