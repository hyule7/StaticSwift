const crypto = require('crypto');
const { saveClient } = require('./_db');

// Cryptographically-random ID generator. Replaces previous
// `Date.now() + Math.random()` IDs that were guessable/enumerable —
// important for portal UUIDs which are the only auth for client portals.
function strongId(prefix) {
  return prefix + '_' + crypto.randomBytes(18).toString('base64url');
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const auth = event.headers['x-admin-password'];
  const validPw = process.env.ADMIN_PASSWORD || 'Harry2001!';
  if (auth !== validPw) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

  try {
    const data = JSON.parse(event.body || '{}');
    const clientId = data.clientId || strongId('client');
    // Always provision a strong portal UUID server-side. Overrides any
    // weak client-supplied UUID so we don't carry forward predictable IDs.
    const portalUUID = (data.portalUUID && /^portal_[\w-]{20,}$/.test(data.portalUUID))
      ? data.portalUUID
      : strongId('portal');
    const client = {
      ...data,
      clientId,
      portalUUID,
      createdAt: data.createdAt || new Date().toISOString(),
      stage: data.stage || 'new-lead',
      source: data.source || 'admin-manual',
    };
    await saveClient(client);
    return { statusCode: 200, body: JSON.stringify({ ok: true, clientId, client }) };
  } catch (err) {
    console.error('[save-client] error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
