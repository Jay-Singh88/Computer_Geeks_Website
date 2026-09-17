const Stripe = require('stripe');

let client;
function getStripe() {
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

module.exports = { getStripe };
