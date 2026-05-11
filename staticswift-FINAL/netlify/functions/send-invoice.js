const { getStore } = require('@netlify/blobs');
const { createTransporter, LOGO_HTML_LARGE } = require('./_mailer');
const puppeteer = require('puppeteer');

const LOGO_HTML = `<div style="text-align:center;padding:16px 0">
  <img src="data:image/png;base64,LOGO_BASE64_PLACEHOLDER" alt="StaticSwift" style="height:64px;width:auto" />
</div>`;

async function getNextInvoiceNumber(store) {
  let counter;
  try {
    counter = await store.get('invoice_counter', { type: 'json' });
  } catch {
    counter = { count: 0 };
  }
  const next = (counter?.count || 0) + 1;
  await store.setJSON('invoice_counter', { count: next });
  return `SS-${new Date().getFullYear()}-${String(next).padStart(3, '0')}`;
}

async function generateInvoicePDF(client, invoiceNumber, amount, paymentLink) {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>
      body { font-family: Arial, sans-serif; max-width: 700px; margin: 40px auto; color: #111; }
      .logo { text-align: center; padding: 16px 0 32px; }
      .logo img { height: 64px; width: auto; }
      h1 { font-size: 28px; margin-bottom: 4px; }
      .meta { display: flex; justify-content: space-between; margin: 32px 0; }
      .meta div { font-size: 14px; }
      .meta strong { display: block; font-size: 16px; margin-bottom: 4px; }
      table { width: 100%; border-collapse: collapse; margin: 24px 0; }
      th { background: #07090f; color: #fff; padding: 10px 14px; text-align: left; font-size: 13px; }
      td { padding: 12px 14px; border-bottom: 1px solid #eee; font-size: 14px; }
      .total-row td { font-weight: 700; font-size: 16px; border-top: 2px solid #111; border-bottom: none; }
      .payment { text-align: center; margin: 32px 0; }
      .payment a { background: #00C8E0; color: #07090f; font-weight: 700; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; }
      .footer { text-align: center; font-size: 12px; color: #888; margin-top: 40px; }
    </style></head><body>
    <div class="logo">${LOGO_HTML}</div>
    <h1>INVOICE</h1>
    <div class="meta">
      <div><strong>Invoice To</strong>${client.name}<br>${client.business_name}<br>${client.delivery_email}</div>
      <div style="text-align:right"><strong>Invoice Details</strong>Invoice No: ${invoiceNumber}<br>Date: ${new Date().toLocaleDateString('en-GB')}<br>Due: On receipt</div>
    </div>
    <table>
      <thead><tr><th>Description</th><th>Qty</th><th>Amount</th></tr></thead>
      <tbody>
        <tr><td>${client.package === 'advanced' ? 'Advanced' : 'Starter'} Website Design<br><small style="color:#666;">Custom HTML website, mobile responsive, SEO optimised, delivered as .html file</small></td><td>1</td><td>£${client.package === 'advanced' ? '299' : '149'}</td></tr>
        ${client.hosting_addon === 'yes' ? '<tr><td>Hosting Upload Service</td><td>1</td><td>£29</td></tr>' : ''}
        <tr class="total-row"><td colspan="2">TOTAL DUE</td><td>£${amount}</td></tr>
      </tbody>
    </table>
    <div class="payment"><a href="${paymentLink}">Pay Securely via Stripe</a></div>
    <p style="text-align:center;font-size:13px;color:#444;">Files delivered within 1 hour of payment. Thank you for choosing StaticSwift.</p>
    <div class="footer">staticswift.co.uk &nbsp;|&nbsp; hello@staticswift.co.uk &nbsp;|&nbsp; support@staticswift.co.uk</div>
  </body></html>`;

  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdf = await page.pdf({ format: 'A4', printBackground: true });
  await browser.close();
  return pdf;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { clientId } = JSON.parse(event.body || '{}');
    if (!clientId) return { statusCode: 400, body: 'clientId required' };

    const store = getStore('clients');
    const client = await store.get(clientId, { type: 'json' });
    if (!client) return { statusCode: 404, body: 'Client not found' };

    const invoiceNumber = await getNextInvoiceNumber(getStore('meta'));

    const isAdvanced = client.package === 'advanced';
    const hasHosting = client.hosting_addon === 'yes';
    const amount = (isAdvanced ? 299 : 149) + (hasHosting ? 29 : 0);
    const paymentLink = isAdvanced ? process.env.STRIPE_PAYMENT_LINK_ADVANCED : process.env.STRIPE_PAYMENT_LINK_STARTER;

    const pdfBuffer = await generateInvoicePDF(client, invoiceNumber, amount, paymentLink);

    await store.setJSON(clientId, {
      ...client,
      stage: 'invoice-sent',
      invoiceNumber,
      amount,
      invoiceSentAt: new Date().toISOString(),
      emailLog: [
        ...(client.emailLog || []),
        { type: 'invoice-sent', sentAt: new Date().toISOString(), direction: 'outbound', invoiceNumber }
      ]
    });

    const transporter = createTransporter();

    await transporter.sendMail({
      from: `"StaticSwift" <${process.env.SMTP_USER || process.env.GMAIL_USER}>`,
      to: client.delivery_email,
      subject: `Invoice for ${client.business_name} — StaticSwift`,
      html: `${LOGO_HTML}
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:0 24px 32px;">
          <h2 style="font-size:22px;margin-bottom:8px;">Hi ${client.name},</h2>
          <p>Great, glad you are happy. Here is your invoice:</p>
          <p style="font-family:monospace;background:#f5f5f5;padding:12px 16px;border-radius:8px;">${invoiceNumber} &nbsp;|&nbsp; £${amount} &nbsp;|&nbsp; Due on receipt</p>
          <p style="text-align:center;margin:28px 0;">
            <a href="${paymentLink}" style="background:#00C8E0;color:#07090f;font-weight:700;padding:14px 28px;border-radius:8px;text-decoration:none;display:inline-block;">Pay Securely — £${amount}</a>
          </p>
          <p>Files sent within the hour of payment confirming.</p>
          <p style="margin-top:32px;color:#888;font-size:13px;">StaticSwift — <a href="https://staticswift.co.uk">staticswift.co.uk</a></p>
        </div>`,
      attachments: [{ filename: `${invoiceNumber}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
    });

    return { statusCode: 200, body: JSON.stringify({ ok: true, invoiceNumber, amount }) };
  } catch (err) {
    console.error('send-invoice error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
