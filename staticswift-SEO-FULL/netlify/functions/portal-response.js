const { getClients, saveClient } = require('./_db');
const { createTransporter, LOGO_HTML } = require('./_mailer');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { portalUUID, type, notes } = JSON.parse(event.body || '{}');
    if (!portalUUID || !type) return { statusCode: 400, body: JSON.stringify({ error: 'missing fields' }) };

    const clients = await getClients();
    const client = clients.find(c => c.portalUUID === portalUUID);
    if (!client) return { statusCode: 404, body: JSON.stringify({ error: 'Client not found' }) };

    const fromAddr = process.env.SMTP_USER || 'hello@staticswift.co.uk';

    // Append message to portal thread
    if (!Array.isArray(client.portalMessages)) client.portalMessages = [];
    client.portalMessages.push({
      from: 'client',
      type,
      notes: notes || '',
      sentAt: new Date().toISOString(),
    });

    let transporter = null;
    try { transporter = createTransporter(); } catch(e) { console.error('SMTP error:', e.message); }

    if (type === 'approve') {
      client.stage = 'approved';
      client.approvedAt = new Date().toISOString();
      client.approvalNotes = notes || '';
      await saveClient(client);

      if (transporter) {
        // Auto-send invoice to customer
        const isAdvanced = client.package === 'advanced';
        const hasHosting = client.hosting_addon === 'yes';
        const amount = (isAdvanced ? 299 : 149) + (hasHosting ? 29 : 0);


        try {
          await transporter.sendMail({
            from: '"StaticSwift" <' + fromAddr + '>',
            to: client.delivery_email,
            replyTo: fromAddr,
            subject: 'Invoice ready — ' + (client.business_name || ''),
            html: LOGO_HTML + `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:0 24px 32px">
              <h2 style="font-family:sans-serif">Thanks for approving your preview!</h2>
              <p>Hi ${client.name || 'there'}, your site is signed off. Here is your invoice:</p>
              <table style="width:100%;border-collapse:collapse;font-size:14px;margin:24px 0">
                <tr style="background:#f5f5f5"><td style="padding:10px 14px;border:1px solid #eee">${isAdvanced ? 'Advanced' : 'Starter'} Website Design</td><td style="padding:10px 14px;border:1px solid #eee;text-align:right">£${isAdvanced ? 299 : 149}</td></tr>
                ${hasHosting ? '<tr><td style="padding:10px 14px;border:1px solid #eee">Hosting Upload Service</td><td style="padding:10px 14px;border:1px solid #eee;text-align:right">£29</td></tr>' : ''}
                <tr style="font-weight:700;background:#f5f5f5"><td style="padding:10px 14px;border:1px solid #eee">Total Due</td><td style="padding:10px 14px;border:1px solid #eee;text-align:right;color:#b8953e;font-size:18px">£${amount}</td></tr>
              </table>
              <div style="background:#faf8f2;border:1px solid #e8e4d8;border-radius:8px;padding:20px;margin:24px 0">
                <h3 style="font-size:15px;margin:0 0 12px;color:#0b0b0b">Bank Transfer Details</h3>
                <table style="font-size:13px;color:#333;line-height:1.8"><tr><td style="font-weight:600;padding:2px 14px 2px 0">Beneficiary</td><td>Harry Yule</td></tr><tr><td style="font-weight:600;padding:2px 14px 2px 0">Sort Code</td><td>04-00-75</td></tr><tr><td style="font-weight:600;padding:2px 14px 2px 0">Account No.</td><td>98518224</td></tr><tr><td style="font-weight:600;padding:2px 14px 2px 0">Reference</td><td>INV-${client.business_name || 'STATICSWIFT'}</td></tr><tr><td style="font-weight:600;padding:2px 14px 2px 0">Bank</td><td>Revolut Ltd</td></tr></table>
                <p style="font-size:11px;color:#888;margin:10px 0 0">International: IBAN GB64 REVO 0099 7062 6486 05 · BIC REVOGB21</p>
              </div>
              <p style="font-size:14px;color:#555;text-align:center">Your website files will be delivered within 1 hour of payment confirmation.</p>
              </div>`,
          });
          client.stage = 'invoice-sent';
          client.invoiceSentAt = new Date().toISOString();
          client.amount = amount;
          await saveClient(client);
        } catch(e) { console.error('Invoice email failed:', e.message); }

        // Notify Harry
        try {
          await transporter.sendMail({
            from: '"StaticSwift Portal" <' + fromAddr + '>',
            to: fromAddr,
            subject: '✓ ' + client.business_name + ' approved — invoice auto-sent',
            html: LOGO_HTML + `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:0 24px 32px">
              <h2 style="font-family:sans-serif;color:#22c55e">Approved!</h2>
              <p><strong>${client.name}</strong> (${client.delivery_email}) approved their preview.</p>
              ${notes ? '<p><strong>Notes:</strong> ' + notes + '</p>' : ''}
              <p>Invoice sent automatically. Check the admin pipeline for status.</p>
              </div>`,
          });
        } catch(e) { console.error('Harry notify failed:', e.message); }
      }

    } else if (type === 'changes') {
      client.stage = 'building';
      client.changeRequest = notes;
      client.changeRequestAt = new Date().toISOString();
      await saveClient(client);

      if (transporter) {
        // Notify Harry
        try {
          await transporter.sendMail({
            from: '"StaticSwift Portal" <' + fromAddr + '>',
            to: fromAddr,
            subject: '⚠ ' + client.business_name + ' — change request',
            html: LOGO_HTML + `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:0 24px 32px">
              <h2 style="font-family:sans-serif">Changes requested</h2>
              <p><strong>${client.name}</strong> (${client.delivery_email}) wants changes:</p>
              <blockquote style="border-left:3px solid #00C8E0;padding-left:16px;color:#555;margin:16px 0;font-style:italic">${notes || 'No notes provided'}</blockquote>
              <p>Log into the admin dashboard — they are back in the Building column.</p>
              </div>`,
          });
        } catch(e) { console.error('Harry notify failed:', e.message); }

        // Acknowledge to customer
        try {
          await transporter.sendMail({
            from: '"StaticSwift" <' + fromAddr + '>',
            to: client.delivery_email,
            replyTo: fromAddr,
            subject: 'Change request received — we are on it',
            html: LOGO_HTML + `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:0 24px 32px">
              <h2 style="font-family:sans-serif">Got it, ${client.name || 'there'}.</h2>
              <p>We have received your change request and will have an updated preview ready within 24 hours.</p>
              <p>We will email you as soon as it is ready to review.</p>
              <p style="color:#888;font-size:13px;margin-top:28px">StaticSwift — staticswift.co.uk</p>
              </div>`,
          });
        } catch(e) { console.error('Customer ack failed:', e.message); }
      }

    } else if (type === 'message') {
      // General message from portal
      await saveClient(client);
      if (transporter) {
        try {
          await transporter.sendMail({
            from: '"StaticSwift Portal" <' + fromAddr + '>',
            to: fromAddr,
            subject: '💬 Message from ' + client.business_name,
            html: LOGO_HTML + `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:0 24px 32px">
              <h2 style="font-family:sans-serif">New message from ${client.name}</h2>
              <blockquote style="border-left:3px solid #00C8E0;padding-left:16px;color:#555;margin:16px 0">${notes}</blockquote>
              <p>Reply from the admin dashboard.</p>
              </div>`,
          });
        } catch(e) { console.error('Message notify failed:', e.message); }
      }
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('[portal-response] error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
