const Imap = require('imap');
const { simpleParser } = require('mailparser');

function makeConfig(user, pass) {
  return {
    user,
    password: pass,
    host: process.env.IMAP_HOST || 'imap.fasthost.co.uk',
    port: parseInt(process.env.IMAP_PORT || '993'),
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
    authTimeout: 8000,
    connTimeout: 8000,
  };
}

function fetchMailbox(config, label) {
  return new Promise((resolve) => {
    const emails = [];
    const imap = new Imap(config);

    imap.once('error', (err) => {
      console.error('[fetch-inbox] IMAP error:', label, err.message);
      resolve([]);
    });

    imap.once('ready', () => {
      imap.openBox('INBOX', true, (err, box) => {
        if (err) { imap.end(); return resolve([]); }
        const total = box.messages.total;
        if (total === 0) { imap.end(); return resolve([]); }

        const start = Math.max(1, total - 29);
        const f = imap.seq.fetch(`${start}:${total}`, { bodies: '', struct: true });
        const pending = [];

        f.on('message', (msg) => {
          let buffer = '';
          msg.on('body', (stream) => {
            stream.on('data', (chunk) => { buffer += chunk.toString('utf8'); });
          });
          msg.once('end', () => {
            pending.push(
              simpleParser(buffer).then((parsed) => {
                emails.push({
                  id: parsed.messageId || Math.random().toString(36),
                  mailbox: label,
                  from: parsed.from?.text || '',
                  to: parsed.to?.text || '',
                  subject: parsed.subject || '(no subject)',
                  date: parsed.date?.toISOString() || new Date().toISOString(),
                  text: parsed.text || '',
                  html: parsed.html || '',
                  snippet: (parsed.text || '').slice(0, 120).replace(/\n/g, ' '),
                });
              }).catch(() => {})
            );
          });
        });

        f.once('error', () => {});
        f.once('end', () => {
          Promise.all(pending).then(() => imap.end());
        });
      });
    });

    imap.once('end', () => resolve(emails));
    imap.connect();
  });
}

exports.handler = async (event) => {
  const auth = event.headers['x-admin-password'];
  if (auth !== (process.env.ADMIN_PASSWORD || 'Harry2001!')) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const helloUser = process.env.SMTP_USER || 'hello@staticswift.co.uk';
  const helloPass = process.env.SMTP_PASS || '';
  const supportUser = process.env.SUPPORT_SMTP_USER || 'support@staticswift.co.uk';
  const supportPass = process.env.SUPPORT_SMTP_PASS || '';

  if (!helloPass || !supportPass) {
    return { statusCode: 500, body: JSON.stringify({ error: 'SMTP_PASS and SUPPORT_SMTP_PASS must be set in Netlify env vars' }) };
  }

  try {
    const [hello, support] = await Promise.all([
      fetchMailbox(makeConfig(helloUser, helloPass), 'hello'),
      fetchMailbox(makeConfig(supportUser, supportPass), 'support'),
    ]);

    const all = [...hello, ...support].sort((a, b) => new Date(b.date) - new Date(a.date));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(all),
    };
  } catch (err) {
    console.error('[fetch-inbox] error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
