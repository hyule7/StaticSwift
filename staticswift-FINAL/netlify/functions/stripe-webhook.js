const { getClients, saveClient } = require('./_db');
const { createTransporter, LOGO_HTML } = require('./_mailer');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const sig = event.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let stripeEvent;
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
  } catch (err) {
    console.error('[stripe-webhook] signature verification failed:', err.message);
    return { statusCode: 400, body: 'Webhook signature verification failed' };
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    const customerEmail = session.customer_details?.email;
    const amountPaid = session.amount_total / 100;

    console.log('[stripe-webhook] payment received:', customerEmail, '£' + amountPaid);

    try {
      // Find matching client by email
      const clients = await getClients();
      const client = clients.find(c =>
        c.delivery_email?.toLowerCase() === customerEmail?.toLowerCase() &&
        (c.stage === 'invoice-sent' || c.stage === 'approved')
      );

      if (client) {
        client.stage = 'paid';
        client.paid = true;
        client.paidAt = new Date().toISOString();
        client.amountPaid = amountPaid;
        client.stripeSessionId = session.id;
        await saveClient(client);
        console.log('[stripe-webhook] marked paid:', client.clientId);

        // Notify Harry
        const fromAddr = process.env.SMTP_USER || 'hello@staticswift.co.uk';
        try {
          const transporter = createTransporter();
          await transporter.sendMail({
            from: '"StaticSwift" <' + fromAddr + '>',
            to: fromAddr,
            subject: '💰 Payment received — ' + client.business_name + ' £' + amountPaid,
            html: LOGO_HTML + `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:0 24px 32px">
              <h2 style="font-family:sans-serif;color:#22c55e">Payment received!</h2>
              <p><strong>${client.name}</strong> (${client.delivery_email}) just paid <strong>£${amountPaid}</strong>.</p>
              <p>Log into the admin dashboard and upload their final files. They are expecting delivery within 1 hour.</p>
              </div>`,
          });
        } catch(e) { console.error('Notify failed:', e.message); }

        // Confirm to customer
        try {
          const transporter = createTransporter();
          await transporter.sendMail({
            from: '"StaticSwift" <' + fromAddr + '>',
            to: client.delivery_email,
            replyTo: fromAddr,
            subject: 'Payment confirmed — your files are being prepared',
            html: LOGO_HTML + `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:0 24px 32px">
              <h2 style="font-family:sans-serif">Payment confirmed!</h2>
              <p>Hi ${client.name || 'there'}, we have received your payment of <strong>£${amountPaid}</strong>.</p>
              <p>Your finished website files will be delivered within <strong>1 hour</strong>.</p>
              ${client.portalUUID ? '<p><a href="https://staticswift.co.uk/client?uuid=' + client.portalUUID + '" style="color:#00C8E0">Track your order in your portal ↗</a></p>' : ''}
              <p style="color:#888;font-size:13px;margin-top:28px">StaticSwift — staticswift.co.uk</p>
              </div>`,
          });
        } catch(e) { console.error('Customer confirm failed:', e.message); }
      } else {
        console.log('[stripe-webhook] no matching client found for:', customerEmail);
      }
    } catch(err) {
      console.error('[stripe-webhook] DB error:', err.message);
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
