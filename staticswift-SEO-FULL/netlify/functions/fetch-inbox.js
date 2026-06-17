const Imap = require('imap');
const { simpleParser } = require('mailparser');

function makeConfig(user, pass) {
  return {
    user,
    password: pass,
    // Default to the SAME mail server the outbound mailer uses
    // (mail.staticswift.co.uk). The old default 'imap.fasthost.co.uk' did not
    // exist, so the ticket system connected to a dead host and pulled nothing.
    host: process.env.IMAP_HOST || process.env.SMTP_HOST || 'mail.staticswift.co.uk',
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
  if (auth !== (process.env.ADMIN_PASSWORD)) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const helloUser = process.env.SMTP_USER || 'hello@staticswift.co.uk';
  const helloPass = process.env.SMTP_PASS || '';
  const supportUser = process.env.SUPPORT_SMTP_USER || 'support@staticswift.co.uk';
  const supportPass = process.env.SUPPORT_SMTP_PASS || '';

  // Fetch each mailbox INDEPENDENTLY. A missing SUPPORT_SMTP_PASS must not kill
  // the hello inbox too (the old all-or-nothing 500 made the ticket system look
  // dead whenever one var was unset). Only error if neither is configured.
  const jobs = [];
  if (helloPass) jobs.push(fetchMailbox(makeConfig(helloUser, helloPass), 'hello'));
  if (supportPass) jobs.push(fetchMailbox(makeConfig(supportUser, supportPass), 'support'));

  if (!jobs.length) {
    return { statusCode: 500, body: JSON.stringify({ error: 'No mailbox password set. Add SMTP_PASS (and optionally SUPPORT_SMTP_PASS) in Netlify env vars, then redeploy.' }) };
  }

  try {
    const boxes = await Promise.all(jobs);
    const all = boxes.flat().sort((a, b) => new Date(b.date) - new Date(a.date));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify(all),
    };
  } catch (err) {
    console.error('[fetch-inbox] error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
