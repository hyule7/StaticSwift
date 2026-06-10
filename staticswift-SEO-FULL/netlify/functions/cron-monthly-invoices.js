/*
 * cron-monthly-invoices.js  (scheduled — 1st of each month, 09:00 UTC)
 * ---------------------------------------------------------------------
 * Sweeps the client list, finds every live subscription, and emails each
 * one their monthly £49 invoice. Idempotent within a billing cycle: a
 * client receives at most one auto-invoice per calendar month. Stage
 * `live` is the trigger; `paused` / `cancelled` / anything else is
 * skipped.
 *
 * Schedule is registered in netlify.toml as:
 *   [functions."cron-monthly-invoices"]
 *     schedule = "0 9 1 * *"
 *
 * Manual run for testing:
 *   POST /.netlify/functions/cron-monthly-invoices
 *     header: x-admin-password: <ADMIN_PASSWORD>
 *     body:   { "dryRun": true }            // logs only, sends nothing
 *     body:   { "dryRun": false, "clientId": "client_…" }   // single client
 *
 * Env vars required (already present for other functions):
 *   JSONBIN_BIN_ID, JSONBIN_API_KEY        // _db.js
 *   SMTP_HOST/SMTP_USER/SMTP_PASS          // _mailer.js (Fasthosts)
 *   ADMIN_PASSWORD                          // manual trigger auth
 *
 * Optional:
 *   MONTHLY_AMOUNT (default 49)             // £ amount on the invoice
 *   PAYMENT_DAYS   (default 14)             // due-by window
 */

const { getClients, updateClient, incrementInvoiceCounter } = require('./_db');
const { createTransporter } = require('./_mailer');

/* ─────────────────────────────────────────────────────────────────
 * ‼  EDIT THE FOUR VALUES BELOW ONCE.  ‼
 * Hard-coded so Harry never has to touch Netlify env vars.
 * Filled with the placeholder values from the original setup —
 * REPLACE these with your real Revolut/bank-of-choice details
 * before the first cron run, or the first batch of invoices will
 * go out with "00000000" as the account number.
 * ─────────────────────────────────────────────────────────────── */
const STATICSWIFT_BANK = {
  name:      'Revolut Ltd',     // bank name as it appears on the invoice
  sortCode:  '04-00-75',        // UK sort code, e.g. "12-34-56"
  account:   '00000000',        // account number, 8 digits
  refPrefix: 'SS-',             // invoice ref prefix, e.g. "SS-0042"
};

const MONTHLY_AMOUNT = 49;       // £ amount on the monthly invoice
const PAYMENT_DAYS   = 14;       // days from issue date to due date

const BANK_NAME       = STATICSWIFT_BANK.name;
const BANK_SORT       = STATICSWIFT_BANK.sortCode;
const BANK_ACCT       = STATICSWIFT_BANK.account;
const BANK_REF_PREFIX = STATICSWIFT_BANK.refPrefix;

function fmtGBP(n){ return '£' + Number(n).toFixed(2); }
function fmtDate(d){
  return d.toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });
}
function monthKey(d){
  // YYYY-MM — used as the idempotency key inside client.monthlyInvoices[]
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth()+1).padStart(2,'0');
}

function buildInvoiceHtml({ client, invoiceNumber, issueDate, dueDate, amount, periodLabel }){
  const ref = BANK_REF_PREFIX + invoiceNumber;
  return `<!DOCTYPE html>
<html lang="en-gb"><head><meta charset="UTF-8"><title>Invoice ${invoiceNumber} — StaticSwift</title></head>
<body style="margin:0;padding:32px 16px;background:#EBE7DD;font-family:Helvetica,Arial,sans-serif;color:#0E0B07;line-height:1.55">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:620px;margin:0 auto;background:#F2EFE7;border:1px solid rgba(14,11,7,.22)">
    <tr><td style="padding:32px 32px 16px">
      <div style="font-family:Georgia,serif;font-style:italic;font-weight:500;font-size:24px;letter-spacing:-.01em">StaticSwift</div>
      <div style="font-family:Menlo,monospace;font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:#8A7B62;margin-top:6px">Hand-coded sites · Manchester · UK-wide</div>
    </td></tr>
    <tr><td style="padding:0 32px"><hr style="border:0;border-top:1px solid #0E0B07;margin:8px 0 24px"></td></tr>
    <tr><td style="padding:0 32px 8px">
      <div style="font-family:Menlo,monospace;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#8A7B62">Invoice ${invoiceNumber} · ${periodLabel}</div>
      <h1 style="font-family:Georgia,serif;font-style:italic;font-weight:500;font-size:42px;line-height:.95;letter-spacing:-.025em;margin:14px 0 8px">Monthly care &amp; hosting.</h1>
      <p style="font-family:Georgia,serif;font-size:17px;color:#29221C;margin:0 0 28px">For ${client.business_name || client.name || 'your site'}. Issued ${fmtDate(issueDate)}, due ${fmtDate(dueDate)}.</p>
    </td></tr>
    <tr><td style="padding:0 32px">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse:collapse;border-top:1px solid #0E0B07">
        <tr>
          <td style="padding:18px 0;border-bottom:1px solid rgba(14,11,7,.10);font-family:Georgia,serif;font-size:17px;color:#0E0B07">
            Hosting, monitoring, monthly edits &mdash; ${periodLabel}
            <div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#5A4E40;margin-top:4px">Includes hosting, uptime monitoring, content edits, and lead-guarantee tracking.</div>
          </td>
          <td style="padding:18px 0;border-bottom:1px solid rgba(14,11,7,.10);text-align:right;font-family:Georgia,serif;font-weight:500;font-size:18px;white-space:nowrap;color:#0E0B07">${fmtGBP(amount)}</td>
        </tr>
        <tr>
          <td style="padding:18px 0;font-family:Menlo,monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8A7B62">Total due</td>
          <td style="padding:18px 0;text-align:right;font-family:Georgia,serif;font-style:italic;font-weight:500;font-size:28px;color:#9C2615">${fmtGBP(amount)}</td>
        </tr>
      </table>
    </td></tr>
    <tr><td style="padding:8px 32px 24px">
      <div style="background:#EBE7DD;border:1px solid rgba(14,11,7,.10);padding:18px 20px;margin-top:8px">
        <div style="font-family:Menlo,monospace;font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:#8A7B62;margin-bottom:10px">Pay by UK bank transfer</div>
        <div style="font-family:Georgia,serif;font-size:16px;color:#0E0B07;line-height:1.7">
          <div><b>Account name:</b> StaticSwift</div>
          <div><b>Bank:</b> ${BANK_NAME}</div>
          <div><b>Sort code:</b> ${BANK_SORT}</div>
          <div><b>Account:</b> ${BANK_ACCT}</div>
          <div style="margin-top:8px;padding-top:8px;border-top:1px dashed rgba(14,11,7,.22)"><b>Reference:</b> <span style="font-family:Menlo,monospace;font-size:14px">${ref}</span></div>
        </div>
      </div>
    </td></tr>
    <tr><td style="padding:0 32px 28px">
      <p style="font-family:Georgia,serif;font-size:15px;color:#29221C;margin:0 0 8px">Questions? Reply to this email or WhatsApp <a href="https://wa.me/447502731799" style="color:#9C2615">+44 7502 731 799</a>. Always a real person.</p>
      <p style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#8A7B62;margin:18px 0 0">StaticSwift &middot; Sole trader &middot; Manchester, UK &middot; hello@staticswift.co.uk</p>
    </td></tr>
  </table>
</body></html>`;
}

async function sendOne(client, transporter, opts){
  const issueDate = new Date();
  const dueDate   = new Date(issueDate.getTime() + PAYMENT_DAYS * 86400000);
  const periodLabel = issueDate.toLocaleString('en-GB', { month:'long', year:'numeric' });

  // Sequential invoice number from the shared counter
  const num = await incrementInvoiceCounter();
  const invoiceNumber = String(num).padStart(4, '0');

  const html = buildInvoiceHtml({
    client, invoiceNumber, issueDate, dueDate,
    amount: MONTHLY_AMOUNT, periodLabel,
  });

  const toEmail = client.delivery_email || client.enquiry_email || client.email;
  const subject = 'Invoice ' + invoiceNumber + ' — StaticSwift (' + periodLabel + ')';
  const fromAddr = process.env.SMTP_USER || 'hello@staticswift.co.uk';

  if (opts.dryRun){
    return { dryRun:true, clientId:client.clientId, toEmail, invoiceNumber, amount:MONTHLY_AMOUNT };
  }
  if (!toEmail){
    return { skipped:true, reason:'no email on file', clientId:client.clientId };
  }

  await transporter.sendMail({
    from: '"StaticSwift" <' + fromAddr + '>',
    to: toEmail,
    subject,
    html,
    replyTo: fromAddr,
  });

  const cycleKey = monthKey(issueDate);
  const log = Array.isArray(client.monthlyInvoices) ? client.monthlyInvoices.slice() : [];
  log.push({
    cycleKey,
    invoiceNumber,
    amount: MONTHLY_AMOUNT,
    currency: 'GBP',
    issuedAt: issueDate.toISOString(),
    dueAt: dueDate.toISOString(),
    paidAt: null,
  });
  const emailLog = Array.isArray(client.emailLog) ? client.emailLog.slice() : [];
  emailLog.push({
    type: 'monthly-invoice',
    direction: 'outbound',
    sentAt: issueDate.toISOString(),
    subject,
    invoiceNumber,
  });

  await updateClient(client.clientId, {
    monthlyInvoices: log,
    lastMonthlyInvoiceAt: issueDate.toISOString(),
    emailLog,
  });

  return { ok:true, clientId:client.clientId, toEmail, invoiceNumber, amount:MONTHLY_AMOUNT };
}

exports.handler = async (event) => {
  const isManual = event && event.httpMethod === 'POST';
  let opts = { dryRun:false, clientId:null };

  if (isManual){
    // Manual trigger needs admin password
    const auth = (event.headers && (event.headers['x-admin-password'] || event.headers['X-Admin-Password'])) || '';
    const want = process.env.ADMIN_PASSWORD;
    if (auth !== want) return { statusCode:401, body:JSON.stringify({ error:'Unauthorized' }) };
    try{
      const body = event.body ? JSON.parse(event.body) : {};
      if (body.dryRun)  opts.dryRun  = true;
      if (body.clientId) opts.clientId = body.clientId;
    } catch(_){}
  }

  const now = new Date();
  const cycleKey = monthKey(now);

  try {
    const allClients = await getClients();
    const targets = allClients.filter(c => {
      if (opts.clientId) return c.clientId === opts.clientId;
      if (!c || c.stage !== 'live') return false;
      // Skip if we've already invoiced this cycle
      const log = Array.isArray(c.monthlyInvoices) ? c.monthlyInvoices : [];
      return !log.some(e => e.cycleKey === cycleKey);
    });

    const transporter = opts.dryRun ? null : createTransporter();
    const results = [];
    for (const c of targets){
      try {
        const r = await sendOne(c, transporter, opts);
        results.push(r);
      } catch (err) {
        console.error('[cron-monthly-invoices]', c.clientId, err.message);
        results.push({ failed:true, clientId:c.clientId, error:err.message });
      }
    }

    console.log('[cron-monthly-invoices]', cycleKey, 'targets:', targets.length, 'results:', results.length);
    return {
      statusCode: 200,
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ ok:true, cycle:cycleKey, dryRun:opts.dryRun, targets:targets.length, results }),
    };
  } catch (err) {
    console.error('[cron-monthly-invoices] fatal:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
