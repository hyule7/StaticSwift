/*
 * _suppression.js
 * ---------------------------------------------------------------
 * Single source of truth for "do not email" checks.
 *
 * Anyone who:
 *   • clicks an unsubscribe link
 *   • replies STOP / UNSUBSCRIBE / REMOVE / OPT OUT
 *   • hard-bounces
 *   • is on a global manual block list
 * gets added to `db.suppression`, a flat array of
 *   { email, reason, addedAt, source }
 * and a parallel domain block list `db.suppressionDomains`
 * for whole-domain blocks (e.g. competitor groups).
 *
 * This must be checked BEFORE every outbound cold email and every
 * follow-up. If it isn't, you'll lose your sending reputation and
 * land in legal trouble in PECR / CAN-SPAM / GDPR territories.
 *
 * Tokens: each prospect gets a deterministic HMAC unsubscribe token
 * so the unsubscribe URL can't be guessed/forged.
 */

const crypto = require('crypto');
const { readDB, writeDB } = require('./_db');

const TOKEN_SECRET = process.env.UNSUB_SECRET || process.env.ADMIN_PASSWORD || 'staticswift-unsub';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function domainOf(email) {
  const e = normalizeEmail(email);
  const at = e.indexOf('@');
  return at >= 0 ? e.slice(at + 1) : '';
}

/** Deterministic per-email unsubscribe token (HMAC, 16 chars). Email always lowercased. */
function unsubToken(email) {
  return crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(normalizeEmail(email))
    .digest('hex')
    .slice(0, 16);
}

function verifyToken(email, token) {
  if (!token) return false;
  const expected = unsubToken(email);
  // constant-time compare
  if (expected.length !== token.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
  } catch {
    return false;
  }
}

/** Build the canonical unsubscribe URL for outbound email footers. */
function unsubUrl(email, source) {
  const e = normalizeEmail(email);
  const t = unsubToken(e);
  const qs = new URLSearchParams({ e, t });
  if (source) qs.set('s', source);
  return 'https://staticswift.co.uk/.netlify/functions/unsubscribe?' + qs.toString();
}

async function loadSuppression() {
  const db = await readDB();
  return {
    db,
    emails: new Set((db.suppression || []).map(s => normalizeEmail(s.email)).filter(Boolean)),
    domains: new Set((db.suppressionDomains || []).map(d => String(d || '').trim().toLowerCase()).filter(Boolean)),
    list: Array.isArray(db.suppression) ? db.suppression : [],
  };
}

/** True if this email (or its domain) is on the suppression list. */
async function isSuppressed(email) {
  const e = normalizeEmail(email);
  if (!e) return false;
  const { emails, domains } = await loadSuppression();
  if (emails.has(e)) return true;
  if (domains.has(domainOf(e))) return true;
  return false;
}

/** Add an email to the suppression list. Idempotent — never duplicates. */
async function addSuppression(email, { reason = 'unspecified', source = 'manual', prospectId = null } = {}) {
  const e = normalizeEmail(email);
  if (!e) return { ok: false, error: 'no email' };
  const db = await readDB();
  if (!Array.isArray(db.suppression)) db.suppression = [];
  const idx = db.suppression.findIndex(s => normalizeEmail(s.email) === e);
  const entry = {
    email: e,
    reason,
    source,
    addedAt: new Date().toISOString(),
  };
  if (prospectId) entry.prospectId = prospectId;
  if (idx >= 0) {
    // Keep oldest addedAt, update reason history
    db.suppression[idx] = { ...db.suppression[idx], ...entry, addedAt: db.suppression[idx].addedAt };
  } else {
    db.suppression.unshift(entry);
  }
  // Cap to last 50k to keep the bin compact
  if (db.suppression.length > 50000) db.suppression = db.suppression.slice(0, 50000);
  await writeDB(db);
  return { ok: true, added: idx < 0, email: e };
}

/** Detect explicit unsubscribe intent in a reply body (run after fetch-inbox parses). */
function isUnsubReply(text) {
  if (!text) return false;
  const t = String(text).toLowerCase().slice(0, 500);
  // Word-boundary match — avoid false-positives like "stopover"
  return /\b(unsubscribe|opt[- ]?out|remove me|take me off|do not (email|contact)|stop emailing|stop contacting)\b/.test(t)
      || /^\s*(stop|remove|unsubscribe)\b/.test(t);
}

module.exports = {
  normalizeEmail,
  domainOf,
  unsubToken,
  verifyToken,
  unsubUrl,
  isSuppressed,
  addSuppression,
  loadSuppression,
  isUnsubReply,
};
