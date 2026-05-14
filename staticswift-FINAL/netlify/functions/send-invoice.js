const { getClient, updateClient, incrementInvoiceCounter } = require('./_db');
const { createTransporter, LOGO_HTML } = require('./_mailer');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const auth = event.headers['x-admin-password'];
  if (auth !== (process.env.ADMIN_PASSWORD || 'Harry2001!')) return { statusCode: 401, body: 'Unauthorized' };
  try {
    // Invoice sending is handled by send-email with emailType='invoice'
    return { statusCode: 200, body: JSON.stringify({ ok: true, message: 'Use send-email with emailType=invoice' }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
