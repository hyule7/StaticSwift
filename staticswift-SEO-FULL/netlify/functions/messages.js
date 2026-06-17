/*
 * messages.js — the "Message me" thread system. Powers the widget on the
 * homepage (and links in outreach) and the Messages tab in the admin.
 *
 *   POST (public, no auth)  { name, email, message, page }
 *       -> creates or appends a thread, emails Harry a heads-up.
 *   GET  (admin)            -> all threads, newest first.
 *   POST (admin) { action:'reply', id, body }
 *       -> appends Harry's reply AND emails it to the visitor.
 *   POST (admin) { action:'read', id }  -> marks a thread read.
 *
 * Threads live in Blobs store "messages", key "threads". Each:
 *   { id, name, email, page, createdAt, lastAt, unread, messages:[{from,body,at}] }
 */
const { getNamedStore } = require('./_blobs');
const KEY = 'threads';
const isEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim());
const esc = s => String(s == null ? '' : s).replace(/[<>]/g, '');

async function notify(subject, text) {
  try {
    const { createTransporter } = require('./_mailer');
    const t = createTransporter();
    const from = process.env.SMTP_USER || 'hello@staticswift.co.uk';
    await t.sendMail({ from: '"StaticSwift" <' + from + '>', to: from, subject, text });
  } catch (_) {}
}
async function emailVisitor(to, body) {
  const { createTransporter } = require('./_mailer');
  const t = createTransporter();
  const from = process.env.SMTP_USER || 'hello@staticswift.co.uk';
  await t.sendMail({
    from: '"Harry at StaticSwift" <' + from + '>',
    to, replyTo: from,
    subject: 'Re: your message to StaticSwift',
    text: body + '\n\nHarry\nStaticSwift, Manchester\nReply to this email and it comes straight to me.',
  });
}

exports.handler = async (event) => {
  const store = getNamedStore('messages');
  const isAdmin = process.env.ADMIN_PASSWORD && event.headers['x-admin-password'] === process.env.ADMIN_PASSWORD;

  // ── GET: admin lists threads ───────────────────────────────────────────
  if (event.httpMethod === 'GET') {
    if (!isAdmin) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    const threads = (store && (await store.get(KEY, { type: 'json' }))) || [];
    threads.sort((a, b) => (b.lastAt || '').localeCompare(a.lastAt || ''));
    return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify({ ok: true, threads, unread: threads.filter(t => t.unread).length }) };
  }

  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!store) return { statusCode: 200, body: JSON.stringify({ ok: false, reason: 'Messaging store unavailable (set NETLIFY_AUTH_TOKEN).' }) };

  let p = {}; try { p = JSON.parse(event.body || '{}'); } catch {}
  const threads = (await store.get(KEY, { type: 'json' })) || [];
  const now = new Date().toISOString();

  // ── Admin actions ──────────────────────────────────────────────────────
  if (p.action === 'reply' || p.action === 'read') {
    if (!isAdmin) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    const th = threads.find(t => t.id === p.id);
    if (!th) return { statusCode: 404, body: JSON.stringify({ error: 'Thread not found' }) };
    if (p.action === 'read') { th.unread = false; await store.setJSON(KEY, threads); return { statusCode: 200, body: JSON.stringify({ ok: true }) }; }
    // reply
    const body = String(p.body || '').trim();
    if (!body) return { statusCode: 400, body: JSON.stringify({ error: 'Empty reply' }) };
    let emailed = false, emailError = null;
    if (isEmail(th.email)) { try { await emailVisitor(th.email, body); emailed = true; } catch (e) { emailError = e.message; } }
    th.messages.push({ from: 'us', body, at: now });
    th.lastAt = now; th.unread = false;
    await store.setJSON(KEY, threads);
    return { statusCode: 200, body: JSON.stringify({ ok: true, emailed, emailError }) };
  }

  // ── Public: a visitor sends a message ───────────────────────────────────
  const name = esc(p.name).slice(0, 80) || 'Someone';
  const email = String(p.email || '').trim().slice(0, 120);
  const message = esc(p.message).slice(0, 4000).trim();
  if (!message) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Please write a message.' }) };
  if (!isEmail(email)) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Please add a valid email so I can reply.' }) };

  // Append to an existing open thread for this email, or start a new one.
  let th = threads.find(t => (t.email || '').toLowerCase() === email.toLowerCase());
  if (!th) {
    th = { id: 'm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, email, page: esc(p.page).slice(0, 200), createdAt: now, lastAt: now, unread: true, messages: [] };
    threads.unshift(th);
  }
  th.messages.push({ from: 'them', body: message, at: now });
  th.lastAt = now; th.unread = true; if (name && name !== 'Someone') th.name = name;
  if (threads.length > 2000) threads.length = 2000;
  await store.setJSON(KEY, threads);

  await notify('New message from ' + name + ' (' + email + ')', message + '\n\nReply in the admin Messages tab.');

  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, message: 'Thanks, that is with Harry. He replies by email, usually within the hour during UK working hours.' }) };
};
