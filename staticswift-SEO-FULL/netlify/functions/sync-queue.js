/*
 * sync-queue.js
 * ---------------------------------------------------------------
 * Writes the admin's local scan queue → server (JSONBin db.scanQueue)
 * so the cron-scan scheduled function can pick up where the browser
 * left off. Called debounced from admin.js on every queue change.
 */

const { readDB, writeDB } = require('./_db');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const auth = event.headers['x-admin-password'];
  const validPw = process.env.ADMIN_PASSWORD || 'Harry2001!';
  if (auth !== validPw) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  try {
    const { scanQueue } = JSON.parse(event.body || '{}');
    if (!Array.isArray(scanQueue)) return { statusCode: 400, body: JSON.stringify({ error: 'scanQueue array required' }) };
    const db = await readDB();
    db.scanQueue = scanQueue.slice(0, 1000); // cap to avoid runaway
    await writeDB(db);
    return { statusCode: 200, body: JSON.stringify({ ok: true, queueSize: db.scanQueue.length }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
