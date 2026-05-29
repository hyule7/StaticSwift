/*
 * get-queue.js
 * ---------------------------------------------------------------
 * Returns the server-side scan queue so the admin can sync local
 * state after a discover-prospects call (which appends to the
 * server-side queue, not the browser's localStorage).
 */

const { readDB } = require('./_db');

exports.handler = async (event) => {
  const auth = event.headers['x-admin-password'];
  const validPw = process.env.ADMIN_PASSWORD || 'Harry2001!';
  if (auth !== validPw) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  try {
    const db = await readDB();
    return { statusCode: 200, body: JSON.stringify({ ok: true, scanQueue: db.scanQueue || [] }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
