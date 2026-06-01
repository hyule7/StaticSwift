/*
 * unsubscribe.js
 * ---------------------------------------------------------------
 * Public endpoint (NO auth) — handles List-Unsubscribe clicks and
 * the One-Click POST that Gmail / Outlook / Apple Mail fire when a
 * recipient hits the inbox-native unsubscribe button.
 *
 * GET  /.netlify/functions/unsubscribe?e=foo@bar.com&t=<token>
 *   → adds email to suppression list, returns a styled "done" page.
 *
 * POST /.netlify/functions/unsubscribe (form body e=&t=) — the
 *   one-click variant from gmail/yahoo per RFC 8058.
 *
 * Tokens are HMACs of the email under UNSUB_SECRET — see _suppression.js.
 * If the token is missing or wrong we STILL accept the unsub (better
 * to over-suppress than spam someone who clicked unsub), but log it
 * as `token=invalid` so we can audit abuse.
 */

const { addSuppression, verifyToken, normalizeEmail } = require('./_suppression');

function htmlPage({ ok, email, source, reason }) {
  const safeEmail = String(email || '').replace(/[<>&"]/g, '');
  const safeSource = String(source || '').replace(/[<>&"]/g, '').slice(0, 60);
  const headline = ok ? "You're unsubscribed." : 'Something went wrong.';
  const sub = ok
    ? "We won't email " + (safeEmail || 'this address') + ' again. If you changed your mind, just reply to any past email — we read everything personally.'
    : 'Please email <a href="mailto:hello@staticswift.co.uk" style="color:#b08a3e">hello@staticswift.co.uk</a> and we will remove you by hand.';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Unsubscribed — StaticSwift</title>
<meta name="robots" content="noindex">
<style>
:root{--ink:#0a0a0a;--paper:#faf7f1;--muted:#5e5e5e;--gold:#b08a3e;--line:rgba(0,0,0,.08)}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Inter",Helvetica,Arial,sans-serif;background:var(--paper);color:var(--ink);line-height:1.6;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;-webkit-font-smoothing:antialiased}
.wrap{max-width:520px;width:100%;background:#fff;border:1px solid var(--line);border-radius:18px;padding:48px 36px;box-shadow:0 24px 64px rgba(0,0,0,.06);text-align:center}
.mark{width:64px;height:64px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:30px;margin-bottom:22px;${ok ? 'background:rgba(22,163,74,.12);color:#16a34a' : 'background:rgba(220,38,38,.1);color:#dc2626'}}
h1{font-size:26px;letter-spacing:-.02em;margin-bottom:12px;font-weight:600}
p{color:var(--muted);font-size:15px;margin-bottom:18px}
.email{background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:10px 14px;display:inline-block;font-size:13px;color:var(--ink);font-family:ui-monospace,Menlo,monospace;margin:6px 0 18px}
.foot{margin-top:28px;padding-top:20px;border-top:1px solid var(--line);font-size:12px;color:#999}
.foot a{color:var(--gold);text-decoration:none}
</style></head>
<body>
<main class="wrap">
  <div class="mark">${ok ? '✓' : '!'}</div>
  <h1>${headline}</h1>
  ${safeEmail ? '<div class="email">' + safeEmail + '</div>' : ''}
  <p>${sub}</p>
  <div class="foot">
    StaticSwift &middot; <a href="https://staticswift.co.uk">staticswift.co.uk</a>
    ${safeSource ? '<br><span style="opacity:.55">ref: ' + safeSource + '</span>' : ''}
  </div>
</main>
</body></html>`;
}

function parseParams(event) {
  const out = { ...(event.queryStringParameters || {}) };
  if (event.httpMethod === 'POST' && event.body) {
    const ct = (event.headers['content-type'] || event.headers['Content-Type'] || '').toLowerCase();
    try {
      if (ct.includes('application/json')) {
        Object.assign(out, JSON.parse(event.body));
      } else {
        // application/x-www-form-urlencoded (the One-Click case)
        const params = new URLSearchParams(event.body);
        for (const [k, v] of params) out[k] = v;
      }
    } catch { /* ignore — fall back to query string */ }
  }
  return out;
}

exports.handler = async (event) => {
  const params = parseParams(event);
  const email = normalizeEmail(params.e || params.email || '');
  const token = params.t || params.token || '';
  const source = params.s || params.source || 'unsub-link';

  // One-Click POST (RFC 8058) MUST respond 200 quickly and machine-readable.
  const isOneClick = event.httpMethod === 'POST'
    && String(event.headers['list-unsubscribe'] || event.headers['List-Unsubscribe'] || '').includes('One-Click')
    || (event.body && /List-Unsubscribe=One-Click/i.test(event.body));

  if (!email) {
    if (isOneClick) return { statusCode: 400, body: 'missing email' };
    return { statusCode: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' }, body: htmlPage({ ok: false }) };
  }

  const tokenOk = verifyToken(email, token);
  // We accept ANY unsub click — but log token validity so we can audit.
  let added = false;
  try {
    const result = await addSuppression(email, {
      reason: 'user_clicked_unsubscribe',
      source: source + (tokenOk ? '' : '?invalid-token'),
    });
    added = !!result.ok;
  } catch (err) {
    console.error('[unsubscribe] failed to add suppression:', err.message);
  }

  if (isOneClick) {
    // Gmail/Outlook expect a quick 200 with no body for one-click
    return { statusCode: 200, body: '' };
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
    body: htmlPage({ ok: added, email, source }),
  };
};
