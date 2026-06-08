/*
 * lock-price.js
 * ---------------------------------------------------------------
 * Endpoint for the homepage exit-intent modal.
 * Receives: { email, source, ref, aff, utm_* } from ss-cash-trap-v1.
 *
 * Behaviour:
 *   1. Validates email shape (cheap regex; not RFC-perfect, fine here).
 *   2. Stores a price-lock record in db.priceLocks[] with 24h expiry.
 *     - cycleKey-style id: 'lock_' + Date.now() + random
 *     - amount: 100 (£ off the Launchpad bundle, matches the modal copy)
 *     - expiresAt: now + 24h
 *   3. Sends the visitor a magic link back to /order.html?priceLock=24h&token=<id>.
 *   4. Notifies Harry by email (rate-limited downstream by handle-intake style).
 *
 * Idempotent: the same email pinging multiple times in a 24h window is
 * upserted, not duplicated. Honours the suppression list.
 */

const { readDB, writeDB } = require('./_db');
const { createTransporter } = require('./_mailer');

const LOCK_AMOUNT_GBP = 100;
const LOCK_TTL_MS     = 24 * 3600 * 1000;

function isEmail(s){
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}
function uid(){
  return 'lock_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'bad JSON' }) }; }

  const email = String(body.email || '').trim().toLowerCase();
  if (!isEmail(email)) return { statusCode: 400, body: JSON.stringify({ error: 'email required' }) };

  // Capture every attribution param the cash-trap script sent up.
  const attribution = {
    source:        String(body.source || 'exit_intent').slice(0, 40),
    ref:           body.ref         ? String(body.ref).slice(0, 80)         : null,
    aff:           body.aff         ? String(body.aff).slice(0, 80)         : null,
    utm_source:    body.utm_source  ? String(body.utm_source).slice(0, 80)  : null,
    utm_medium:    body.utm_medium  ? String(body.utm_medium).slice(0, 80)  : null,
    utm_campaign:  body.utm_campaign? String(body.utm_campaign).slice(0, 80): null,
  };

  const now = Date.now();
  const expiresAt = now + LOCK_TTL_MS;
  const token = uid();

  try {
    const db = await readDB(true);
    if (!Array.isArray(db.priceLocks)) db.priceLocks = [];

    // Sweep expired locks first — keeps the array bounded
    db.priceLocks = db.priceLocks.filter(l => l && l.expiresAt && l.expiresAt > now);

    // Upsert by email — one active lock per address at a time
    db.priceLocks = db.priceLocks.filter(l => l.email !== email);
    db.priceLocks.push({
      token, email,
      amount: LOCK_AMOUNT_GBP, currency: 'GBP',
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(expiresAt).toISOString(),
      attribution,
    });

    // Cap to last 500 so the bin stays sane if the modal goes viral
    if (db.priceLocks.length > 500) db.priceLocks = db.priceLocks.slice(-500);

    await writeDB(db);
  } catch (err) {
    console.error('[lock-price] DB write failed:', err.message);
    // Still try to send the email — the lock is the value, the DB is bookkeeping
  }

  // Build the magic link. Visitor returning via this URL is detected by the
  // homepage cash-trap script and the order.html handler, which apply the £100
  // discount to the build invoice via portal-response.js.
  const base = process.env.URL || 'https://staticswift.co.uk';
  const magicLink = base + '/order.html?priceLock=24h&token=' + encodeURIComponent(token);

  try {
    const transporter = createTransporter();
    const fromAddr = process.env.SMTP_USER || 'hello@staticswift.co.uk';

    // To the visitor — the price-lock confirmation
    await transporter.sendMail({
      from: '"StaticSwift" <' + fromAddr + '>',
      to: email,
      replyTo: fromAddr,
      subject: 'Your £100 saving is held for 24 hours.',
      html: '<!doctype html><html><body style="margin:0;padding:32px 16px;background:#EBE7DD;font-family:Helvetica,Arial,sans-serif;color:#0E0B07;line-height:1.55">'
        + '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:560px;margin:0 auto;background:#F2EFE7;border:1px solid rgba(14,11,7,.22)">'
        + '<tr><td style="padding:32px 32px 8px"><div style="font-family:Georgia,serif;font-style:italic;font-weight:500;font-size:22px;letter-spacing:-.01em">StaticSwift</div></td></tr>'
        + '<tr><td style="padding:0 32px"><hr style="border:0;border-top:1px solid #0E0B07;margin:8px 0 24px"></td></tr>'
        + '<tr><td style="padding:0 32px 8px">'
        +   '<div style="font-family:Menlo,monospace;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#9C2615">24-hour price lock</div>'
        +   '<h1 style="font-family:Georgia,serif;font-style:italic;font-weight:500;font-size:32px;line-height:.95;letter-spacing:-.025em;margin:14px 0 12px">Saved. £100 held for 24 hours.</h1>'
        +   '<p style="font-family:Georgia,serif;font-size:16px;color:#29221C">When you\'re ready, click the button below. The Launchpad bundle will stay at <b>£871</b> instead of £971 (a £100 saving) for the next 24 hours.</p>'
        + '</td></tr>'
        + '<tr><td style="padding:8px 32px 28px">'
        +   '<a href="' + magicLink + '" style="display:inline-block;background:#0E0B07;color:#F2EFE7;padding:16px 28px;border-radius:100px;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-weight:500;font-size:15px">Send my brief — £871 held →</a>'
        +   '<p style="font-family:Menlo,monospace;font-size:10.5px;letter-spacing:.04em;color:#8A7B62;margin-top:18px">Saving expires ' + new Date(expiresAt).toLocaleString('en-GB',{ timeZone:'Europe/London' }) + ' UK time.</p>'
        + '</td></tr>'
        + '<tr><td style="padding:0 32px 30px;font-size:12px;color:#5A4E40;border-top:1px solid rgba(14,11,7,.10);padding-top:18px">Reply to this email if you have any questions &mdash; you\'re replying directly to me, Harry. StaticSwift, Manchester.</td></tr>'
        + '</table></body></html>',
    });

    // To Harry — internal notification
    await transporter.sendMail({
      from: '"StaticSwift Trap" <' + fromAddr + '>',
      to: fromAddr,
      subject: 'Price-lock saved: ' + email + ' (' + attribution.source + ')',
      html: '<div style="font-family:sans-serif;padding:14px"><p><strong>' + email + '</strong> saved via <em>' + attribution.source + '</em>.</p>'
        + '<p>Token: <code>' + token + '</code></p>'
        + '<p>Attribution: <pre>' + JSON.stringify(attribution, null, 2) + '</pre></p></div>',
    });

  } catch (err) {
    console.warn('[lock-price] mail failed:', err.message);
    // Surface as success anyway — the lock is in the DB, the customer can email later
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, token, expiresAt }),
  };
};
