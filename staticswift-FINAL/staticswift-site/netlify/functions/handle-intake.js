const { getStore } = require('@netlify/blobs');
const { createTransporter, LOGO_HTML } = require('./_mailer');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  try {
    const params = new URLSearchParams(event.body);
    const data = Object.fromEntries(params.entries());
    if (data['bot-field']) return { statusCode: 200, body: 'OK' };

    const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2,9)}`;
    const store = getStore('clients');
    await store.setJSON(clientId, {
      ...data, clientId, stage: 'new-lead',
      createdAt: new Date().toISOString(), source: 'intake-form',
    });

    const transporter = createTransporter();

    await transporter.sendMail({
      from: `"StaticSwift" <${process.env.SMTP_USER || process.env.GMAIL_USER}>`,
      to: data.delivery_email,
      subject: `We have received your request — ${data.business_name}`,
      html: `${LOGO_HTML}
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:0 24px 32px;">
          <h2 style="font-size:22px;margin-bottom:8px;">Hi ${data.name},</h2>
          <p>Thanks for getting in touch. We have received all the details for <strong>${data.business_name}</strong>.</p>
          <p>Your preview will be with you within 24 hours. Watch for an email from <a href="mailto:hello@staticswift.co.uk">hello@staticswift.co.uk</a> — check spam if you do not see it.</p>
          <p>No payment until you approve the design. One free revision included.</p>
          <p style="margin-top:32px;color:#888;font-size:13px;">StaticSwift — <a href="https://staticswift.co.uk">staticswift.co.uk</a></p>
        </div>`
    });

    const fieldRows = Object.entries(data).filter(([k]) => k !== 'bot-field')
      .map(([k,v]) => `<tr><td style="padding:6px 12px;font-weight:600;color:#666;width:180px;">${k}</td><td style="padding:6px 12px;">${v}</td></tr>`).join('');
    await transporter.sendMail({
      from: `"StaticSwift Intake" <${process.env.SMTP_USER || process.env.GMAIL_USER}>`,
      to: process.env.OWNER_EMAIL,
      subject: `New intake: ${data.business_name} (${data.package || 'Starter'})`,
      html: `${LOGO_HTML}<div style="font-family:sans-serif;max-width:700px;margin:0 auto;padding:0 24px 32px;">
        <h2>New website order: ${data.business_name}</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">${fieldRows}</table></div>`
    });

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('handle-intake error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
