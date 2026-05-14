const nodemailer = require('nodemailer');

function createTransporter() {
  const provider = process.env.MAIL_PROVIDER || 'fasthosts';

  if (provider === 'fasthosts') {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'mail.staticswift.co.uk',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: { rejectUnauthorized: false }
    });
  }

  // Gmail OAuth2
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: process.env.GMAIL_USER,
      clientId: process.env.GMAIL_CLIENT_ID,
      clientSecret: process.env.GMAIL_CLIENT_SECRET,
      refreshToken: process.env.GMAIL_REFRESH_TOKEN,
    }
  });
}

const LOGO_HTML = `<div style="text-align:center;padding:20px 0 8px;">
  <span style="font-family:sans-serif;font-size:20px;font-weight:700;color:#00C8E0;letter-spacing:-0.5px;">StaticSwift</span>
</div>`;

const LOGO_HTML_LARGE = LOGO_HTML;

module.exports = { createTransporter, LOGO_HTML, LOGO_HTML_LARGE };
