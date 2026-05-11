const { getClientStore, getMetaStore } = require('./_store');
const { createTransporter, LOGO_HTML } = require('./_mailer');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  try {
    const { clientId, previewUrl } = JSON.parse(event.body || '{}');
    if (!clientId || !previewUrl) return { statusCode: 400, body: 'clientId and previewUrl required' };
    const store = getClientStore();
    const client = await store.get(clientId, { type: 'json' });
    if (!client) return { statusCode: 404, body: 'Client not found' };
    await store.setJSON(clientId, {
      ...client, stage: 'preview-sent', previewUrl,
      previewSentAt: new Date().toISOString(),
      emailLog: [...(client.emailLog||[]), { type:'preview-sent', sentAt:new Date().toISOString(), direction:'outbound' }]
    });
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"StaticSwift" <${process.env.SMTP_USER || process.env.GMAIL_USER}>`,
      to: client.delivery_email,
      subject: `Your ${client.business_name} website preview is ready`,
      html: `${LOGO_HTML}<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:0 24px 32px;">
        <h2>Hi ${client.name},</h2>
        <p>Your site is built. Take a look:</p>
        <p style="text-align:center;margin:28px 0;"><a href="${previewUrl}" style="background:#00C8E0;color:#07090f;font-weight:700;padding:14px 28px;border-radius:8px;text-decoration:none;display:inline-block;">View Your Preview</a></p>
        <p>Check it on desktop and mobile.</p>
        <p><strong>Happy with it?</strong> Just reply to confirm and I will send the invoice.</p>
        <p><strong>Want any changes?</strong> Reply with the details — one revision is included.</p>
        <p style="color:#888;font-size:13px;margin-top:28px;">StaticSwift — <a href="https://staticswift.co.uk">staticswift.co.uk</a></p>
      </div>`
    });
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('send-preview error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
