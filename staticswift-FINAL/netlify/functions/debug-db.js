/**
 * debug-db.js — Diagnostic endpoint to check JSONBin connection
 * Hit: /.netlify/functions/debug-db?pw=Harry2001!
 * Returns: bin ID, client count, first 3 client names, and any errors
 */
exports.handler = async (event) => {
  const pw = event.queryStringParameters?.pw;
  if (pw !== 'Harry2001!' && pw !== (process.env.ADMIN_PASSWORD || 'Harry2001!')) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Add ?pw=Harry2001! to URL' }) };
  }

  const result = {
    binId: process.env.JSONBIN_BIN_ID || 'NOT SET',
    apiKeySet: !!process.env.JSONBIN_API_KEY,
    binIdHardcoded: '6a0259d6adc21f119a871c57',
    envMatch: process.env.JSONBIN_BIN_ID === '6a0259d6adc21f119a871c57',
    timestamp: new Date().toISOString(),
  };

  try {
    const BIN_ID = process.env.JSONBIN_BIN_ID;
    const API_KEY = process.env.JSONBIN_API_KEY;
    
    if (!BIN_ID || !API_KEY) {
      result.error = 'Missing env vars: JSONBIN_BIN_ID=' + (BIN_ID ? 'SET' : 'MISSING') + ', JSONBIN_API_KEY=' + (API_KEY ? 'SET' : 'MISSING');
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(result, null, 2) };
    }

    const r = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
      headers: { 'X-Master-Key': API_KEY, 'X-Bin-Meta': 'false' }
    });

    result.httpStatus = r.status;

    if (!r.ok) {
      result.error = 'JSONBin returned ' + r.status;
      const text = await r.text();
      result.responseBody = text.substring(0, 500);
    } else {
      const data = await r.json();
      result.dataType = typeof data;
      result.hasClients = Array.isArray(data?.clients);
      result.clientCount = Array.isArray(data?.clients) ? data.clients.length : 0;
      result.invoiceCounter = data?.invoiceCounter || 0;
      
      if (result.clientCount > 0) {
        result.firstThreeClients = data.clients.slice(0, 3).map(c => ({
          name: c.name || c.business_name || 'unknown',
          business: c.business_name || '-',
          stage: c.stage || '-',
          created: c.createdAt || '-',
          email: c.delivery_email || '-',
        }));
      }
      
      // Check data structure
      result.topLevelKeys = Object.keys(data);
    }
  } catch (err) {
    result.error = err.message;
    result.stack = err.stack?.substring(0, 300);
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(result, null, 2)
  };
};
