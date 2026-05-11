const { getClientStore, getMetaStore, getNurtureStore, getSupportStore } = require('./_store');
const { createTransporter, LOGO_HTML } = require('./_mailer');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  try {
    const { email, business_type } = JSON.parse(event.body || '{}');
    if (!email) return { statusCode: 400, body: 'Email required' };
    const now = Date.now();
    const store = getNurtureStore();
    const key = `nurture_${email.replace(/[^a-z0-9]/gi,'_')}`;
    await store.setJSON(key, {
      email, business_type: business_type || '',
      createdAt: new Date(now).toISOString(),
      day3Due: new Date(now + 3*24*60*60*1000).toISOString(),
      day5Due: new Date(now + 5*24*60*60*1000).toISOString(),
      day3Sent: false, day5Sent: false,
    });
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"StaticSwift" <${process.env.SMTP_USER || process.env.GMAIL_USER}>`,
      to: email,
      subject: '3 real examples of what StaticSwift builds',
      html: `${LOGO_HTML}<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:0 24px 32px;">
        <p>Hi,</p>
        <p>Thanks for your interest. Here are three examples of real StaticSwift sites:</p>
        <p><a href="https://staticswift.co.uk/example.html">staticswift.co.uk/example</a> — Fade and Blade Barbers, Manchester, Starter Site £149</p>
        <p>Each one built in under 24 hours from a short brief. Delivered as a file the client owns forever.</p>
        <p>Ready to get yours? <a href="https://staticswift.co.uk/#get-started">staticswift.co.uk</a> — no payment until you love the preview.</p>
        <p style="color:#888;font-size:13px;margin-top:28px;">StaticSwift — <a href="https://staticswift.co.uk">staticswift.co.uk</a></p>
      </div>`
    });
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('nurture-signup error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
