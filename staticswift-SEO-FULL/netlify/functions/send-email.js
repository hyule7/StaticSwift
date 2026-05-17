const { getClient, updateClient, incrementInvoiceCounter } = require('./_db');
const { createTransporter, LOGO_HTML } = require('./_mailer');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const auth = event.headers['x-admin-password'];
  const validPw = process.env.ADMIN_PASSWORD || 'Harry2001!';
  if (auth !== validPw) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const { clientId, emailType, previewUrl, customSubject, customBody } = JSON.parse(event.body || '{}');
    if (!clientId) return { statusCode: 400, body: JSON.stringify({ error: 'clientId required' }) };
    if (!emailType) return { statusCode: 400, body: JSON.stringify({ error: 'emailType required' }) };

    
    const client = await getClient(clientId);
    if (!client) return { statusCode: 404, body: JSON.stringify({ error: 'Client not found in Blobs' }) };

    const toAddr = client.delivery_email;
    if (!toAddr) return { statusCode: 400, body: JSON.stringify({ error: 'Client has no delivery_email' }) };

    // Check SMTP config before attempting send
    const provider = process.env.MAIL_PROVIDER || 'fasthosts';
    if (provider === 'fasthosts' && (!process.env.SMTP_USER || !process.env.SMTP_PASS)) {
      return { statusCode: 500, body: JSON.stringify({ error: 'SMTP not configured — add SMTP_USER and SMTP_PASS in Netlify environment variables' }) };
    }

    const fromAddr = process.env.SMTP_USER || process.env.GMAIL_USER || 'hello@staticswift.co.uk';

    let subject = '';
    let html = '';
    let stageUpdate = {};

    if (emailType === 'confirmation') {
      subject = 'We have received your request — ' + (client.business_name || 'your business');
      const waNum = (client.whatsapp || client.phone || '').replace(/\D/g, '');
      const waLink = waNum ? 'https://wa.me/' + (waNum.startsWith('0') ? '44' + waNum.slice(1) : waNum) : null;
      html = LOGO_HTML +
        '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:0 24px 32px;">' +
        '<h2 style="font-size:22px;margin-bottom:8px;">Hi ' + (client.name || 'there') + ',</h2>' +
        '<p style="margin-bottom:14px;">Thanks for getting in touch. We have received all the details for <strong>' + (client.business_name || 'your business') + '</strong>.</p>' +
        '<p style="margin-bottom:14px;">Your preview will be with you within <strong>24 hours</strong>. Watch for an email from <a href="mailto:hello@staticswift.co.uk">hello@staticswift.co.uk</a>.</p>' +
        '<div style="background:#fff8e1;border:1px solid #f59e0b;border-radius:8px;padding:16px 18px;margin:20px 0;">' +
        '<p style="margin:0;font-size:14px;color:#92400e;"><strong>⚠ Check your junk or spam folder</strong><br>Our emails sometimes get filtered. If you don\'t see a reply within 24 hours, please check your junk folder or contact us directly.</p>' +
        '</div>' +
        (waLink ? '<p style="margin-bottom:14px;">We will also message you on WhatsApp when your preview is ready — keep an eye out.</p><p style="margin-bottom:14px;"><a href="' + waLink + '" style="background:#25D366;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">💬 Message us on WhatsApp</a></p>' : '') +
        '<p style="margin-bottom:14px;">No payment until you approve the design. One free revision included.</p>' +
        '<p style="margin-top:32px;color:#888;font-size:13px;">StaticSwift — <a href="https://staticswift.co.uk">staticswift.co.uk</a></p>' +
        '</div>';
      stageUpdate = { stage: 'building' };

    } else if (emailType === 'preview') {
      if (!previewUrl) return { statusCode: 400, body: JSON.stringify({ error: 'previewUrl required for preview email' }) };
      subject = 'Your ' + (client.business_name || '') + ' website preview is ready';
      // previewUrl is always the portal URL now
      html = LOGO_HTML +
        '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:0 24px 32px;">' +
        '<h2 style="font-family:sans-serif">Hi ' + (client.name || 'there') + ',</h2>' +
        '<p>Your ' + (client.business_name || 'website') + ' is built and ready to review.</p>' +
        '<p style="text-align:center;margin:28px 0;"><a href="' + previewUrl + '" style="background:#00C8E0;color:#07090f;font-weight:700;padding:14px 28px;border-radius:8px;text-decoration:none;display:inline-block;">View Your Preview &amp; Approve ↗</a></p>' +
        '<p style="font-size:14px;color:#555">Check it on desktop and mobile. From your portal you can approve the design or request changes — everything is handled there.</p>' +
        '<p style="color:#888;font-size:13px;margin-top:28px;">StaticSwift — <a href="https://staticswift.co.uk">staticswift.co.uk</a></p>' +
        '</div>';
      stageUpdate = { stage: 'preview-sent', previewUrl, previewSentAt: new Date().toISOString() };

    } else if (emailType === 'invoice') {
      const isAdvanced = client.package === 'advanced';
      const hasHosting = client.hosting_addon === 'yes';
      const amount = (isAdvanced ? 299 : 149) + (hasHosting ? 29 : 0);


      // Invoice number
      let invoiceNumber = 'SS-' + new Date().getFullYear() + '-001';
      try {
        const next = await incrementInvoiceCounter();
        invoiceNumber = 'SS-' + new Date().getFullYear() + '-' + String(next).padStart(3, '0');
      } catch {}

      subject = 'Invoice ' + invoiceNumber + ' — StaticSwift — £' + amount;
      html = LOGO_HTML +
        '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:0 24px 32px;color:#333">' +
        '<h2 style="font-size:22px;margin-bottom:4px;">Invoice ' + invoiceNumber + '</h2>' +
        '<p style="color:#888;font-size:14px;margin-bottom:28px;">Date: ' + new Date().toLocaleDateString('en-GB') + '</p>' +
        '<table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:28px">' +
        '<tr style="background:#f5f5f5"><th style="padding:10px 14px;text-align:left;border:1px solid #eee">Description</th><th style="padding:10px 14px;text-align:right;border:1px solid #eee">Amount</th></tr>' +
        '<tr><td style="padding:12px 14px;border:1px solid #eee">' + (isAdvanced ? 'Advanced' : 'Starter') + ' Website Design</td><td style="padding:12px 14px;border:1px solid #eee;text-align:right">£' + (isAdvanced ? 299 : 149) + '</td></tr>' +
        (hasHosting ? '<tr><td style="padding:12px 14px;border:1px solid #eee">Hosting Upload Service</td><td style="padding:12px 14px;border:1px solid #eee;text-align:right">£29</td></tr>' : '') +
        '<tr style="background:#f5f5f5;font-weight:700"><td style="padding:12px 14px;border:1px solid #eee">Total Due</td><td style="padding:12px 14px;border:1px solid #eee;text-align:right;font-size:18px;color:#b8953e">£' + amount + '</td></tr>' +
        '</table>' +
        '<div style="background:#faf8f2;border:1px solid #e8e4d8;border-radius:8px;padding:24px;margin:28px 0">' +
        '<h3 style="font-size:16px;margin:0 0 14px;color:#0b0b0b">Bank Transfer Details</h3>' +
        '<table style="font-size:14px;color:#333;line-height:1.8;width:100%">' +
        '<tr><td style="font-weight:600;padding:2px 16px 2px 0;white-space:nowrap">Beneficiary</td><td>Harry Yule</td></tr>' +
        '<tr><td style="font-weight:600;padding:2px 16px 2px 0;white-space:nowrap">Sort Code</td><td>04-00-75</td></tr>' +
        '<tr><td style="font-weight:600;padding:2px 16px 2px 0;white-space:nowrap">Account No.</td><td>98518224</td></tr>' +
        '<tr><td style="font-weight:600;padding:2px 16px 2px 0;white-space:nowrap">Reference</td><td>' + invoiceNumber + '</td></tr>' +
        '<tr><td style="font-weight:600;padding:2px 16px 2px 0;white-space:nowrap">Bank</td><td>Revolut Ltd</td></tr>' +
        '</table>' +
        '<p style="font-size:12px;color:#888;margin:14px 0 0">For international transfers: IBAN GB64 REVO 0099 7062 6486 05 · BIC REVOGB21</p>' +
        '</div>' +
        '<p style="font-size:14px;color:#555;text-align:center">Please use <strong>' + invoiceNumber + '</strong> as your payment reference.<br>Your website files will be delivered within 1 hour of payment confirmation.</p>' +
        '<p style="color:#888;font-size:13px;margin-top:28px;text-align:center;">StaticSwift — <a href="https://staticswift.co.uk">staticswift.co.uk</a></p>' +
        '</div>';
      stageUpdate = { stage: 'invoice-sent', invoiceNumber, amount, invoiceSentAt: new Date().toISOString() };

    } else if (emailType === 'custom') {
      subject = customSubject || 'Message from StaticSwift';
      html = LOGO_HTML +
        '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:0 24px 32px;">' +
        '<p>' + (customBody || '').replace(/\n/g, '<br>') + '</p>' +
        '<p style="color:#888;font-size:13px;margin-top:28px;">StaticSwift — <a href="https://staticswift.co.uk">staticswift.co.uk</a></p>' +
        '</div>';

    } else {
      return { statusCode: 400, body: JSON.stringify({ error: 'Unknown emailType: ' + emailType }) };
    }

    const transporter = createTransporter();
    await transporter.sendMail({
      from: '"StaticSwift" <' + fromAddr + '>',
      to: toAddr,
      subject,
      html,
      replyTo: fromAddr,
    });

    console.log('[send-email] sent', emailType, 'to', toAddr);

    // Update client record
    const emailLog = Array.isArray(client.emailLog) ? client.emailLog : [];
    emailLog.push({ type: emailType, sentAt: new Date().toISOString(), direction: 'outbound', subject });
    await updateClient(clientId, { ...stageUpdate, emailLog });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, emailType, to: toAddr, subject, invoiceNumber: stageUpdate.invoiceNumber })
    };

  } catch (err) {
    console.error('[send-email] ERROR:', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
