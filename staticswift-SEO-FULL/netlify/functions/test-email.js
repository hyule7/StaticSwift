/*
 * test-email.js
 * ---------------------------------------------------------------
 * Diagnostic: verifies SMTP is configured correctly + sends a real
 * test email to confirm delivery. Use the admin "Test email" button.
 *
 * Returns detailed environment + connection diagnostics so you can
 * see exactly what's missing without trial-and-error.
 */

const nodemailer = require('nodemailer');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const auth = event.headers['x-admin-password'];
  const validPw = process.env.ADMIN_PASSWORD;
  if (!validPw || auth !== validPw) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

  let to;
  try { ({ to } = JSON.parse(event.body || '{}')); } catch {}
  to = to || process.env.SMTP_USER || 'hello@staticswift.co.uk';

  // === ENV DIAGNOSTICS ===
  const env = {
    SMTP_HOST: process.env.SMTP_HOST || 'mail.staticswift.co.uk (default)',
    SMTP_PORT: process.env.SMTP_PORT || '587 (default)',
    SMTP_USER: process.env.SMTP_USER ? '✓ set' : '✗ MISSING',
    SMTP_PASS: process.env.SMTP_PASS ? '✓ set (' + process.env.SMTP_PASS.length + ' chars)' : '✗ MISSING',
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ? '✓ set' : '✗ NOT SET — admin functions will refuse all requests',
    JSONBIN_BIN_ID: process.env.JSONBIN_BIN_ID ? '✓ set' : '✗ MISSING (admin DB)',
    JSONBIN_API_KEY: process.env.JSONBIN_API_KEY ? '✓ set' : '✗ MISSING (admin DB)',
  };

  const missing = [];
  if (!process.env.SMTP_USER) missing.push('SMTP_USER');
  if (!process.env.SMTP_PASS) missing.push('SMTP_PASS');
  if (missing.length) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: false,
        stage: 'env',
        error: 'Required SMTP env vars missing: ' + missing.join(', '),
        env,
        howToFix: [
          'Open Netlify dashboard → your site → Site configuration → Environment variables',
          'Add SMTP_USER = your-mailbox@yourdomain.co.uk',
          'Add SMTP_PASS = the password for that mailbox',
          'Add ADMIN_PASSWORD = your own strong password',
          'Redeploy the site (or trigger a new build)',
          'Click Test email again',
        ],
      }),
    };
  }

  // === SMTP CONNECT TEST ===
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'mail.staticswift.co.uk',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: false,
    requireTLS: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    tls: { rejectUnauthorized: false },
  });

  try {
    await transporter.verify();
  } catch (err) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: false,
        stage: 'connect',
        error: 'SMTP connection failed: ' + err.message,
        env,
        howToFix: [
          'Double-check SMTP_USER + SMTP_PASS are correct in Netlify env vars',
          'Verify SMTP_HOST — common values: mail.staticswift.co.uk, smtp.fasthost.co.uk, smtp.gmail.com',
          'Check the mailbox provider allows SMTP from external IPs (some require app-specific password)',
          'If using FastHosts: confirm SMTP relay is enabled on your mailbox',
        ],
      }),
    };
  }

  // === SEND TEST EMAIL ===
  try {
    const info = await transporter.sendMail({
      from: '"StaticSwift Test" <' + process.env.SMTP_USER + '>',
      to,
      subject: 'StaticSwift email test — ' + new Date().toISOString(),
      text: 'If you can read this, your SMTP config is working.\n\nSent from: test-email Netlify function\nAt: ' + new Date().toUTCString() + '\nFrom: ' + process.env.SMTP_USER + '\nHost: ' + (process.env.SMTP_HOST || 'mail.staticswift.co.uk'),
      html: '<div style="font-family:sans-serif;line-height:1.6;max-width:540px"><h2 style="color:#0066cc">✓ SMTP is working</h2><p>If you can read this, your StaticSwift admin can send emails to clients and prospects.</p><p style="font-size:13px;color:#666">Sent: ' + new Date().toUTCString() + '<br>From: ' + process.env.SMTP_USER + '<br>Host: ' + (process.env.SMTP_HOST || 'mail.staticswift.co.uk') + '</p></div>',
    });
    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        stage: 'sent',
        messageId: info.messageId,
        response: info.response,
        to,
        env,
        note: 'Email sent. Check ' + to + ' inbox (and spam folder).',
      }),
    };
  } catch (err) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: false,
        stage: 'send',
        error: 'Send failed after connect succeeded: ' + err.message,
        env,
      }),
    };
  }
};
