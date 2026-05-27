/**
 * debug-db.js — Diagnostic endpoint for the JSONBin store.
 *
 * Disabled in production. The previous version leaked the hardcoded
 * Bin ID and PII (names, emails, business, stages) of the first three
 * client records to anyone who knew the password — and the password
 * itself was reused as the URL query string in plain text. That made
 * it a one-step PII exfiltration endpoint.
 *
 * To enable for local debugging: set ENABLE_DEBUG_DB=1 in the env.
 */
exports.handler = async (event) => {
  if (process.env.ENABLE_DEBUG_DB !== '1') {
    return { statusCode: 404, body: 'Not Found' };
  }

  const pw = event.queryStringParameters?.pw;
  if (!pw || pw !== process.env.ADMIN_PASSWORD) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const result = {
    binIdSet: !!process.env.JSONBIN_BIN_ID,
    apiKeySet: !!process.env.JSONBIN_API_KEY,
    timestamp: new Date().toISOString(),
  };

  try {
    const BIN_ID = process.env.JSONBIN_BIN_ID;
    const API_KEY = process.env.JSONBIN_API_KEY;

    if (!BIN_ID || !API_KEY) {
      result.error = 'Missing env vars (JSONBIN_BIN_ID and/or JSONBIN_API_KEY)';
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(result, null, 2) };
    }

    const r = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
      headers: { 'X-Master-Key': API_KEY, 'X-Bin-Meta': 'false' }
    });

    result.httpStatus = r.status;
    if (r.ok) {
      const data = await r.json();
      result.hasClients = Array.isArray(data?.clients);
      result.clientCount = Array.isArray(data?.clients) ? data.clients.length : 0;
      result.invoiceCounter = data?.invoiceCounter || 0;
    } else {
      result.error = 'JSONBin returned ' + r.status;
    }
  } catch (err) {
    result.error = err.message;
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result, null, 2)
  };
};
