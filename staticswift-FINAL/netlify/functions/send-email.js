const { getStore } = require('@netlify/blobs');
const { createTransporter, LOGO_HTML } = require('./_mailer');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const auth = event.headers['x-admin-password'];
  if (auth !== process.env.ADMIN_PASSWORD) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const { clientId, emailType, previewUrl, customSubject, customBody } = JSON.parse(event.body || '{}');
    if (!clientId) return { statusCode: 400, body: JSON.stringify({ error: 'clientId required' }) };

    const store = getStore('clients');
    const client = await store.get(clientId, { type: 'json' });
    if (!client) return { statusCode: 404, body: JSON.stringify({ error: 'Client not found' }) };

    const transporter = createTransporter();
    const fromAddr = process.env.SMTP_USER || process.env.GMAIL_USER || 'hello@staticswift.co.uk';
    const toAddr = client.delivery_email;
    if (!toAddr) return { statusCode: 400, body: JSON.stringify({ error: 'Client has no email' }) };

    let subject = '';
    let html = '';
    let stageUpdate = {};

    if (emailType === 'confirmation') {
      subject = 'We have received your request — ' + (client.business_name || 'your business');
      html = LOGO_HTML + '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:0 24px 32px;">' +
        '<h2 style="font-size:22px;margin-bottom:8px;">Hi ' + (client.name || 'there') + ',</h2>' +
        '<p>Thanks for getting in touch. We have received all the details for <strong>' + (client.business_name || 'your business') + '</strong>.</p>' +
        '<p>Your preview will be with you within 24 hours. Watch for an email from <a href="mailto:hello@staticswift.co.uk">hello@staticswift.co.uk</a></p>' +
        '<p>No payment until you approve the design. One free revision included.</p>' +
        '<p style="margin-top:32px;color:#888;font-size:13px;">StaticSwift — <a href="https://staticswift.co.uk">staticswift.co.uk</a></p></div>';
      stageUpdate = { stage: 'building' };
    }

    else if (emailType === 'preview') {
      if (!previewUrl) return { statusCode: 400, body: JSON.stringify({ error: 'previewUrl required' }) };
      subject = 'Your ' + (client.business_name || '') + ' website preview is ready';
      html = LOGO_HTML + '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:0 24px 32px;">' +
        '<h2>Hi ' + (client.name || 'there') + ',</h2>' +
        '<p>Your site is built. Take a look:</p>' +
        '<p style="text-align:center;margin:28px 0;"><a href="' + previewUrl + '" style="background:#00C8E0;color:#07090f;font-weight:700;padding:14px 28px;border-radius:8px;text-decoration:none;display:inline-block;">View Your Preview</a></p>' +
        '<p>Check it on desktop and mobile.</p>' +
        '<p><strong>Happy with it?</strong> Just reply to confirm and I will send the invoice.</p>' +
        '<p><strong>Want any changes?</strong> Reply with the details — one revision is included.</p>' +
        '<p style="color:#888;font-size:13px;margin-top:28px;">StaticSwift — <a href="https://staticswift.co.uk">staticswift.co.uk</a></p></div>';
      stageUpdate = { stage: 'preview-sent', previewUrl, previewSentAt: new Date().toISOString() };
    }

    else if (emailType === 'invoice') {
      const isAdvanced = client.package === 'advanced';
      const hasHosting = client.hosting_addon === 'yes';
      const amount = (isAdvanced ? 299 : 149) + (hasHosting ? 29 : 0);
      const paymentLink = isAdvanced
        ? (process.env.STRIPE_PAYMENT_LINK_ADVANCED || '#')
        : (process.env.STRIPE_PAYMENT_LINK_STARTER || '#');
      
      // Generate invoice number
      const metaStore = getStore('meta');
      let counter = { count: 0 };
      try { counter = await metaStore.get('invoice_counter', { type: 'json' }); } catch {}
      const next = (counter?.count || 0) + 1;
      await metaStore.setJSON('invoice_counter', { count: next });
      const invoiceNumber = 'SS-' + new Date().getFullYear() + '-' + String(next).padStart(3, '0');

      subject = 'Invoice ' + invoiceNumber + ' — StaticSwift — £' + amount;
      html = LOGO_HTML + '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:0 24px 32px;color:#333">' +
        '<h2 style="font-size:22px;margin-bottom:4px;">Invoice ' + invoiceNumber + '</h2>' +
        '<p style="color:#888;font-size:14px;margin-bottom:28px;">Date: ' + new Date().toLocaleDateString('en-GB') + '</p>' +
        '<table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:28px">' +
        '<tr style="background:#f5f5f5"><th style="padding:10px 14px;text-align:left;border:1px solid #eee">Description</th><th style="padding:10px 14px;text-align:right;border:1px solid #eee">Amount</th></tr>' +
        '<tr><td style="padding:12px 14px;border:1px solid #eee">' + (isAdvanced ? 'Advanced' : 'Starter') + ' Website Design</td><td style="padding:12px 14px;border:1px solid #eee;text-align:right">£' + (isAdvanced ? 299 : 149) + '</td></tr>' +
        (hasHosting ? '<tr><td style="padding:12px 14px;border:1px solid #eee">Hosting Upload Service</td><td style="padding:12px 14px;border:1px solid #eee;text-align:right">£29</td></tr>' : '') +
        '<tr style="background:#f5f5f5;font-weight:700"><td style="padding:12px 14px;border:1px solid #eee">Total Due</td><td style="padding:12px 14px;border:1px solid #eee;text-align:right;font-size:18px;color:#00C8E0">£' + amount + '</td></tr></table>' +
        '<p style="text-align:center;margin:32px 0"><a href="' + paymentLink + '" style="background:#00C8E0;color:#07090f;font-weight:700;padding:16px 36px;border-radius:8px;text-decoration:none;font-size:16px;display:inline-block">Pay Securely — £' + amount + '</a></p>' +
        '<p style="font-size:13px;color:#888;text-align:center">Files delivered within 1 hour of payment.</p>' +
        '<p style="color:#888;font-size:13px;margin-top:28px;text-align:center;">StaticSwift — <a href="https://staticswift.co.uk">staticswift.co.uk</a></p></div>';
      stageUpdate = { stage: 'invoice-sent', invoiceNumber, amount, invoiceSentAt: new Date().toISOString() };
    }

    else if (emailType === 'custom') {
      subject = customSubject || 'Message from StaticSwift';
      html = LOGO_HTML + '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:0 24px 32px;">' +
        '<p>' + (customBody || '').replace(/\n/g, '<br>') + '</p>' +
        '<p style="color:#888;font-size:13px;margin-top:28px;">StaticSwift — <a href="https://staticswift.co.uk">staticswift.co.uk</a></p></div>';
    }

    else {
      return { statusCode: 400, body: JSON.stringify({ error: 'Unknown emailType: ' + emailType }) };
    }

    await transporter.sendMail({
      from: '"StaticSwift" <' + fromAddr + '>',
      to: toAddr,
      subject,
      html,
      replyTo: fromAddr,
    });

    // Update client record
    const emailLog = client.emailLog || [];
    emailLog.push({ type: emailType, sentAt: new Date().toISOString(), direction: 'outbound', subject });
    await store.setJSON(clientId, { ...client, ...stageUpdate, emailLog });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, emailType, to: toAddr, subject, invoiceNumber: stageUpdate.invoiceNumber })
    };
  } catch (err) {
    console.error('send-email error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
