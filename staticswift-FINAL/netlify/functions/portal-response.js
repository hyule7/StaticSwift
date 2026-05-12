const { getClients, saveClient } = require('./_db');
const { createTransporter, LOGO_HTML } = require('./_mailer');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { portalUUID, type, notes } = JSON.parse(event.body || '{}');
    if (!portalUUID || !type) return { statusCode: 400, body: JSON.stringify({ error: 'portalUUID and type required' }) };

    const clients = await getClients();
    const client = clients.find(c => c.portalUUID === portalUUID);
    if (!client) return { statusCode: 404, body: JSON.stringify({ error: 'Client not found' }) };

    const fromAddr = process.env.SMTP_USER || 'hello@staticswift.co.uk';

    if (type === 'approve') {
      // Update stage and notify admin
      client.stage = 'approved';
      client.approvedAt = new Date().toISOString();
      client.approvalNotes = notes || '';
      await saveClient(client);

      // Notify Harry
      try {
        const transporter = createTransporter();
        await transporter.sendMail({
          from: '"StaticSwift Portal" <' + fromAddr + '>',
          to: fromAddr,
          subject: client.business_name + ' approved their preview — send invoice',
          html: LOGO_HTML + '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:0 24px 32px">' +
            '<h2>' + client.business_name + ' approved!</h2>' +
            '<p><strong>' + client.name + '</strong> (' + client.delivery_email + ') has approved their preview.</p>' +
            (notes ? '<p><strong>Notes:</strong> ' + notes + '</p>' : '') +
            '<p>Send the invoice now.</p></div>'
        });
      } catch(e) { console.error('Admin notify failed:', e.message); }

    } else if (type === 'changes') {
      client.stage = 'building';
      client.changeRequest = notes;
      client.changeRequestAt = new Date().toISOString();
      await saveClient(client);

      // Notify Harry
      try {
        const transporter = createTransporter();
        await transporter.sendMail({
          from: '"StaticSwift Portal" <' + fromAddr + '>',
          to: fromAddr,
          subject: client.business_name + ' has requested changes',
          html: LOGO_HTML + '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:0 24px 32px">' +
            '<h2>' + client.business_name + ' wants changes</h2>' +
            '<p><strong>' + client.name + '</strong> (' + client.delivery_email + ') has submitted a change request:</p>' +
            '<blockquote style="border-left:3px solid #00C8E0;padding-left:16px;color:#555">' + (notes || 'No notes provided') + '</blockquote></div>'
        });
      } catch(e) { console.error('Admin notify failed:', e.message); }
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('[portal-response] error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
