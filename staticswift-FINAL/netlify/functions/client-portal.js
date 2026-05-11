

exports.handler = async (event) => {
  const uuid = event.path.replace('/client/', '').replace(/\//g, '');
  if (!uuid) return { statusCode: 400, body: 'Missing portal UUID' };

  try {
    const store = require('./_db').getClient;
    const { blobs } = await store.list();
    let client = null;

    for (const { key } of blobs) {
      try {
        const c = await store.get(key, { type: 'json' });
        if (c?.portalUUID === uuid) { client = c; break; }
      } catch { continue; }
    }

    if (!client) return { statusCode: 404, contentType: 'text/html', body: '<html><body style="font-family:sans-serif;background:#07090f;color:#f0f2f8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0"><div style="text-align:center"><h1 style="font-family:sans-serif">Portal not found</h1><p style="color:#8890a8">This link may have expired. Email <a href="mailto:support@staticswift.co.uk" style="color:#00C8E0">support@staticswift.co.uk</a></p></div></body></html>' };

    const html = `<!DOCTYPE html>
<html lang="en-gb">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Your StaticSwift Files — ${client.business_name}</title>
<meta name="robots" content="noindex">
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:#07090f;color:#f0f2f8;font-family:'DM Sans',sans-serif;min-height:100vh;display:flex;flex-direction:column}
header{background:#0d1018;border-bottom:1px solid rgba(255,255,255,.07);padding:20px 24px;display:flex;align-items:center;gap:12px}
.logo{font-family:'Syne',sans-serif;font-weight:800;font-size:18px}.logo span{color:#00C8E0}
.wrap{max-width:600px;margin:0 auto;padding:48px 24px;flex:1}
h1{font-family:'Syne',sans-serif;font-size:28px;font-weight:800;margin-bottom:8px}
.sub{color:#8890a8;font-size:15px;margin-bottom:36px}
.card{background:#181b26;border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:24px;margin-bottom:16px}
.card h3{font-size:15px;font-weight:700;margin-bottom:12px}
.btn{display:block;background:#00C8E0;color:#07090f;font-weight:700;font-size:15px;padding:14px 24px;border-radius:8px;text-decoration:none;text-align:center;margin-bottom:10px;transition:opacity .2s}
.btn:hover{opacity:.88}
.btn-ghost{background:transparent;color:#00C8E0;border:1.5px solid #00C8E0}
.support{background:rgba(0,200,224,.08);border:1px solid rgba(0,200,224,.2);border-radius:10px;padding:16px;font-size:14px;color:#8890a8;text-align:center}
.support a{color:#00C8E0;font-weight:600}
footer{border-top:1px solid rgba(255,255,255,.07);padding:24px;text-align:center;font-size:12px;color:#4a5068}
</style>
</head>
<body>
<header><span class="logo">STATIC<span>SWIFT</span></span></header>
<div class="wrap">
  <h1>Welcome, ${client.business_name}.</h1>
  <p class="sub">Your website files and documents are here. This link is private — bookmark it for future access.</p>
  <div class="card">
    <h3>Your Website Files</h3>
    <p style="color:#8890a8;font-size:14px;margin-bottom:16px">Your HTML file was delivered by email. If you need it re-sent, use the support button below.</p>
    <a href="mailto:support@staticswift.co.uk?subject=Please resend my files — ${encodeURIComponent(client.business_name)}" class="btn btn-ghost">Re-send My Files</a>
  </div>
  ${client.invoiceNumber ? `<div class="card"><h3>Invoice ${client.invoiceNumber}</h3><p style="color:#8890a8;font-size:14px;margin-bottom:16px">Amount: £${client.amount} — Paid</p><a href="mailto:support@staticswift.co.uk?subject=Invoice copy — ${encodeURIComponent(client.invoiceNumber)}" class="btn btn-ghost">Download Invoice Copy</a></div>` : ''}
  <div class="card">
    <h3>Get Your Site Live</h3>
    <a href="https://staticswift.co.uk/how-to-upload.html" class="btn">Upload Guide</a>
  </div>
  <div class="support">Need help? <a href="mailto:support@staticswift.co.uk">support@staticswift.co.uk</a> — always free, always a real person.</div>
</div>
<footer>StaticSwift — staticswift.co.uk | support@staticswift.co.uk</footer>
</body>
</html>`;

    return { statusCode: 200, headers: { 'Content-Type': 'text/html' }, body: html };
  } catch (err) {
    console.error('client-portal error:', err);
    return { statusCode: 500, body: 'Error loading portal' };
  }
};
