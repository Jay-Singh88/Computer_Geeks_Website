const { sql } = require('./_lib/db');
const { getStripe } = require('./_lib/stripe');

async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  const stripe = getStripe();
  let event;
  try {
    const rawBody = await buffer(req);
    event = stripe.webhooks.constructEvent(rawBody, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const invoiceId = session.metadata && Number(session.metadata.invoice_id);
    if (session.payment_status === 'paid' && invoiceId) {
      const { rows } = await sql`
        UPDATE invoices SET status = 'paid', paid_at = now(), stripe_payment_intent_id = ${session.payment_intent}, updated_at = now()
        WHERE id = ${invoiceId} AND status != 'paid'
        RETURNING number
      `;
      if (rows[0]) {
        await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: process.env.TELEGRAM_CHAT_ID,
            text: `💰 Invoice paid — ${rows[0].number}`
          })
        });
      }
    }
  }

  res.status(200).send('OK');
};

// Stripe signature verification needs the exact raw bytes, so the default
// parsed req.body (used by every other function in this repo) can't be used here.
handler.config = { api: { bodyParser: false } };

module.exports = handler;
