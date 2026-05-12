const { getClients } = require('./_db');

exports.handler = async (event) => {
  // UUID can come from path (/client/XXXX) or query (?uuid=XXXX)
  const uuid = event.queryStringParameters?.uuid
    || event.path.replace(/.*\/client\/?/, '').replace(/\//g, '').trim();

  if (!uuid) {
    return { statusCode: 400, headers: { 'Content-Type': 'text/html' }, body: notFoundPage('No portal ID provided.') };
  }

  try {
    const clients = await getClients();
    const client = clients.find(c => c.portalUUID === uuid);
    if (!client) {
      return { statusCode: 404, headers: { 'Content-Type': 'text/html' }, body: notFoundPage('This portal link has expired or does not exist.') };
    }

    return { statusCode: 200, headers: { 'Content-Type': 'text/html' }, body: portalPage(client, uuid) };
  } catch (err) {
    console.error('[client-portal] error:', err.message);
    return { statusCode: 500, headers: { 'Content-Type': 'text/html' }, body: notFoundPage('Something went wrong. Please contact support@staticswift.co.uk') };
  }
};

function notFoundPage(msg) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>StaticSwift Portal</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{background:#07090f;color:#f0f2f8;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:24px}h2{margin-bottom:12px}p{color:#8890a8;font-size:15px}a{color:#00C8E0}</style></head>
  <body><div><h2>Portal not found</h2><p>${msg}</p><p style="margin-top:16px"><a href="mailto:support@staticswift.co.uk">support@staticswift.co.uk</a></p></div></body></html>`;
}

function portalPage(c, uuid) {
  const hasPreview = !!c.previewUrl;
  const isPaid = c.stage === 'paid' || c.paid;
  const isApproved = c.stage === 'approved' || c.stage === 'invoice-sent' || isPaid;

  const stageBadge = isPaid
    ? `<span class="badge badge-green">Paid</span>`
    : isApproved
    ? `<span class="badge badge-cyan">Approved — invoice coming</span>`
    : hasPreview
    ? `<span class="badge badge-cyan">Preview ready for review</span>`
    : `<span class="badge badge-amber">In progress</span>`;

  return `<!DOCTYPE html>
<html lang="en-gb">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Your StaticSwift Portal — ${esc(c.business_name || c.name)}</title>
<meta name="robots" content="noindex,nofollow">
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:#07090f;color:#f0f2f8;font-family:'DM Sans',sans-serif;min-height:100vh;display:flex;flex-direction:column}
a{color:#00C8E0;text-decoration:none}
header{background:#0d1018;border-bottom:1px solid rgba(255,255,255,.07);padding:18px 28px;display:flex;align-items:center;justify-content:space-between}
.logo{font-family:'Syne',sans-serif;font-weight:800;font-size:17px;color:#f0f2f8;letter-spacing:-.3px}.logo span{color:#00C8E0}
.wrap{max-width:660px;margin:0 auto;padding:44px 24px 64px;flex:1;width:100%}
h1{font-family:'Syne',sans-serif;font-size:24px;font-weight:800;margin-bottom:6px;line-height:1.2}
.sub{color:#8890a8;font-size:14px;margin-bottom:32px;line-height:1.6}
.card{background:#111420;border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:24px;margin-bottom:14px}
.card-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#8890a8;margin-bottom:14px}
.badge{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:20px;font-size:12px;font-weight:700;letter-spacing:.02em;margin-bottom:16px}
.badge-cyan{background:rgba(0,200,224,.12);color:#00C8E0;border:1px solid rgba(0,200,224,.2)}
.badge-amber{background:rgba(251,191,36,.1);color:#fbbf24;border:1px solid rgba(251,191,36,.2)}
.badge-green{background:rgba(34,197,94,.1);color:#22c55e;border:1px solid rgba(34,197,94,.2)}
.preview-wrap{position:relative;width:100%;border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,.08);background:#0d1018;margin-bottom:14px}
iframe{width:100%;height:360px;display:block;border:none}
.open-link{font-size:13px;color:#00C8E0;display:inline-flex;align-items:center;gap:4px;margin-top:2px}
.open-link:hover{text-decoration:underline}
.btn{display:block;width:100%;padding:13px 20px;border-radius:9px;font-size:14px;font-weight:700;text-align:center;cursor:pointer;border:none;transition:opacity .15s,background .15s;font-family:'DM Sans',sans-serif}
.btn+.btn{margin-top:8px}
.btn-primary{background:#00C8E0;color:#07090f}
.btn-primary:hover{opacity:.88}
.btn-ghost{background:transparent;color:#00C8E0;border:1.5px solid rgba(0,200,224,.35)}
.btn-ghost:hover{border-color:#00C8E0}
.btn-danger{background:transparent;color:#f87171;border:1.5px solid rgba(248,113,113,.3)}
.btn-danger:hover{border-color:#f87171}
.btn:disabled{opacity:.4;cursor:not-allowed}
.response-area{margin-top:14px;display:none}
textarea{width:100%;background:#0d1018;border:1px solid rgba(255,255,255,.1);border-radius:8px;color:#f0f2f8;font-family:'DM Sans',sans-serif;font-size:14px;padding:12px 14px;resize:vertical;min-height:100px;line-height:1.6}
textarea:focus{outline:none;border-color:#00C8E0}
textarea::placeholder{color:#4a5068}
.msg{margin-top:12px;padding:12px 16px;border-radius:8px;font-size:14px;display:none;line-height:1.5}
.msg-success{background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.25);color:#22c55e}
.msg-error{background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.25);color:#f87171}
.divider{height:1px;background:rgba(255,255,255,.06);margin:6px 0 14px}
.support-bar{background:rgba(0,200,224,.05);border:1px solid rgba(0,200,224,.12);border-radius:10px;padding:16px 20px;font-size:13px;color:#8890a8;text-align:center;margin-top:6px}
.support-bar a{font-weight:600}
footer{padding:24px;text-align:center;font-size:12px;color:#4a5068;border-top:1px solid rgba(255,255,255,.05)}
</style>
</head>
<body>
<header>
  <span class="logo">STATIC<span>SWIFT</span></span>
  <span style="font-size:13px;color:#8890a8">${esc(c.business_name || '')}</span>
</header>

<div class="wrap">
  <h1>Hi, ${esc(c.name || c.business_name)}.</h1>
  <p class="sub">This is your private StaticSwift project portal. Bookmark this page — you can return to it any time.</p>

  ${hasPreview && !isApproved ? `
  <!-- PREVIEW REVIEW CARD -->
  <div class="card">
    <div class="card-label">Your website preview</div>
    ${stageBadge}
    <div class="preview-wrap">
      <iframe src="${esc(c.previewUrl)}" loading="lazy" title="Your website preview" sandbox="allow-same-origin allow-scripts"></iframe>
    </div>
    <a href="${esc(c.previewUrl)}" target="_blank" rel="noopener" class="open-link">Open full preview in new tab ↗</a>

    <div class="divider" style="margin-top:18px"></div>
    <p style="font-size:13px;color:#8890a8;margin-bottom:12px">Check it on both desktop and mobile, then let us know below.</p>

    <button class="btn btn-primary" id="btn-approve" onclick="showAction('approve')">Looks great — approve it</button>
    <button class="btn btn-danger" id="btn-changes" onclick="showAction('changes')">Request changes</button>

    <div class="response-area" id="area-approve">
      <textarea id="notes-approve" placeholder="Any final comments? (optional)"></textarea>
      <button class="btn btn-primary" style="margin-top:10px" onclick="submit('approve')">Confirm approval</button>
    </div>

    <div class="response-area" id="area-changes">
      <textarea id="notes-changes" placeholder="Please describe the changes you'd like..."></textarea>
      <button class="btn btn-ghost" style="margin-top:10px" onclick="submit('changes')">Send change request</button>
    </div>

    <div class="msg msg-success" id="msg-success"></div>
    <div class="msg msg-error" id="msg-error"></div>
  </div>
  ` : hasPreview && isApproved ? `
  <div class="card">
    <div class="card-label">Your website preview</div>
    ${stageBadge}
    <a href="${esc(c.previewUrl)}" target="_blank" rel="noopener" class="open-link" style="display:block;margin-bottom:6px">View your site ↗</a>
    <p style="font-size:13px;color:#8890a8">Preview approved. ${isPaid ? 'Payment received — your files have been delivered.' : 'Invoice is on its way.'}</p>
  </div>
  ` : `
  <div class="card">
    <div class="card-label">Project status</div>
    ${stageBadge}
    <p style="font-size:14px;color:#8890a8;line-height:1.6">Your website is being built. You will receive an email when your preview is ready — usually within 24 hours of submitting your order.</p>
  </div>
  `}

  ${isPaid && c.invoiceNumber ? `
  <div class="card">
    <div class="card-label">Invoice</div>
    <div style="display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:14px;color:#8890a8">${esc(c.invoiceNumber)}</span>
      <span style="font-weight:700;color:#22c55e">£${c.amount || ''} — Paid</span>
    </div>
  </div>
  ` : ''}

  <div class="card">
    <div class="card-label">Get your site live</div>
    <p style="font-size:14px;color:#8890a8;margin-bottom:14px">Once you have your HTML file, follow our simple upload guide to go live in minutes.</p>
    <a href="https://staticswift.co.uk/how-to-upload.html" target="_blank" class="btn btn-ghost">Upload guide ↗</a>
  </div>

  <div class="support-bar">Questions? <a href="mailto:support@staticswift.co.uk">support@staticswift.co.uk</a> — always a real person, never a bot.</div>
</div>

<footer>StaticSwift — staticswift.co.uk &nbsp;·&nbsp; support@staticswift.co.uk</footer>

<script>
const PORTAL_UUID = '${uuid}';

function showAction(type) {
  document.getElementById('area-approve').style.display = 'none';
  document.getElementById('area-changes').style.display = 'none';
  document.getElementById('msg-success').style.display = 'none';
  document.getElementById('msg-error').style.display = 'none';
  document.getElementById('area-' + type).style.display = 'block';
}

async function submit(type) {
  const notes = document.getElementById('notes-' + type).value.trim();
  if (type === 'changes' && !notes) {
    showMsg('error', 'Please describe the changes you would like.');
    return;
  }

  const btn = document.querySelector('#area-' + type + ' .btn');
  btn.disabled = true;
  btn.textContent = 'Sending...';

  try {
    const r = await fetch('/.netlify/functions/portal-response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ portalUUID: PORTAL_UUID, type, notes }),
    });
    const d = await r.json();

    if (d.ok) {
      document.getElementById('area-approve').style.display = 'none';
      document.getElementById('area-changes').style.display = 'none';
      document.getElementById('btn-approve').style.display = 'none';
      document.getElementById('btn-changes').style.display = 'none';
      showMsg('success', type === 'approve'
        ? 'Approved! We will send your invoice shortly. Thank you.'
        : 'Change request received. We will be in touch within 24 hours.');
    } else {
      btn.disabled = false;
      btn.textContent = type === 'approve' ? 'Confirm approval' : 'Send change request';
      showMsg('error', d.error || 'Something went wrong. Please email support@staticswift.co.uk');
    }
  } catch (err) {
    btn.disabled = false;
    btn.textContent = type === 'approve' ? 'Confirm approval' : 'Send change request';
    showMsg('error', 'Network error. Please email support@staticswift.co.uk');
  }
}

function showMsg(type, text) {
  const el = document.getElementById('msg-' + type);
  el.textContent = text;
  el.style.display = 'block';
}
</script>
</body>
</html>`;
}

function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
