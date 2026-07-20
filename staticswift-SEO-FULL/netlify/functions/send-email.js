const { getClient, updateClient, incrementInvoiceCounter } = require('./_db');
const { createTransporter, LOGO_HTML } = require('./_mailer');
const { shell } = require('./_email-template');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const auth = event.headers['x-admin-password'];
  const validPw = process.env.ADMIN_PASSWORD;
  if (!validPw || auth !== validPw) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { clientId, emailType, previewUrl, customSubject, customBody } = body;
    if (!emailType) return { statusCode: 400, body: JSON.stringify({ error: 'emailType required' }) };

    // Check SMTP config before doing anything
    const provider = process.env.MAIL_PROVIDER || 'fasthosts';
    if (provider === 'fasthosts' && (!process.env.SMTP_USER || !process.env.SMTP_PASS)) {
      return { statusCode: 500, body: JSON.stringify({ error: 'SMTP not configured — add SMTP_USER and SMTP_PASS in Netlify environment variables' }) };
    }

    // -----------------------------------------------------------------
    // generated-invoice: pre-rendered invoice HTML coming from /invoice/
    // - Does NOT require clientId (manual invoices work too)
    // - If clientId provided, looks up client to update stage + emailLog
    // - Always uses provided toEmail (the generator's client.email field)
    // -----------------------------------------------------------------
    if (emailType === 'generated-invoice') {
      const { toEmail, toName, subject, invoiceHtml, invoiceNumber, amount, currency } = body;
      if (!toEmail) return { statusCode: 400, body: JSON.stringify({ error: 'toEmail required' }) };
      if (!invoiceHtml) return { statusCode: 400, body: JSON.stringify({ error: 'invoiceHtml required' }) };

      const fromAddr = process.env.SMTP_USER || process.env.GMAIL_USER || 'hello@staticswift.co.uk';
      const subj = subject || ('Invoice ' + (invoiceNumber || '') + ' — StaticSwift');

      const transporter = createTransporter();
      await transporter.sendMail({
        from: '"StaticSwift" <' + fromAddr + '>',
        to: toName ? ('"' + toName + '" <' + toEmail + '>') : toEmail,
        subject: subj,
        html: invoiceHtml,
        replyTo: fromAddr,
      });

      console.log('[send-email] sent generated-invoice', invoiceNumber, 'to', toEmail);

      // If this invoice is tied to a pipeline client, update their record
      if (clientId) {
        try {
          const client = await getClient(clientId);
          if (client) {
            const emailLog = Array.isArray(client.emailLog) ? client.emailLog : [];
            emailLog.push({ type: 'generated-invoice', sentAt: new Date().toISOString(), direction: 'outbound', subject: subj });
            await updateClient(clientId, {
              stage: 'invoice-sent',
              invoiceNumber: invoiceNumber || client.invoiceNumber,
              amount: amount || client.amount,
              currency: currency || 'GBP',
              invoiceSentAt: new Date().toISOString(),
              emailLog,
            });
          }
        } catch (e) {
          console.warn('[send-email] generated-invoice: client update failed', e.message);
        }
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true, emailType, to: toEmail, subject: subj, invoiceNumber }),
      };
    }

    // -----------------------------------------------------------------
    // All other emailTypes require a clientId
    // -----------------------------------------------------------------
    if (!clientId) return { statusCode: 400, body: JSON.stringify({ error: 'clientId required' }) };

    const client = await getClient(clientId);
    if (!client) return { statusCode: 404, body: JSON.stringify({ error: 'Client not found in Blobs' }) };

    const toAddr = client.delivery_email;
    if (!toAddr) return { statusCode: 400, body: JSON.stringify({ error: 'Client has no delivery_email' }) };

    const fromAddr = process.env.SMTP_USER || process.env.GMAIL_USER || 'hello@staticswift.co.uk';

    let subject = '';
    let html = '';
    let stageUpdate = {};

    if (emailType === 'confirmation') {
      subject = 'We have received your request — ' + (client.business_name || 'your business');
      const waNum = (client.whatsapp || client.phone || '').replace(/\D/g, '');
      const waLink = waNum ? 'https://wa.me/' + (waNum.startsWith('0') ? '44' + waNum.slice(1) : waNum) : null;
      html = shell(
        '<p style="margin:0 0 14px">Hi ' + (client.name || 'there') + ',</p>' +
        '<p style="margin:0 0 14px">Thanks for getting in touch. I have everything I need for <strong>' + (client.business_name || 'your business') + '</strong>.</p>' +
        '<p style="margin:0 0 14px">Your free working preview will be with you <strong>within 24 hours</strong>, from ' + '<a href="mailto:hello@staticswift.co.uk" style="color:#9C2615">hello@staticswift.co.uk</a>. Worth adding that to your contacts so it lands in your inbox.</p>' +
        (waLink ? '<p style="margin:0 0 14px">I will also <a href="' + waLink + '" style="color:#9C2615">message you on WhatsApp</a> the moment it is ready.</p>' : '') +
        '<p style="margin:0 0 14px">No payment until you approve the design, and one free revision is included.</p>',
        { preheader: 'Your free preview lands within 24 hours.' }
      );
      stageUpdate = { stage: 'building' };

    } else if (emailType === 'preview') {
      if (!previewUrl) return { statusCode: 400, body: JSON.stringify({ error: 'previewUrl required for preview email' }) };
      const bizName = client.business_name || 'your';
      const firstName = (client.name || '').trim().split(/\s+/)[0] || 'there';
      subject = 'Your ' + (client.business_name || 'website') + ' preview — ready to review';
      // Table-based layout so Outlook + Gmail Web both render this cleanly.
      // Bigger CTA, two-line value framing, mobile-safe widths.
      html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f1ea;font-family:Arial,Helvetica,sans-serif;color:#0a0a0a;-webkit-font-smoothing:antialiased">
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f4f1ea">
 <tr><td align="center" style="padding:32px 14px">
  <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 12px 36px rgba(0,0,0,.06)">
   <tr><td style="padding:30px 36px 8px;text-align:left">
    <div style="font-size:20px;font-weight:800;color:#0a0a0a;letter-spacing:-.4px;">StaticSwift</div>
    <div style="font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#b08a3e;margin-top:18px">Preview ready</div>
    <h1 style="font-family:Georgia,serif;font-size:28px;line-height:1.2;color:#0a0a0a;margin:8px 0 18px;font-weight:500">Hi ${firstName.replace(/[<>]/g,'')}, your ${String(bizName).replace(/[<>]/g,'')} site is built.</h1>
    <p style="font-size:15px;line-height:1.65;color:#3a3a3a;margin:0 0 22px">Open it on your phone and on a desktop. Click through every link. If anything looks off — one button on the portal sends me the change request.</p>
   </td></tr>
   <tr><td align="center" style="padding:0 36px 8px">
    <table cellpadding="0" cellspacing="0" border="0">
     <tr><td style="background:#0a0a0a;border-radius:100px;padding:0">
      <a href="${previewUrl}" style="display:inline-block;padding:16px 38px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;letter-spacing:.01em;font-family:Arial,Helvetica,sans-serif">View your preview &rarr;</a>
     </td></tr>
    </table>
   </td></tr>
   <tr><td style="padding:6px 36px 28px;text-align:center">
    <p style="font-size:12px;color:#888;margin:0">Or paste this link in any browser: <a href="${previewUrl}" style="color:#b08a3e;word-break:break-all">${previewUrl}</a></p>
   </td></tr>
   <tr><td style="padding:0 36px 30px">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#faf8f2;border:1px solid #ece6d6;border-radius:10px">
     <tr>
      <td style="padding:18px 20px;font-size:13.5px;line-height:1.6;color:#3a3a3a">
       <strong style="color:#0a0a0a">What to do next</strong><br>
       1. Open the preview on your phone &amp; laptop.<br>
       2. Click every button and link.<br>
       3. From the portal: <strong>Approve</strong> if you love it, or <strong>Request a change</strong> if anything needs a tweak (1 free revision included).
      </td>
     </tr>
    </table>
   </td></tr>
   <tr><td style="padding:0 36px 30px;font-size:13px;color:#555;line-height:1.6">
    No payment is due until you approve the design. Reply to this email any time — it lands straight in my inbox.
   </td></tr>
   <tr><td style="padding:20px 36px 30px;border-top:1px solid #eee;text-align:center;font-size:12px;color:#999">
    Harry &middot; StaticSwift &middot; <a href="https://staticswift.co.uk" style="color:#b08a3e;text-decoration:none">staticswift.co.uk</a>
   </td></tr>
  </table>
 </td></tr>
</table>
</body></html>`;
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
