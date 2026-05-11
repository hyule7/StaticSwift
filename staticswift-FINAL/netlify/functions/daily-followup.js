const { getStore } = require('@netlify/blobs');
const { createTransporter, LOGO_HTML } = require('./_mailer');

const hoursSince = (isoDate) => (Date.now() - new Date(isoDate).getTime()) / 3600000;
const daysSince = (isoDate) => hoursSince(isoDate) / 24;

exports.handler = async () => {
  const store = getStore('clients');
  const nurtureStore = getStore('nurture-list');
  const logStore = getStore('meta');
  const transporter = createTransporter();
  const log = [];

  try {
    // --- CLIENTS ---
    const { blobs } = await store.list();

    for (const { key } of blobs) {
      if (key === 'invoice_counter') continue;
      let client;
      try { client = await store.get(key, { type: 'json' }); } catch { continue; }
      if (!client) continue;

      // Rule 1: Preview Sent 48hrs, no payment — send payment reminder
      if (client.stage === 'preview-sent' && client.previewSentAt && hoursSince(client.previewSentAt) >= 48) {
        await transporter.sendMail({
          from: `"StaticSwift" <${process.env.SMTP_USER || process.env.GMAIL_USER}>`,
          to: client.delivery_email,
          subject: `Just checking in — ${client.business_name} preview`,
          html: `${LOGO_HTML}
            <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:0 24px 32px;">
              <h2>Hi ${client.name},</h2>
              <p>Just a nudge in case my last email got buried — your website preview is ready:</p>
              <p style="text-align:center;margin:24px 0;"><a href="${client.previewUrl}" style="background:#00C8E0;color:#07090f;font-weight:700;padding:14px 28px;border-radius:8px;text-decoration:none;">View Your Preview</a></p>
              <p>Once you are happy just reply and I will get the invoice over straight away.</p>
              <p style="color:#888;font-size:13px;margin-top:28px;">StaticSwift — <a href="https://staticswift.co.uk">staticswift.co.uk</a></p>
            </div>`
        });
        await store.setJSON(key, { ...client, stage: 'preview-reminded', emailLog: [...(client.emailLog||[]), { type: 'payment-reminder', sentAt: new Date().toISOString(), direction: 'outbound' }] });
        log.push(`Sent payment reminder to ${client.delivery_email}`);
      }

      // Rule 2: Complete 7 days — send review and referral email
      if (client.stage === 'paid' && client.paidAt && daysSince(client.paidAt) >= 7 && !client.reviewEmailSent) {
        await transporter.sendMail({
          from: `"StaticSwift" <${process.env.SMTP_USER || process.env.GMAIL_USER}>`,
          to: client.delivery_email,
          subject: `How is the new website going? — StaticSwift`,
          html: `${LOGO_HTML}
            <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:0 24px 32px;">
              <h2>Hi ${client.name},</h2>
              <p>Hope the site is already bringing in enquiries.</p>
              <p>If you have a minute, a Google review would mean a lot: <a href="${process.env.GOOGLE_REVIEW_LINK}">${process.env.GOOGLE_REVIEW_LINK}</a></p>
              <p>And if you know anyone who needs a website — mention your name when they order at <a href="https://staticswift.co.uk">staticswift.co.uk</a> and we will send you £20.</p>
              <p>Questions? <a href="mailto:support@staticswift.co.uk">support@staticswift.co.uk</a> — always free.</p>
              <p style="color:#888;font-size:13px;margin-top:28px;">StaticSwift — <a href="https://staticswift.co.uk">staticswift.co.uk</a></p>
            </div>`
        });
        await store.setJSON(key, { ...client, reviewEmailSent: true, emailLog: [...(client.emailLog||[]), { type: 'day7-review', sentAt: new Date().toISOString(), direction: 'outbound' }] });
        log.push(`Sent day-7 review email to ${client.delivery_email}`);
      }

      // Rule 3: Complete 14 days, no review logged — send gentle nudge
      if (client.stage === 'paid' && client.paidAt && daysSince(client.paidAt) >= 14 && client.reviewEmailSent && !client.nudgeSent && !client.reviewLogged) {
        await transporter.sendMail({
          from: `"StaticSwift" <${process.env.SMTP_USER || process.env.GMAIL_USER}>`,
          to: client.delivery_email,
          subject: `One small favour — StaticSwift`,
          html: `${LOGO_HTML}
            <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:0 24px 32px;">
              <h2>Hi ${client.name},</h2>
              <p>Hope everything with the site is going well.</p>
              <p>If you have not left a Google review yet it would genuinely help us: <a href="${process.env.GOOGLE_REVIEW_LINK}">${process.env.GOOGLE_REVIEW_LINK}</a></p>
              <p>Takes 30 seconds. Thank you.</p>
              <p style="color:#888;font-size:13px;margin-top:28px;">StaticSwift — <a href="https://staticswift.co.uk">staticswift.co.uk</a></p>
            </div>`
        });
        await store.setJSON(key, { ...client, nudgeSent: true, emailLog: [...(client.emailLog||[]), { type: 'day14-nudge', sentAt: new Date().toISOString(), direction: 'outbound' }] });
        log.push(`Sent day-14 nudge to ${client.delivery_email}`);
      }

      // Rule 4: Invoice Sent 5 days — flag overdue
      if (client.stage === 'invoice-sent' && client.invoiceSentAt && daysSince(client.invoiceSentAt) >= 5) {
        await store.setJSON(key, { ...client, stage: 'invoice-overdue' });
        log.push(`Flagged invoice overdue: ${client.business_name}`);
      }
    }

    // --- NURTURE SEQUENCE ---
    const { blobs: nurtureBlobs } = await nurtureStore.list();
    const now = new Date();

    for (const { key } of nurtureBlobs) {
      let lead;
      try { lead = await nurtureStore.get(key, { type: 'json' }); } catch { continue; }
      if (!lead) continue;

      // Day 3
      if (!lead.day3Sent && lead.day3Due && now >= new Date(lead.day3Due)) {
        await transporter.sendMail({
          from: `"StaticSwift" <${process.env.SMTP_USER || process.env.GMAIL_USER}>`,
          to: lead.email,
          subject: `How much could you save switching from Wix?`,
          html: `${LOGO_HTML}
            <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:0 24px 32px;">
              <p>Hi,</p>
              <p>Wix costs around £192 per year minimum. Over 3 years that is £576 and you still do not own anything.</p>
              <p>A StaticSwift site is £149 once. You own the file forever. No platform fees. No renewals.</p>
              <p><a href="https://staticswift.co.uk/#get-started">staticswift.co.uk</a> — preview before you pay, money back if you are not happy.</p>
              <p style="color:#888;font-size:13px;margin-top:28px;">StaticSwift — <a href="https://staticswift.co.uk">staticswift.co.uk</a></p>
            </div>`
        });
        await nurtureStore.setJSON(key, { ...lead, day3Sent: true });
        log.push(`Sent nurture day-3 to ${lead.email}`);
      }

      // Day 5
      if (!lead.day5Sent && lead.day5Due && now >= new Date(lead.day5Due)) {
        await transporter.sendMail({
          from: `"StaticSwift" <${process.env.SMTP_USER || process.env.GMAIL_USER}>`,
          to: lead.email,
          subject: `Last one from us — a no-pressure offer`,
          html: `${LOGO_HTML}
            <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:0 24px 32px;">
              <p>Hi,</p>
              <p>Last email from us on this.</p>
              <p>Fill in the form at <a href="https://staticswift.co.uk/#get-started">staticswift.co.uk</a> and we will build you a free preview mockup — no payment, no obligation.</p>
              <p>Love it and pay £149 or £299. Do not love it and walk away with no hard feelings.</p>
              <p><a href="https://staticswift.co.uk/#get-started">staticswift.co.uk</a></p>
              <p style="color:#888;font-size:13px;margin-top:28px;">StaticSwift — <a href="https://staticswift.co.uk">staticswift.co.uk</a></p>
            </div>`
        });
        await nurtureStore.setJSON(key, { ...lead, day5Sent: true });
        log.push(`Sent nurture day-5 to ${lead.email}`);
      }
    }

    // Write automation log
    const today = new Date().toISOString().split('T')[0];
    await logStore.setJSON(`automation_log_${today}`, { date: today, actions: log, runAt: new Date().toISOString() });

    return { statusCode: 200, body: JSON.stringify({ ok: true, actions: log.length, log }) };
  } catch (err) {
    console.error('daily-followup error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
