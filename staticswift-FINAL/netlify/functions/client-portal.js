const { getClients } = require('./_db');

exports.handler = async (event) => {
  const uuid = event.queryStringParameters?.uuid
    || event.path.replace(/.*\/client\/?/, '').replace(/\//g, '').trim();

  if (!uuid) return { statusCode: 400, headers: { 'Content-Type': 'text/html' }, body: errorPage('No portal ID provided.') };

  try {
    const clients = await getClients();
    const client = clients.find(c => c.portalUUID === uuid);
    if (!client) return { statusCode: 404, headers: { 'Content-Type': 'text/html' }, body: errorPage('This link has expired or does not exist.') };
    return { statusCode: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' }, body: buildPortal(client, uuid) };
  } catch (err) {
    console.error('[client-portal]', err.message);
    return { statusCode: 500, headers: { 'Content-Type': 'text/html' }, body: errorPage('Something went wrong. Contact support@staticswift.co.uk') };
  }
};

function errorPage(msg) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>StaticSwift</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{background:#07090f;color:#f0f2f8;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:24px}h2{margin-bottom:12px}p{color:#8890a8;font-size:15px;margin-top:8px}a{color:#00C8E0}</style></head>
  <body><div><h2>Portal not found</h2><p>${e(msg)}</p><p><a href="mailto:support@staticswift.co.uk">support@staticswift.co.uk</a></p></div></body></html>`;
}

function buildPortal(c, uuid) {
  const stage = c.stage || 'new-lead';
  const hasPreview = !!c.previewUrl;
  const hasFinal = !!c.finalUrl;
  const isPaid = stage === 'paid' || stage === 'complete' || !!c.paid;
  const isInvoiced = stage === 'invoice-sent' || isPaid;
  const isApproved = stage === 'approved' || isInvoiced;
  const awaitingReview = hasPreview && !isApproved;
  const messages = Array.isArray(c.portalMessages) ? c.portalMessages : [];

  return `<!DOCTYPE html>
<html lang="en-gb">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${e(c.business_name || c.name)} — StaticSwift Portal</title>
<meta name="robots" content="noindex,nofollow">
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:#07090f;color:#f0f2f8;font-family:'DM Sans',sans-serif;min-height:100vh;display:flex;flex-direction:column}
a{color:#00C8E0;text-decoration:none}
header{background:#0d1018;border-bottom:1px solid rgba(255,255,255,.07);padding:16px 24px;display:flex;align-items:center;justify-content:space-between}
.logo{font-family:'Syne',sans-serif;font-weight:800;font-size:17px}.logo span{color:#00C8E0}
.wrap{max-width:680px;margin:0 auto;padding:40px 20px 64px;flex:1;width:100%}
h1{font-family:'Syne',sans-serif;font-size:22px;font-weight:800;margin-bottom:6px}
.sub{color:#8890a8;font-size:14px;margin-bottom:28px;line-height:1.6}
.card{background:#111420;border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:22px;margin-bottom:14px}
.card-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#8890a8;margin-bottom:14px}
.badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;margin-bottom:14px}
.b-amber{background:rgba(251,191,36,.12);color:#fbbf24;border:1px solid rgba(251,191,36,.2)}
.b-cyan{background:rgba(0,200,224,.12);color:#00C8E0;border:1px solid rgba(0,200,224,.2)}
.b-green{background:rgba(34,197,94,.12);color:#22c55e;border:1px solid rgba(34,197,94,.2)}
.b-red{background:rgba(248,113,113,.12);color:#f87171;border:1px solid rgba(248,113,113,.2)}
iframe{width:100%;height:400px;border:1px solid rgba(255,255,255,.08);border-radius:10px;display:block;background:#0d1018}
.btn{display:block;width:100%;padding:13px;border-radius:9px;font-size:14px;font-weight:700;text-align:center;cursor:pointer;border:none;font-family:'DM Sans',sans-serif;transition:opacity .15s;margin-bottom:8px}
.btn-primary{background:#00C8E0;color:#07090f}.btn-primary:hover{opacity:.85}
.btn-ghost{background:transparent;color:#00C8E0;border:1.5px solid rgba(0,200,224,.4)}.btn-ghost:hover{border-color:#00C8E0}
.btn-red{background:transparent;color:#f87171;border:1.5px solid rgba(248,113,113,.3)}.btn-red:hover{border-color:#f87171}
.btn:disabled{opacity:.4;cursor:not-allowed}
.area{margin-top:12px;display:none}
textarea{width:100%;background:#0a0d16;border:1px solid rgba(255,255,255,.1);border-radius:8px;color:#f0f2f8;font-family:'DM Sans',sans-serif;font-size:14px;padding:12px;resize:vertical;min-height:90px;line-height:1.6}
textarea:focus{outline:none;border-color:#00C8E0}
.flash{margin-top:12px;padding:12px 16px;border-radius:8px;font-size:14px;line-height:1.5;display:none}
.flash-ok{background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.25);color:#22c55e}
.flash-err{background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.25);color:#f87171}
.thread{margin-top:16px}
.msg-bubble{padding:12px 16px;border-radius:10px;font-size:13px;line-height:1.6;margin-bottom:10px}
.msg-client{background:rgba(0,200,224,.08);border:1px solid rgba(0,200,224,.15)}
.msg-admin{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)}
.msg-meta{font-size:11px;color:#8890a8;margin-bottom:5px;font-weight:600;text-transform:uppercase;letter-spacing:.04em}
.support-bar{background:rgba(0,200,224,.05);border:1px solid rgba(0,200,224,.1);border-radius:10px;padding:14px 18px;font-size:13px;color:#8890a8;text-align:center;margin-top:6px}
.support-bar a{font-weight:600;color:#00C8E0}
footer{padding:20px;text-align:center;font-size:12px;color:#4a5068;border-top:1px solid rgba(255,255,255,.05)}
</style>
</head>
<body>
<header>
  <span class="logo">STATIC<span>SWIFT</span></span>
  <span style="font-size:12px;color:#8890a8">${e(c.business_name || '')}</span>
</header>
<div class="wrap">
  <h1>Hi, ${e(c.name || c.business_name)}.</h1>
  <p class="sub">Your private StaticSwift project portal. Bookmark this page — everything about your project lives here.</p>

  ${/* STATUS CARD */
    isPaid && hasFinal ? `
  <div class="card">
    <div class="card-title">Project complete</div>
    <span class="badge b-green">✓ Paid &amp; delivered</span>
    <p style="font-size:14px;color:#8890a8;margin-bottom:16px">Your website files have been delivered. Download them below.</p>
    <a href="${e(c.finalUrl)}" class="btn btn-primary" download>Download your website files</a>
    <a href="https://staticswift.co.uk/how-to-upload.html" target="_blank" class="btn btn-ghost">Upload guide ↗</a>
  </div>` :

    isPaid ? `
  <div class="card">
    <div class="card-title">Project status</div>
    <span class="badge b-green">Paid — preparing your files</span>
    <p style="font-size:14px;color:#8890a8">Payment received. Your files will be delivered within 1 hour.</p>
  </div>` :

    isInvoiced ? `
  <div class="card">
    <div class="card-title">Invoice</div>
    <span class="badge b-cyan">Invoice sent — awaiting payment</span>
    <p style="font-size:14px;color:#8890a8;margin-bottom:16px">Your invoice has been sent to ${e(c.delivery_email)}. Pay to receive your files within 1 hour.</p>
    <p style="font-size:13px;color:#8890a8">Can't find the invoice email? Check spam, or contact us below.</p>
  </div>` :

    awaitingReview ? `
  <div class="card">
    <div class="card-title">Your website preview</div>
    <span class="badge b-cyan">Ready for review</span>
    <iframe src="${e(c.previewUrl)}" loading="lazy" title="Preview" sandbox="allow-same-origin allow-scripts allow-forms"></iframe>
    <a href="${e(c.previewUrl)}" target="_blank" style="font-size:13px;color:#00C8E0;display:inline-block;margin:10px 0 18px">Open in new tab ↗</a>
    <p style="font-size:13px;color:#8890a8;margin-bottom:14px">Check on desktop and mobile. Then let us know:</p>
    <button class="btn btn-primary" id="btn-approve" onclick="show('approve')">Looks great — approve it ✓</button>
    <button class="btn btn-red" id="btn-changes" onclick="show('changes')">Request changes</button>
    <div class="area" id="area-approve">
      <textarea id="txt-approve" placeholder="Any final comments? (optional)"></textarea>
      <button class="btn btn-primary" style="margin-top:8px" onclick="send('approve')">Confirm approval</button>
    </div>
    <div class="area" id="area-changes">
      <textarea id="txt-changes" placeholder="Describe what you'd like changed..."></textarea>
      <button class="btn btn-ghost" style="margin-top:8px" onclick="send('changes')">Send change request</button>
    </div>
    <div class="flash flash-ok" id="flash-ok"></div>
    <div class="flash flash-err" id="flash-err"></div>
  </div>` :

    isApproved ? `
  <div class="card">
    <div class="card-title">Project status</div>
    <span class="badge b-cyan">Approved — invoice coming shortly</span>
    <p style="font-size:14px;color:#8890a8">Your preview is approved. Invoice is on its way.</p>
  </div>` :

    hasPreview ? `
  <div class="card">
    <div class="card-title">Your website preview</div>
    <span class="badge b-amber">Awaiting your review</span>
    <iframe src="${e(c.previewUrl)}" loading="lazy" title="Preview" sandbox="allow-same-origin allow-scripts allow-forms"></iframe>
    <a href="${e(c.previewUrl)}" target="_blank" style="font-size:13px;color:#00C8E0;display:inline-block;margin:10px 0 18px">Open in new tab ↗</a>
    <p style="font-size:13px;color:#8890a8;margin-bottom:14px">Use the message box below if you have questions.</p>
  </div>` :

  `<div class="card">
    <div class="card-title">Project status</div>
    <span class="badge b-amber">In progress</span>
    <p style="font-size:14px;color:#8890a8;line-height:1.6">Your website is being built. You will get an email when your preview is ready — usually within 24 hours.</p>
  </div>`}

  ${/* MESSAGE THREAD */
  messages.length > 0 ? `
  <div class="card">
    <div class="card-title">Messages</div>
    <div class="thread">
      ${messages.map(m => `
        <div class="msg-bubble ${m.from === 'client' ? 'msg-client' : 'msg-admin'}">
          <div class="msg-meta">${m.from === 'client' ? (c.name || 'You') : 'StaticSwift'} &nbsp;·&nbsp; ${new Date(m.sentAt).toLocaleDateString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</div>
          <div>${e(m.notes || m.text || '').replace(/\n/g, '<br>')}</div>
        </div>`).join('')}
    </div>
  </div>` : ''}

  ${/* MESSAGE BOX - always shown */`
  <div class="card">
    <div class="card-title">Send us a message</div>
    <textarea id="txt-message" placeholder="Ask a question or leave a note for us..."></textarea>
    <button class="btn btn-ghost" style="margin-top:10px" onclick="send('message')">Send message</button>
    <div class="flash flash-ok" id="flash-msg-ok">Message sent. We will reply within a few hours.</div>
    <div class="flash flash-err" id="flash-msg-err"></div>
  </div>`}

  <div class="support-bar">Questions? <a href="mailto:support@staticswift.co.uk">support@staticswift.co.uk</a> — always a real person.</div>
</div>
<footer>StaticSwift — staticswift.co.uk</footer>

<script>
const UUID = '${uuid}';

function show(type) {
  ['approve','changes'].forEach(t => {
    const a = document.getElementById('area-' + t);
    if (a) a.style.display = 'none';
  });
  const el = document.getElementById('area-' + type);
  if (el) el.style.display = 'block';
}

async function send(type) {
  let notes = '';
  let btn;
  if (type === 'approve') {
    notes = (document.getElementById('txt-approve') || {}).value || '';
    btn = document.querySelector('#area-approve .btn');
  } else if (type === 'changes') {
    notes = (document.getElementById('txt-changes') || {}).value || '';
    if (!notes.trim()) { flash('err', 'Please describe what you would like changed.'); return; }
    btn = document.querySelector('#area-changes .btn');
  } else if (type === 'message') {
    notes = (document.getElementById('txt-message') || {}).value || '';
    if (!notes.trim()) { flash('msg-err', 'Please write a message first.'); return; }
    btn = document.querySelector('[onclick="send(\'message\')"]');
  }

  if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }

  try {
    const r = await fetch('/.netlify/functions/portal-response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ portalUUID: UUID, type, notes }),
    });
    const d = await r.json();

    if (d.ok) {
      if (type === 'approve') {
        document.getElementById('area-approve').style.display = 'none';
        document.getElementById('btn-approve').style.display = 'none';
        document.getElementById('btn-changes').style.display = 'none';
        flash('ok', 'Approved! Your invoice is on its way. Thank you.');
      } else if (type === 'changes') {
        document.getElementById('area-changes').style.display = 'none';
        document.getElementById('btn-approve').style.display = 'none';
        document.getElementById('btn-changes').style.display = 'none';
        flash('ok', 'Change request received. We will have an update ready within 24 hours.');
      } else if (type === 'message') {
        document.getElementById('txt-message').value = '';
        document.getElementById('flash-msg-ok').style.display = 'block';
        if (btn) { btn.disabled = false; btn.textContent = 'Send message'; }
      }
    } else {
      const errId = type === 'message' ? 'flash-msg-err' : 'err';
      flash(errId, d.error || 'Something went wrong. Please email support@staticswift.co.uk');
      if (btn) { btn.disabled = false; btn.textContent = type === 'approve' ? 'Confirm approval' : type === 'changes' ? 'Send change request' : 'Send message'; }
    }
  } catch(err) {
    flash('err', 'Network error. Please email support@staticswift.co.uk');
    if (btn) { btn.disabled = false; }
  }
}

function flash(id, msg) {
  const el = document.getElementById('flash-' + id);
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}
</script>
</body>
</html>`;
}

function e(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
