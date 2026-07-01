/*
 * partners.js — the commission-only partner (affiliate) portal backend.
 *
 * Public (no admin auth):
 *   POST {action:'signup', name, email}     -> create partner, email their link + key
 *   POST {action:'login',  email, key}      -> partner dashboard data
 *   POST {action:'click',  code}            -> record a referral-link click
 *   POST {action:'message',email,key,body}  -> message Harry (shows in their portal)
 * Admin (x-admin-password):
 *   GET                                      -> all partners + totals
 *   POST {action:'credit', id, client, fee, status}  -> log a referral
 *   POST {action:'setstatus', id, refIndex, status} -> mark a referral live/paid
 *   POST {action:'reply', id, body}          -> reply to a partner, emails them
 *
 * Store: Blobs "partners", key "list". Keys/tokens are low-stakes affiliate
 * access, compared directly (no password hashing dependency).
 */
const { getNamedStore } = require('./_blobs');
const KEY = 'list';
const FEE = Number(process.env.AFFILIATE_FEE || 100);
const SITE = process.env.URL || 'https://staticswift.co.uk';
const isEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim());
const esc = s => String(s == null ? '' : s).replace(/[<>]/g, '');
const rnd = n => require('crypto').randomBytes(n).toString('base64url').slice(0, n);
const codeFrom = name => (String(name || 'partner').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'partner') + rnd(4).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 4);

async function mail(to, subject, text) {
  try {
    const { createTransporter } = require('./_mailer');
    const t = createTransporter();
    const from = process.env.SMTP_USER || 'hello@staticswift.co.uk';
    await t.sendMail({ from: '"Harry at StaticSwift" <' + from + '>', to, replyTo: from, subject, text });
    return true;
  } catch (_) { return false; }
}
function dueOf(p) { return (p.referrals || []).filter(r => r.status === 'live' && !r.paid).reduce((s, r) => s + (Number(r.fee) || FEE), 0); }
function paidOf(p) { return (p.referrals || []).filter(r => r.paid).reduce((s, r) => s + (Number(r.fee) || FEE), 0); }
function publicView(p) {
  return {
    name: p.name, email: p.email, code: p.code, link: SITE + '/?ref=' + p.code,
    clicks: p.clicks || 0,
    referrals: (p.referrals || []).map(r => ({ client: r.client, status: r.status, fee: Number(r.fee) || FEE, paid: !!r.paid, at: r.at })),
    due: dueOf(p), paid: paidOf(p), feePerReferral: FEE,
    messages: p.messages || [],
  };
}

exports.handler = async (event) => {
  const store = getNamedStore('partners');
  const isAdmin = process.env.ADMIN_PASSWORD && event.headers['x-admin-password'] === process.env.ADMIN_PASSWORD;

  if (event.httpMethod === 'GET') {
    if (!isAdmin) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    const list = (store && (await store.get(KEY, { type: 'json' }))) || [];
    const rows = list.map(p => ({ id: p.id, name: p.name, email: p.email, code: p.code, clicks: p.clicks || 0, referrals: (p.referrals || []).length, due: dueOf(p), paid: paidOf(p), unread: (p.messages || []).some(m => m.from === 'them' && !m.read), messages: p.messages || [], refs: p.referrals || [] }));
    return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify({ ok: true, partners: rows, totals: { partners: rows.length, due: rows.reduce((s, r) => s + r.due, 0), paid: rows.reduce((s, r) => s + r.paid, 0), clicks: rows.reduce((s, r) => s + r.clicks, 0) } }) };
  }

  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!store) return { statusCode: 200, body: JSON.stringify({ ok: false, error: 'Partner store unavailable (set NETLIFY_AUTH_TOKEN).' }) };
  let p = {}; try { p = JSON.parse(event.body || '{}'); } catch {}
  const list = (await store.get(KEY, { type: 'json' })) || [];
  const now = new Date().toISOString();

  // ── Click tracking (public) ─────────────────────────────────────────────
  if (p.action === 'click') {
    const code = String(p.code || '').toLowerCase().slice(0, 40);
    const partner = list.find(x => x.code === code);
    if (partner) { partner.clicks = (partner.clicks || 0) + 1; partner.lastClickAt = now; await store.setJSON(KEY, list); }
    return { statusCode: 200, headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify({ ok: true }) };
  }

  // ── Signup (public) ─────────────────────────────────────────────────────
  if (p.action === 'signup') {
    const name = esc(p.name).slice(0, 80) || 'Partner';
    const email = String(p.email || '').trim().slice(0, 120);
    if (!isEmail(email)) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Please enter a valid email.' }) };
    let partner = list.find(x => (x.email || '').toLowerCase() === email.toLowerCase());
    if (!partner) {
      partner = { id: 'p_' + Date.now().toString(36) + rnd(4), name, email, code: codeFrom(name), key: rnd(12), createdAt: now, clicks: 0, referrals: [], messages: [] };
      list.unshift(partner);
      await store.setJSON(KEY, list);
      await mail(email, 'Your StaticSwift partner link', 'Welcome aboard.\n\nYour referral link: ' + SITE + '/?ref=' + partner.code + '\nYour login key: ' + partner.key + '\n\nShare the link. You earn ' + FEE + ' pounds for every client who goes live through it. Log in any time at ' + SITE + '/partners/ to see clicks, referrals and what you are owed.\n\nHarry\nStaticSwift');
      await mail(process.env.SMTP_USER || 'hello@staticswift.co.uk', 'New partner signup: ' + name, name + ' (' + email + ') joined as a partner. Code ' + partner.code + '.');
    }
    return { statusCode: 200, body: JSON.stringify({ ok: true, key: partner.key, ...publicView(partner), message: 'You are in. Your login key has been emailed to you (and is shown here once).' }) };
  }

  // ── Login (public) ──────────────────────────────────────────────────────
  if (p.action === 'login') {
    const email = String(p.email || '').trim().toLowerCase();
    const partner = list.find(x => (x.email || '').toLowerCase() === email && x.key === String(p.key || ''));
    if (!partner) return { statusCode: 401, body: JSON.stringify({ ok: false, error: 'Email or key not recognised. Check the welcome email, or sign up again.' }) };
    // Mark partner-side messages read from Harry when they log in.
    return { statusCode: 200, body: JSON.stringify({ ok: true, ...publicView(partner) }) };
  }

  // ── Partner message (public, key-gated) ─────────────────────────────────
  if (p.action === 'message') {
    const email = String(p.email || '').trim().toLowerCase();
    const partner = list.find(x => (x.email || '').toLowerCase() === email && x.key === String(p.key || ''));
    if (!partner) return { statusCode: 401, body: JSON.stringify({ ok: false, error: 'Not authorised.' }) };
    const body = esc(p.body).slice(0, 3000).trim(); if (!body) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Empty message.' }) };
    partner.messages = partner.messages || [];
    partner.messages.push({ from: 'them', body, at: now, read: false });
    await store.setJSON(KEY, list);
    await mail(process.env.SMTP_USER || 'hello@staticswift.co.uk', 'Partner message from ' + partner.name, body + '\n\nReply in the admin Partners tab.');
    return { statusCode: 200, body: JSON.stringify({ ok: true, messages: partner.messages }) };
  }

  // ── Admin actions ───────────────────────────────────────────────────────
  if (!isAdmin) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  const partner = list.find(x => x.id === p.id);
  if (!partner) return { statusCode: 404, body: JSON.stringify({ error: 'Partner not found' }) };

  if (p.action === 'credit') {
    partner.referrals = partner.referrals || [];
    partner.referrals.push({ client: esc(p.client).slice(0, 120) || 'Referral', status: p.status === 'live' ? 'live' : 'pending', fee: Number(p.fee) || FEE, paid: false, at: now });
    await store.setJSON(KEY, list);
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }
  if (p.action === 'setstatus') {
    const r = (partner.referrals || [])[p.refIndex];
    if (r) { if (p.status === 'live') r.status = 'live'; if (p.status === 'paid') { r.paid = true; r.status = 'live'; } if (p.status === 'pending') { r.status = 'pending'; r.paid = false; } await store.setJSON(KEY, list); }
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }
  if (p.action === 'reply') {
    const body = esc(p.body).slice(0, 3000).trim(); if (!body) return { statusCode: 400, body: JSON.stringify({ error: 'Empty reply' }) };
    partner.messages = partner.messages || [];
    (partner.messages || []).forEach(m => { if (m.from === 'them') m.read = true; });
    partner.messages.push({ from: 'us', body, at: now });
    await store.setJSON(KEY, list);
    const emailed = await mail(partner.email, 'Re: your message', body + '\n\nHarry\nStaticSwift');
    return { statusCode: 200, body: JSON.stringify({ ok: true, emailed }) };
  }
  return { statusCode: 400, body: JSON.stringify({ error: 'unknown action' }) };
};
