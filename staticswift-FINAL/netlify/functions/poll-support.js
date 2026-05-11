const { getClientStore, getMetaStore, getSupportStore } = require('./_store');
const { google } = require('googleapis');

// Scheduled every 5 minutes via netlify.toml
exports.handler = async () => {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const store = getClientStore();
    const supportStore = getSupportStore();

    // Fetch unread messages from support@staticswift.co.uk
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: 'to:support@staticswift.co.uk is:unread',
      maxResults: 20,
    });

    const messages = listRes.data.messages || [];
    let processed = 0;

    for (const { id } of messages) {
      // Skip if already processed
      const existing = await supportStore.get(`msg_${id}`, { type: 'json' }).catch(() => null);
      if (existing) continue;

      const msgRes = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
      const headers = msgRes.data.payload.headers;
      const from = headers.find(h => h.name === 'From')?.value || '';
      const subject = headers.find(h => h.name === 'Subject')?.value || '(no subject)';
      const date = headers.find(h => h.name === 'Date')?.value || '';

      // Extract email address
      const emailMatch = from.match(/<(.+?)>/) || [null, from];
      const senderEmail = emailMatch[1]?.trim() || from;

      // Extract body
      let body = '';
      const parts = msgRes.data.payload.parts || [msgRes.data.payload];
      for (const part of parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          body = Buffer.from(part.body.data, 'base64').toString('utf-8');
          break;
        }
      }

      // Try to match to a client
      const { blobs } = await store.list();
      let matchedClientId = null;
      for (const { key } of blobs) {
        try {
          const c = await store.get(key, { type: 'json' });
          if (c?.delivery_email?.toLowerCase() === senderEmail.toLowerCase()) {
            matchedClientId = c.clientId;
            // Append to client email log
            await store.setJSON(key, {
              ...c,
              emailLog: [...(c.emailLog || []), {
                type: 'support-inbound', from: senderEmail, subject, body: body.slice(0, 500),
                receivedAt: new Date().toISOString(), direction: 'inbound', gmailId: id
              }]
            });
            break;
          }
        } catch { continue; }
      }

      // Save to support inbox store
      await supportStore.setJSON(`msg_${id}`, {
        gmailId: id, from, senderEmail, subject, body: body.slice(0, 2000),
        date, receivedAt: new Date().toISOString(),
        clientId: matchedClientId, read: false, direction: 'inbound'
      });

      // Mark as read in Gmail
      await gmail.users.messages.modify({ userId: 'me', id, requestBody: { removeLabelIds: ['UNREAD'] } });
      processed++;
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, processed }) };
  } catch (err) {
    console.error('poll-support error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
