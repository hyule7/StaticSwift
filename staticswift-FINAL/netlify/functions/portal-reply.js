const { getClient, updateClient } = require('./_db');
const { createTransporter, LOGO_HTML } = require('./_mailer');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const auth = event.headers['x-admin-password'];
  if (auth !== (process.env.ADMIN_PASSWORD || 'Harry2001!')) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

  try {
    const { clientId, text } = JSON.parse(event.body || '{}');
    if (!clientId || !text) return { statusCode: 400, body: JSON.stringify({ error: 'clientId and text required' }) };

    const client = await getClient(clientId);
    if (!client) return { statusCode: 404, body: JSON.stringify({ error: 'Client not found' }) };

    // Append admin reply to portal thread
    const messages = Array.isArray(client.portalMessages) ? client.portalMessages : [];
    messages.push({ from: 'admin', text, sentAt: new Date().toISOString() });
    await updateClient(clientId, { portalMessages: messages });

    // Email client
    const fromAddr = process.env.SMTP_USER || 'hello@staticswift.co.uk';
    try {
      const transporter = createTransporter();
      await transporter.sendMail({
        from: '"StaticSwift" <' + fromAddr + '>',
        to: client.delivery_email,
        replyTo: fromAddr,
        subject: 'Message from StaticSwift — ' + (client.business_name || ''),
        html: LOGO_HTML + `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:0 24px 32px">
          <p>Hi ${client.name || 'there'},</p>
          <p style="line-height:1.7">${text.replace(/\n/g,'<br>')}</p>
          <p style="margin-top:24px"><a href="${process.env.URL || 'https://staticswift.co.uk'}/.netlify/functions/client-portal?uuid=${client.portalUUID}" style="color:#00C8E0">View your project portal ↗</a></p>
          <p style="color:#888;font-size:13px;margin-top:28px">StaticSwift — staticswift.co.uk</p>
          </div>`,
      });
    } catch(e) { console.error('Portal reply email failed:', e.message); }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('[portal-reply] error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
