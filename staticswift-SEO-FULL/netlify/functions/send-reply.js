/*
 * send-reply.js
 * ---------------------------------------------------------------
 * Outbound mailer for cold outreach AND inbox replies.
 *
 * Hardening built in (all of this used to be missing — and the
 * site was advertising unsubscribe links that 404'd, which is
 * both a deliverability and a legal problem):
 *
 *   1. Suppression check — never email an unsubscribed address.
 *   2. Tokenized unsubscribe link injected into every cold send
 *      so the One-Click button in Gmail / Outlook actually works.
 *   3. List-Unsubscribe + List-Unsubscribe-Post headers point at
 *      our real /unsubscribe endpoint (with a valid token).
 *   4. Daily send cap (SS_DAILY_SEND_CAP, default 200) to protect
 *      domain reputation when the autopilot loop goes feral.
 *   5. Per-prospect send log so we can show "sent X, opened Y"
 *      in the admin without losing data on restart.
 */

const nodemailer = require('nodemailer');
const { readDB, writeDB } = require('./_db');
const { isSuppressed, unsubUrl, unsubToken, normalizeEmail } = require('./_suppression');

const DAILY_SEND_CAP = parseInt(process.env.SS_DAILY_SEND_CAP || '200', 10);

function todayKey() {
  // YYYY-MM-DD in UTC — matches one calendar day per cap window
  return new Date().toISOString().slice(0, 10);
}

async function recordSend(toEmail) {
  // Best-effort: count outbound sends per day in the bin. If this fails
  // we still send — better to over-send a hair than drop the message.
  try {
    const db = await readDB();
    const key = todayKey();
    if (!db.sendCounters) db.sendCounters = {};
    db.sendCounters[key] = (db.sendCounters[key] || 0) + 1;
    // Trim to last 30 days so the counter map doesn't grow unbounded
    const keep = Object.keys(db.sendCounters).sort().slice(-30);
    db.sendCounters = keep.reduce((acc, k) => (acc[k] = db.sendCounters[k], acc), {});
    if (!db.sendLog) db.sendLog = [];
    db.sendLog.unshift({ to: normalizeEmail(toEmail), sentAt: new Date().toISOString() });
    if (db.sendLog.length > 5000) db.sendLog = db.sendLog.slice(0, 5000);
    await writeDB(db);
  } catch (e) {
    console.warn('[send-reply] recordSend failed:', e.message);
  }
}

async function getTodayCount() {
  try {
    const db = await readDB();
    return (db.sendCounters && db.sendCounters[todayKey()]) || 0;
  } catch {
    return 0;
  }
}

/** Inject a plain-English unsubscribe footer + tracking pixel (if prospect id). */
function buildHtmlBody(bodyText, { toEmail, prospectId, isReply }) {
  const escapeHtml = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const safeBody = escapeHtml(bodyText).replace(/\n/g, '<br>');
  const unsub = unsubUrl(toEmail, prospectId || 'reply');
  // Reply emails (mid-thread) don't need a giant unsubscribe footer — keep it light.
  const footer = isReply
    ? '<br><br><span style="color:#888;font-size:12px">StaticSwift &middot; <a href="https://staticswift.co.uk" style="color:#888">staticswift.co.uk</a></span>'
    : '<br><br><span style="color:#888;font-size:12px">' +
        'Harry Yule &middot; StaticSwift &middot; Manchester, UK<br>' +
        'Reply STOP to opt out, or <a href="' + unsub + '" style="color:#888;text-decoration:underline">unsubscribe in one click</a>.' +
      '</span>';
  const pixel = prospectId
    ? '<img src="https://staticswift.co.uk/.netlify/functions/track-open?p=' + encodeURIComponent(prospectId) + '&t=outreach" width="1" height="1" alt="" style="display:block">'
    : '';
  return '<div style="font-family:sans-serif;max-width:600px;line-height:1.6;color:#111">'
       + safeBody + footer + pixel
       + '</div>';
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const auth = event.headers['x-admin-password'];
  if (auth !== (process.env.ADMIN_PASSWORD)) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const {
      to,
      subject,
      body,
      fromMailbox,
      mode,
      inReplyTo,
      references,
      prospectId,    // optional — enables tracking pixel + better unsub source
      bypassCap,     // admin override for one-off urgent sends (replies to a prospect)
      bypassSuppression, // explicit admin override (rare — e.g. legit response to inbound)
    } = JSON.parse(event.body || '{}');

    if (!to || !body) return { statusCode: 400, body: JSON.stringify({ error: 'to and body required' }) };

    const safe = s => String(s == null ? '' : s).replace(/[\r\n]+/g, ' ').trim();
    const toAddr = safe(to);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toAddr)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'invalid to address' }) };
    }

    const isReply = mode === 'reply' || !!inReplyTo;

    // 1. Suppression check (skip only for replies to known inbound conversations)
    if (!bypassSuppression && !isReply) {
      const blocked = await isSuppressed(toAddr);
      if (blocked) {
        return {
          statusCode: 409,
          body: JSON.stringify({
            error: 'recipient on suppression list',
            blocked: true,
            email: normalizeEmail(toAddr),
          }),
        };
      }
    }

    // 2. Daily cap (cold outreach only — replies bypass)
    if (!bypassCap && !isReply) {
      const sentToday = await getTodayCount();
      if (sentToday >= DAILY_SEND_CAP) {
        return {
          statusCode: 429,
          body: JSON.stringify({
            error: 'daily send cap reached',
            cap: DAILY_SEND_CAP,
            sentToday,
            hint: 'Increase SS_DAILY_SEND_CAP env var or send replies (which bypass the cap).',
          }),
        };
      }
    }

    const rawSubject = safe(subject || '(no subject)');
    const finalSubject = !isReply
      ? rawSubject
      : (rawSubject.toLowerCase().startsWith('re:') ? rawSubject : 'Re: ' + rawSubject);

    const isSupport = fromMailbox === 'support';
    const fromAddr = isSupport
      ? (process.env.SUPPORT_SMTP_USER || 'support@staticswift.co.uk')
      : (process.env.SMTP_USER || 'hello@staticswift.co.uk');
    const fromPass = isSupport
      ? (process.env.SUPPORT_SMTP_PASS || '')
      : (process.env.SMTP_PASS || '');

    if (!fromPass) {
      return { statusCode: 500, body: JSON.stringify({ error: 'SMTP_PASS not configured for ' + (isSupport ? 'support' : 'hello') + ' mailbox' }) };
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'mail.staticswift.co.uk',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: { user: fromAddr, pass: fromPass },
      tls: { rejectUnauthorized: false },
    });

    const html = buildHtmlBody(body, { toEmail: toAddr, prospectId, isReply });

    // Headers — One-Click MUST be an https URL (not mailto) per RFC 8058 for
    // Gmail / Outlook native unsub button. Token in query so we don't have to
    // hit the DB to validate.
    const unsub = unsubUrl(toAddr, prospectId || (isReply ? 'reply' : 'outbound'));
    const mailOpts = {
      from: '"StaticSwift" <' + fromAddr + '>',
      to: toAddr,
      subject: finalSubject,
      html,
      text: body + '\n\n—\nReply STOP to opt out, or unsubscribe: ' + unsub,
      replyTo: fromAddr,
      headers: {
        'List-Unsubscribe': '<' + unsub + '>, <mailto:' + fromAddr + '?subject=unsubscribe&body=' + encodeURIComponent('Please remove ' + toAddr) + '>',
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        'X-Mailer': 'StaticSwift-Outreach/1.0',
      },
    };
    if (isReply && inReplyTo) {
      mailOpts.inReplyTo = inReplyTo;
      mailOpts.references = references || inReplyTo;
    }

    await transporter.sendMail(mailOpts);

    // Record the send for cap accounting + admin "sent today" widget
    if (!isReply) await recordSend(toAddr);

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        to: toAddr,
        subject: finalSubject,
        isReply,
        unsubToken: unsubToken(toAddr),
      }),
    };
  } catch (err) {
    console.error('[send-reply] error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
