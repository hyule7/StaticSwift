const nodemailer = require('nodemailer');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const auth = event.headers['x-admin-password'];
  if (auth !== (process.env.ADMIN_PASSWORD || 'Harry2001!')) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const { to, subject, body, fromMailbox, mode, inReplyTo, references } = JSON.parse(event.body || '{}');
    if (!to || !body) return { statusCode: 400, body: JSON.stringify({ error: 'to and body required' }) };

    const safe = s => String(s == null ? '' : s).replace(/[\r\n]+/g, ' ').trim();
    const toAddr = safe(to);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toAddr)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'invalid to address' }) };
    }
    const rawSubject = safe(subject || '(no subject)');
    const isReply = mode === 'reply' || !!inReplyTo;
    const finalSubject = !isReply
      ? rawSubject
      : (rawSubject.toLowerCase().startsWith('re:') ? rawSubject : 'Re: ' + rawSubject);
    const escapeHtml = s => String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const safeBodyHtml = escapeHtml(body).replace(/\n/g, '<br>');

    const isSupport = fromMailbox === 'support';
    const fromAddr = isSupport
      ? (process.env.SUPPORT_SMTP_USER || 'support@staticswift.co.uk')
      : (process.env.SMTP_USER || 'hello@staticswift.co.uk');
    const fromPass = isSupport
      ? (process.env.SUPPORT_SMTP_PASS || '')
      : (process.env.SMTP_PASS || '');

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.fasthost.co.uk',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: { user: fromAddr, pass: fromPass },
      tls: { rejectUnauthorized: false },
    });

    const mailOpts = {
      from: '"StaticSwift" <' + fromAddr + '>',
      to: toAddr,
      subject: finalSubject,
      html: '<div style="font-family:sans-serif;max-width:600px;line-height:1.6">' + safeBodyHtml + '<br><br><span style="color:#888;font-size:12px">StaticSwift — staticswift.co.uk</span></div>',
      text: body,
      replyTo: fromAddr,
      headers: {
        'List-Unsubscribe': '<mailto:' + fromAddr + '?subject=unsubscribe>, <https://staticswift.co.uk/unsubscribe>',
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    };
    if (isReply && inReplyTo) {
      mailOpts.inReplyTo = inReplyTo;
      mailOpts.references = references || inReplyTo;
    }
    await transporter.sendMail(mailOpts);

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('[send-reply] error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
