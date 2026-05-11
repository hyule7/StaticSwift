const { getClientStore, getMetaStore } = require('./_store');
const { createTransporter, LOGO_HTML } = require('./_mailer');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');


exports.handler = async (event) => {
  const sig = event.headers['stripe-signature'];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type !== 'payment_intent.succeeded') {
    return { statusCode: 200, body: 'Event type not handled' };
  }

  try {
    const paymentIntent = stripeEvent.data.object;
    const customerEmail = paymentIntent.receipt_email || paymentIntent.metadata?.email;

    if (!customerEmail) return { statusCode: 200, body: 'No email on payment intent' };

    const store = getClientStore();
    const keys = await store.list();
    let clientKey = null;
    let client = null;

    for (const { key } of keys.blobs) {
      if (key === 'invoice_counter') continue;
      try {
        const candidate = await store.get(key, { type: 'json' });
        if (candidate?.delivery_email?.toLowerCase() === customerEmail.toLowerCase()) {
          clientKey = key;
          client = candidate;
          break;
        }
      } catch { continue; }
    }

    if (!client) return { statusCode: 200, body: 'Client not matched' };

    const portalUUID = uuidv4();

    await store.setJSON(clientKey, {
      ...client,
      stage: 'paid',
      paid: true,
      paidAt: new Date().toISOString(),
      portalUUID,
      emailLog: [
        ...(client.emailLog || []),
        { type: 'payment-confirmed', sentAt: new Date().toISOString() }
      ]
    });

    const portalUrl = `https://staticswift.co.uk/client/${portalUUID}`;
    const transporter = createTransporter();

    const uploadGuideText = `HOW TO GET YOUR WEBSITE LIVE

Quickest free option — Netlify:
1. Go to app.netlify.com and create a free account
2. Click "Add New Site" then "Deploy Manually"
3. Drag your HTML file in — live in under 3 minutes

Need help? Email support@staticswift.co.uk — always free, always a real person.`;

    await transporter.sendMail({
      from: `"StaticSwift" <${process.env.SMTP_USER || process.env.GMAIL_USER}>`,
      to: client.delivery_email,
      subject: `Your StaticSwift website files — ${client.business_name}`,
      html: `${LOGO_HTML}
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:0 24px 32px;">
          <h2 style="font-size:22px;margin-bottom:8px;">Hi ${client.name},</h2>
          <p>Payment confirmed. Your website files are attached.</p>
          <p><strong>Quickest way live — Netlify (completely free):</strong></p>
          <ol style="line-height:2;">
            <li>Go to <a href="https://app.netlify.com">app.netlify.com</a> and create a free account</li>
            <li>Click Add New Site, then Deploy Manually</li>
            <li>Drag your HTML file in — live in 3 minutes</li>
          </ol>
          <p>Your client page to re-download files any time: <a href="${portalUrl}">${portalUrl}</a></p>
          <p>Need help? <a href="mailto:support@staticswift.co.uk">support@staticswift.co.uk</a> — always free, always a real person.</p>
          <p>Know anyone who needs a website? Mention your name at <a href="https://staticswift.co.uk">staticswift.co.uk</a> — we will send you £20.</p>
          <p style="margin-top:32px;color:#888;font-size:13px;">StaticSwift — <a href="https://staticswift.co.uk">staticswift.co.uk</a> &nbsp;|&nbsp; <a href="mailto:support@staticswift.co.uk">support@staticswift.co.uk</a></p>
        </div>`,
      attachments: [
        { filename: 'upload-guide.txt', content: uploadGuideText }
      ]
    });

    return { statusCode: 200, body: JSON.stringify({ ok: true, portalUUID }) };
  } catch (err) {
    console.error('stripe-webhook error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
