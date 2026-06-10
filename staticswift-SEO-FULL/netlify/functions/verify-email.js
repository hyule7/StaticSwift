/*
 * verify-email.js
 * ---------------------------------------------------------------
 * Verifies an email address is real by:
 *   1. Syntax check (RFC 5322-ish regex)
 *   2. Domain check (MX records exist) — uses Node's built-in dns module
 *   3. Disposable / role check (catches info@/sales@/contact@ which are valid
 *      but won't convert as well — flagged separately)
 *
 * Server-side only — DNS lookups never run in the browser.
 *
 * Returns { ok, detail, kind: "personal" | "role" | "invalid" }
 */

const dns = require('dns');
const { promisify } = require('util');
const resolveMx = promisify(dns.resolveMx);

const SYNTAX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const ROLES = new Set(['info','sales','contact','hello','admin','support','enquiries','enquiry','office','team','help','marketing','noreply','no-reply','donotreply']);
const DISPOSABLE = new Set(['mailinator.com','tempmail.com','10minutemail.com','guerrillamail.com','sharklasers.com','yopmail.com','dispostable.com','throwawaymail.com']);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const auth = event.headers['x-admin-password'];
  const validPw = process.env.ADMIN_PASSWORD;
  if (!validPw || auth !== validPw) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

  let email;
  try { ({ email } = JSON.parse(event.body || '{}')); } catch { return { statusCode: 400, body: JSON.stringify({ error: 'Bad JSON' }) }; }
  if (!email) return { statusCode: 400, body: JSON.stringify({ error: 'email required' }) };
  email = String(email).trim().toLowerCase();

  if (!SYNTAX.test(email)) {
    return { statusCode: 200, body: JSON.stringify({ ok: false, kind: 'invalid', detail: 'Bad syntax' }) };
  }
  const [local, domain] = email.split('@');
  if (DISPOSABLE.has(domain)) {
    return { statusCode: 200, body: JSON.stringify({ ok: false, kind: 'invalid', detail: 'Disposable address' }) };
  }
  try {
    const mx = await Promise.race([
      resolveMx(domain),
      new Promise((_, rej) => setTimeout(() => rej(new Error('DNS timeout')), 5000)),
    ]);
    if (!mx || !mx.length) {
      return { statusCode: 200, body: JSON.stringify({ ok: false, kind: 'invalid', detail: 'No MX records (domain can\'t receive email)' }) };
    }
    const kind = ROLES.has(local) ? 'role' : 'personal';
    const detail = kind === 'role' ? 'Role address — valid but generic' : 'Valid · ' + mx[0].exchange;
    return { statusCode: 200, body: JSON.stringify({ ok: true, kind, detail, mx: mx[0].exchange }) };
  } catch (err) {
    return { statusCode: 200, body: JSON.stringify({ ok: false, kind: 'invalid', detail: 'DNS lookup failed: ' + err.message }) };
  }
};
