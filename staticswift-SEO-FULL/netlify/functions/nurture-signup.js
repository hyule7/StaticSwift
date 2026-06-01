/*
 * nurture-signup.js
 * ---------------------------------------------------------------
 * Public, unauthenticated endpoint for newsletter / lead-magnet
 * signups (e.g. the "free 5-minute website audit" form on landing
 * pages). Stores the email into db.nurture and fires a thank-you
 * email immediately.
 *
 * Hardening:
 *   • Honeypot field (bot-field) — silently 200s on fill.
 *   • Suppression check — never re-add a known opt-out.
 *   • CORS open so SEO pages on the same origin can post freely.
 *   • Email validation (RFC-ish) before write.
 *   • Idempotent — re-submits of the same email update lastSeenAt,
 *     don't duplicate the row, and don't re-fire the thank-you.
 */

const { readDB, writeDB } = require('./_db');
const { isSuppressed, normalizeEmail, unsubUrl } = require('./_suppression');
const { createTransporter } = require('./_mailer');

function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim());
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function json(status, obj) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    body: JSON.stringify(obj),
  };
}

async function sendThankYou(email, { name = '', source = '' } = {}) {
  // Best-effort — never fail the signup because the welcome email choked.
  const fromAddr = process.env.SMTP_USER || 'hello@staticswift.co.uk';
  if (!process.env.SMTP_PASS) {
    console.warn('[nurture-signup] no SMTP_PASS — skipping welcome email');
    return false;
  }
  try {
    const transporter = createTransporter();
    const unsub = unsubUrl(email, 'nurture');
    const greeting = name ? 'Hi ' + name.split(/\s+/)[0] + ',' : 'Hi there,';
    const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111;line-height:1.6">
  <h2 style="font-size:22px;letter-spacing:-.01em;margin:0 0 12px">${greeting}</h2>
  <p>Thanks for signing up — I'll only email you when I've got something genuinely useful for a small-business owner (one polished tip per fortnight, max).</p>
  <p>If you'd like a free 24-hour website preview, just hit reply and tell me your business name + town. No card, no commitment.</p>
  <p style="margin-top:28px">Cheers,<br>Harry &mdash; StaticSwift</p>
  <hr style="border:0;border-top:1px solid #eee;margin:28px 0">
  <p style="font-size:12px;color:#888">
    StaticSwift &middot; Manchester, UK &middot; <a href="https://staticswift.co.uk" style="color:#888">staticswift.co.uk</a><br>
    Not for you? <a href="${unsub}" style="color:#888">Unsubscribe in one click</a>${source ? ' &middot; <span style="opacity:.6">via ' + source + '</span>' : ''}.
  </p>
</div>`;
    await transporter.sendMail({
      from: '"Harry at StaticSwift" <' + fromAddr + '>',
      to: email,
      subject: "You're in — quick note from Harry",
      html,
      text: greeting + '\n\nThanks for signing up — I will only email you when I have something useful (one tip per fortnight, max).\n\nIf you would like a free 24-hour preview, just reply with your business name + town.\n\nCheers,\nHarry — StaticSwift\n\n—\nUnsubscribe: ' + unsub,
      replyTo: fromAddr,
      headers: {
        'List-Unsubscribe': '<' + unsub + '>',
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });
    return true;
  } catch (err) {
    console.warn('[nurture-signup] welcome email failed:', err.message);
    return false;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'Bad JSON' }); }

  const honeypot = body['bot-field'] || body.botfield || body.website_url;
  if (honeypot) {
    // Bot — silently OK so they don't probe for what we accept.
    return json(200, { ok: true });
  }

  const email = normalizeEmail(body.email || body.delivery_email);
  if (!isValidEmail(email)) return json(400, { error: 'Valid email required' });

  if (await isSuppressed(email)) {
    // Don't betray that they're on the suppression list — just claim success.
    return json(200, { ok: true, suppressed: true });
  }

  const db = await readDB();
  if (!Array.isArray(db.nurture)) db.nurture = [];

  const now = new Date().toISOString();
  const idx = db.nurture.findIndex(n => normalizeEmail(n.email) === email);
  const ip = (event.headers['x-forwarded-for'] || '').split(',')[0].trim()
          || event.headers['x-nf-client-connection-ip'] || '';
  const ua = (event.headers['user-agent'] || '').slice(0, 200);

  const entry = {
    email,
    name: String(body.name || '').slice(0, 80).trim(),
    source: String(body.source || 'unknown').slice(0, 80),
    referrer: String(body.referrer || event.headers.referer || '').slice(0, 300),
    ip,
    ua,
    lastSeenAt: now,
  };

  let isNew = false;
  if (idx >= 0) {
    db.nurture[idx] = { ...db.nurture[idx], ...entry, addedAt: db.nurture[idx].addedAt || now };
  } else {
    isNew = true;
    db.nurture.unshift({ ...entry, addedAt: now });
  }
  if (db.nurture.length > 20000) db.nurture = db.nurture.slice(0, 20000);

  await writeDB(db);

  // Only fire welcome email for genuinely new signups
  let welcomeSent = false;
  if (isNew) welcomeSent = await sendThankYou(email, { name: entry.name, source: entry.source });

  return json(200, { ok: true, isNew, welcomeSent });
};
