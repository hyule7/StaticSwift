/*
 * get-opens.js
 * ---------------------------------------------------------------
 * Returns the prospectOpens log to the admin so we can show
 * open counts per prospect.
 */

const { readDB } = require('./_db');

exports.handler = async (event) => {
  const auth = event.headers['x-admin-password'];
  const validPw = process.env.ADMIN_PASSWORD || 'Harry2001!';
  if (auth !== validPw) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  try {
    const db = await readDB();
    return { statusCode: 200, body: JSON.stringify({ ok: true, opens: db.prospectOpens || {} }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
