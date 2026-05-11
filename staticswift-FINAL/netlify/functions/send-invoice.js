const { getStore } = require('@netlify/blobs');
const { createTransporter, LOGO_HTML } = require('./_mailer');

async function getNextInvoiceNumber(store) {
  let counter;
  try { counter = await store.get('invoice_counter', { type: 'json' }); } catch { counter = { count: 0 }; }
  const next = (counter?.count || 0) + 1;
  await store.setJSON('invoice_counter', { count: next });
  return `SS-${new Date().getFullYear()}-${String(next).padStart(3, '0')}`;
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
    const paymentLink = isAdvanced
      ? process.env.STRIPE_PAYMENT_LINK_ADVANCED
      : process.env.STRIPE_PAYMENT_LINK_STARTER;

    await store.setJSON(clientId, {
      ...client, stage: 'invoice-sent', invoiceNumber, amount,
      invoiceSentAt: new Date().toISOString(),
      emailLog: [...(client.emailLog || []), {
        type: 'invoice-sent', sentAt: new Date().toISOString(),
        direction: 'outbound', invoiceNumber
      }]
    });

    const transporter = createTransporter();
    const dateStr = new Date().toLocaleDateString('en-GB');

    const invoiceHTML = `${LOGO_HTML}
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:0 24px 32px;color:#333">
  <h2 style="font-size:22px;margin-bottom:4px;">Invoice ${invoiceNumber}</h2>
  <p style="color:#888;font-size:14px;margin-bottom:28px;">Date: ${dateStr}</p>

  <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:28px">
    <tr style="background:#f5f5f5">
      <th style="padding:10px 14px;text-align:left;border:1px solid #eee">Description</th>
      <th style="padding:10px 14px;text-align:right;border:1px solid #eee">Amount</th>
    </tr>
    <tr>
      <td style="padding:12px 14px;border:1px solid #eee">
        ${isAdvanced ? 'Advanced' : 'Starter'} Website Design<br>
        <span style="font-size:12px;color:#888">Custom HTML website, mobile responsive, SEO optimised</span>
      </td>
      <td style="padding:12px 14px;border:1px solid #eee;text-align:right">£${isAdvanced ? 299 : 149}</td>
    </tr>
    ${hasHosting ? `<tr>
      <td style="padding:12px 14px;border:1px solid #eee">Hosting Upload Service</td>
      <td style="padding:12px 14px;border:1px solid #eee;text-align:right">£29</td>
    </tr>` : ''}
    <tr style="background:#f5f5f5;font-weight:700">
      <td style="padding:12px 14px;border:1px solid #eee">Total Due</td>
      <td style="padding:12px 14px;border:1px solid #eee;text-align:right;color:#00C8E0;font-size:18px">£${amount}</td>
    </tr>
  </table>

  <p style="text-align:center;margin:32px 0">
    <a href="${paymentLink}" style="background:#00C8E0;color:#07090f;font-weight:700;padding:16px 36px;border-radius:8px;text-decoration:none;font-size:16px;display:inline-block">
      Pay Securely — £${amount}
    </a>
  </p>

  <p style="font-size:13px;color:#888;text-align:center">Files delivered within 1 hour of payment. Thank you for choosing StaticSwift.</p>
  <p style="color:#888;font-size:13px;margin-top:28px;text-align:center">
    StaticSwift — <a href="https://staticswift.co.uk">staticswift.co.uk</a>
  </p>
</div>`;

    await transporter.sendMail({
      from: `"StaticSwift" <${process.env.SMTP_USER || process.env.GMAIL_USER}>`,
      to: client.delivery_email,
      subject: `Invoice ${invoiceNumber} — StaticSwift — £${amount}`,
      html: invoiceHTML
    });

    return { statusCode: 200, body: JSON.stringify({ ok: true, invoiceNumber, amount }) };
  } catch (err) {
    console.error('send-invoice error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
