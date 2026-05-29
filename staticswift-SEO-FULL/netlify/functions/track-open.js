/*
 * track-open.js
 * ---------------------------------------------------------------
 * Email open-rate tracking pixel.
 * Embed in outreach templates as:
 *   <img src="https://staticswift.co.uk/.netlify/functions/track-open?p=PROSPECT_ID&t=TEMPLATE" width="1" height="1" />
 * When recipient opens the email, mail client loads the pixel → we log
 * the open into the prospect record in JSONBin.
 *
 * Returns a 1x1 transparent GIF regardless so mail clients never break.
 */

const { readDB, writeDB } = require('./_db');

// 43-byte 1x1 transparent GIF
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

function gifResponse() {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
    body: PIXEL.toString('base64'),
    isBase64Encoded: true,
  };
}

exports.handler = async (event) => {
  const params = event.queryStringParameters || {};
  const prospectId = params.p;
  const template = params.t || 'unknown';
  if (!prospectId) return gifResponse();

  // Best-effort log — never block the pixel response
  try {
    const ip = event.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || event.headers['x-nf-client-connection-ip'] || 'unknown';
    const ua = event.headers['user-agent'] || '';
    // Many mail clients (Gmail) pre-fetch — we still log it; first open is real signal
    const db = await readDB();
    if (!db.prospectOpens) db.prospectOpens = {};
    if (!db.prospectOpens[prospectId]) db.prospectOpens[prospectId] = [];
    db.prospectOpens[prospectId].push({ openedAt: new Date().toISOString(), template, ip, ua: ua.slice(0, 200) });
    await writeDB(db);
  } catch (err) {
    console.warn('[track-open]', err.message);
  }
  return gifResponse();
};
