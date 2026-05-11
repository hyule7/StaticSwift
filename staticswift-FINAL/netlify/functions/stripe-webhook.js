exports.handler = async (event) => {
  // Stripe webhook — configure STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in Netlify env vars to enable
  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
