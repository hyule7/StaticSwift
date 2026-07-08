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

  // ── Admin: start/append a CLIENT thread and send it (all outbound client
  //    email flows through here, so everything is a two-way thread in the
  //    Messages tab, and the client's reply lands back in the same thread). ──
  if (p.action === 'client-message') {
    if (!isAdmin) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    const email = String(p.email || '').trim();
    if (!isEmail(email)) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'valid client email required' }) };
    const body = String(p.body || '').trim();
    if (!body) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'empty message' }) };
    let th = threads.find(t => (t.email || '').toLowerCase() === email.toLowerCase());
    if (!th) {
      th = { id: 'm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: esc(p.name).slice(0, 80) || email, email, kind: 'client', clientId: p.clientId || null, createdAt: now, lastAt: now, unread: false, messages: [] };
      threads.unshift(th);
    } else { th.kind = th.kind === 'message' ? 'client' : th.kind; if (p.clientId) th.clientId = p.clientId; }
    let emailed = false, emailError = null;
    try { await emailVisitor(email, (p.subject ? '' : '') + body); emailed = true; } catch (e) { emailError = e.message; }
    th.messages.push({ from: 'us', body: (p.subject ? p.subject + '\n\n' : '') + body, at: now });
    th.lastAt = now;
    await store.setJSON(KEY, threads);
    return { statusCode: 200, body: JSON.stringify({ ok: true, emailed, emailError, threadId: th.id }) };
  }

  // ── Admin: pull inbound email and merge replies into their threads, so a
  //    client's reply shows up in the same conversation in the Messages tab. ──
  if (p.action === 'ingest-inbox') {
    if (!isAdmin) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    let inbox = [];
    try {
      const r = await fetch((process.env.URL || 'https://staticswift.co.uk') + '/.netlify/functions/fetch-inbox', { headers: { 'x-admin-password': process.env.ADMIN_PASSWORD } });
      if (r.ok) inbox = await r.json();
    } catch (_) {}
    if (!Array.isArray(inbox)) inbox = [];
    const emailOf = s => { const m = String(s || '').match(/[^\s<>"]+@[^\s<>"]+/); return m ? m[0].toLowerCase().replace(/[>",]+$/, '') : ''; };
    const byEmail = {}; threads.forEach(t => { if (t.email) byEmail[t.email.toLowerCase()] = t; });
    let added = 0;
    for (const m of inbox) {
      const from = emailOf(m.from); if (!from) continue;
      const th = byEmail[from]; if (!th) continue;                 // only merge into existing threads
      th.seenIds = th.seenIds || [];
      if (th.seenIds.includes(m.id)) continue;                     // dedupe
      th.seenIds.push(m.id); if (th.seenIds.length > 200) th.seenIds = th.seenIds.slice(-200);
      const body = String(m.text || m.snippet || m.subject || '').slice(0, 4000).trim();
      if (!body) continue;
      th.messages.push({ from: 'them', body, at: m.date || now });
      th.lastAt = m.date || now; th.unread = true; added++;
    }
    if (added) await store.setJSON(KEY, threads);
    return { statusCode: 200, headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify({ ok: true, added }) };
  }

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

  // ── Public: a visitor sends a message / claims a preview / books a call ──
  // kind: 'message' (default) | 'claim' (Make this mine) | 'booking' (call).
  const kind = ['claim', 'booking'].includes(p.kind) ? p.kind : 'message';
  const name = esc(p.name).slice(0, 80) || 'Someone';
  const email = String(p.email || '').trim().slice(0, 120);
  const phone = esc(p.phone).slice(0, 40).trim();
  const business = esc(p.business).slice(0, 120).trim();
  const slot = esc(p.slot).slice(0, 80).trim();          // preferred call time (booking)
  const previewUrl = String(p.previewUrl || '').slice(0, 400);
  // A claim/booking is high intent: a phone OR email is enough. A message needs email.
  if (kind === 'message' && !esc(p.message).trim()) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Please write a message.' }) };
  if (!isEmail(email) && !phone) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Please leave an email or a phone number so Harry can reach you.' }) };

  const body = kind === 'claim'
    ? ('YES, I want this website' + (business ? ' for ' + business : '') + '.' + (esc(p.message) ? ' ' + esc(p.message).slice(0, 2000) : ''))
    : kind === 'booking'
      ? ('Booking a call' + (slot ? ', best time: ' + slot : '') + '.' + (esc(p.message) ? ' ' + esc(p.message).slice(0, 2000) : ''))
      : esc(p.message).slice(0, 4000).trim();

  // Match an existing thread by email or phone; else start a new one.
  const key = (email || phone).toLowerCase();
  let th = threads.find(t => ((t.email || '').toLowerCase() === key) || (phone && t.phone === phone));
  if (!th) {
    th = { id: 'm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, email, phone, business, kind, page: esc(p.page).slice(0, 200), previewUrl, createdAt: now, lastAt: now, unread: true, hot: kind !== 'message', messages: [] };
    threads.unshift(th);
  } else {
    if (phone && !th.phone) th.phone = phone;
    if (business && !th.business) th.business = business;
    if (previewUrl && !th.previewUrl) th.previewUrl = previewUrl;
    if (kind !== 'message') { th.hot = true; th.kind = kind; }
  }
  th.messages.push({ from: 'them', body, at: now });
  th.lastAt = now; th.unread = true; if (name && name !== 'Someone') th.name = name;
  if (threads.length > 2000) threads.length = 2000;
  await store.setJSON(KEY, threads);

  const label = kind === 'claim' ? 'PREVIEW CLAIMED' : kind === 'booking' ? 'CALL BOOKING' : 'New message';
  await notify(label + ' from ' + name + (business ? ' (' + business + ')' : '') + (phone ? ' · ' + phone : ''),
    body + '\n\n' + (email ? 'Email: ' + email + '\n' : '') + (phone ? 'Phone: ' + phone + '\n' : '') + (previewUrl ? 'Preview: ' + previewUrl + '\n' : '') + '\nReply/act in the admin Messages tab.');

  const thanks = kind === 'claim'
    ? 'Brilliant. Harry has your details and will call or email shortly to make it live. Usually within the hour in UK working hours.'
    : kind === 'booking'
      ? 'Booked. Harry will be in touch to confirm your call. Usually within the hour in UK working hours.'
      : 'Thanks, that is with Harry. He replies by email, usually within the hour during UK working hours.';
  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, message: thanks }) };
};
