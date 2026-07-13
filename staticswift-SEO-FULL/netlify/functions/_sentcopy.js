/*
 * _sentcopy.js — save copies of outbound mail into the mailbox "Sent" folder.
 *
 * Sending over SMTP (nodemailer) does NOT put a copy in the IMAP "Sent" folder;
 * only a mail client does that. So the FastHosts webmail Sent folder stays empty
 * even though mail is really going out. This module does what a mail client does:
 * after the dispatcher sends, it IMAP-APPENDs each message to Sent so Harry can
 * see exactly what went out, where he expects it.
 *
 * Batched: one IMAP connection appends all of a run's messages. Fully
 * non-blocking and best-effort — if the append fails, sending is unaffected.
 */
const Imap = require('imap');

// Build a minimal RFC822 message good enough for the Sent folder to display it.
function buildRaw({ from, to, subject, text, messageId, date }) {
  const dt = (date ? new Date(date) : new Date()).toUTCString();
  const mid = messageId || ('<' + Date.now() + '.' + Math.random().toString(36).slice(2) + '@staticswift.co.uk>');
  return [
    'From: ' + from,
    'To: ' + to,
    'Subject: ' + subject,
    'Date: ' + dt,
    'Message-ID: ' + mid,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    text || '',
  ].join('\r\n');
}

function imapConfig(user, pass) {
  return {
    user,
    password: pass,
    // LiveMail IMAP host differs from SMTP; never fall back to SMTP_HOST here.
    host: process.env.IMAP_HOST || 'mail.livemail.co.uk',
    port: parseInt(process.env.IMAP_PORT || '993'),
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
    authTimeout: 8000,
    connTimeout: 8000,
  };
}

// Find the real name of the Sent mailbox (varies: Sent, Sent Items, INBOX.Sent).
function findSentBox(imap) {
  return new Promise((resolve) => {
    imap.getBoxes((err, boxes) => {
      if (err || !boxes) return resolve('Sent');
      const flat = {};
      (function walk(o, prefix) {
        for (const k in o) {
          const full = prefix + k;
          flat[full.toLowerCase()] = full;
          if (o[k] && o[k].children) walk(o[k].children, full + (o[k].delimiter || '/'));
        }
      })(boxes, '');
      const wanted = ['sent', 'sent items', 'sent messages', 'inbox.sent'];
      for (const w of wanted) if (flat[w]) return resolve(flat[w]);
      // any box that ends in "sent"
      const any = Object.keys(flat).find(k => /(^|[./])sent( items| messages)?$/.test(k));
      resolve(any ? flat[any] : 'Sent');
    });
  });
}

// Append many raw messages using ONE connection. Resolves { appended, error }.
function appendMany(user, pass, rawMessages) {
  return new Promise((resolve) => {
    if (!user || !pass || !rawMessages.length) return resolve({ appended: 0 });
    const imap = new Imap(imapConfig(user, pass));
    let appended = 0, error = null, settled = false;
    const done = () => { if (!settled) { settled = true; resolve({ appended, error }); } };
    imap.once('error', (e) => { error = e.message; try { imap.end(); } catch (_) {} });
    imap.once('end', done);
    imap.once('ready', async () => {
      let box = 'Sent';
      try { box = await findSentBox(imap); } catch (_) {}
      let i = 0;
      const next = () => {
        if (i >= rawMessages.length) { try { imap.end(); } catch (_) {} return; }
        imap.append(rawMessages[i], { mailbox: box, flags: ['Seen'] }, (e) => {
          if (!e) appended++; else error = e.message;
          i++; next();
        });
      };
      next();
    });
    try { imap.connect(); } catch (e) { error = e.message; done(); }
  });
}

module.exports = { buildRaw, appendMany };
