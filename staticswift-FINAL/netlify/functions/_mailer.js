/**
 * _mailer.js — shared email transport
 * 
 * Supports two modes set via MAIL_PROVIDER env var:
 *   fasthosts  — standard SMTP (FastHosts, or any SMTP host)
 *   gmail      — Gmail OAuth2 (default if MAIL_PROVIDER not set)
 *
 * FastHosts SMTP settings:
 *   Host: mail.staticswift.co.uk  (or smtp.fasthost.co.uk)
 *   Port: 587 (TLS) or 465 (SSL)
 *   User: hello@staticswift.co.uk
 *   Pass: your FastHosts mailbox password
 */
const nodemailer = require('nodemailer');

function createTransporter() {
  const provider = process.env.MAIL_PROVIDER || 'gmail';

  if (provider === 'fasthosts') {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'mail.staticswift.co.uk',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for 587
      auth: {
        user: process.env.SMTP_USER || process.env.GMAIL_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: { rejectUnauthorized: false } // FastHosts sometimes needs this
    });
  }

  // Default: Gmail OAuth2
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

const LOGO_HTML = `<div style="text-align:center;padding:16px 0">
  <img src="data:image/png;base64,LOGO_BASE64_PLACEHOLDER" alt="StaticSwift" style="height:48px;width:auto" />
</div>`;

const LOGO_HTML_LARGE = `<div style="text-align:center;padding:16px 0">
  <img src="data:image/png;base64,LOGO_BASE64_PLACEHOLDER" alt="StaticSwift" style="height:64px;width:auto" />
</div>`;

module.exports = { createTransporter, LOGO_HTML, LOGO_HTML_LARGE };
