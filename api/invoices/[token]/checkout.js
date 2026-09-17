const { sql } = require('../../_lib/db');
const { getStripe } = require('../../_lib/stripe');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  const { token } = req.query;
  const { rows } = await sql`
    SELECT i.*, c.email AS client_email
    FROM invoices i JOIN clients c ON c.id = i.client_id
    WHERE i.public_token = ${token}
  `;
  const invoice = rows[0];
  if (!invoice || invoice.status === 'draft') {
    res.status(404).json({ error: 'Invoice not found' });
    return;
  }
  if (invoice.status === 'void') {
    res.status(400).json({ error: 'This invoice has been voided.' });
    return;
  }
  if (invoice.status === 'paid') {
    res.status(400).json({ error: 'This invoice is already paid.' });
    return;
  }

  const stripe = getStripe();

  if (invoice.stripe_checkout_session_id) {
    try {
      const existing = await stripe.checkout.sessions.retrieve(invoice.stripe_checkout_session_id);
      if (existing.status === 'open') {
        res.status(200).json({ url: existing.url });
        return;
      }
    } catch {
      // session no longer retrievable — fall through and create a fresh one
    }
  }

  const { rows: items } = await sql`
    SELECT description, quantity, unit_price_cents
    FROM invoice_items WHERE invoice_id = ${invoice.id} ORDER BY sort_order, id
  `;

  const currency = invoice.currency.toLowerCase();
  const line_items = items.map((item) => ({
    price_data: {
      currency,
      product_data: { name: item.description },
      unit_amount: item.unit_price_cents
    },
    quantity: Number(item.quantity)
  }));

  if (invoice.tax_cents > 0) {
    line_items.push({
      price_data: {
        currency,
        product_data: { name: `Tax (${invoice.tax_rate_percent}%)` },
        unit_amount: invoice.tax_cents
      },
      quantity: 1
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items,
    customer_email: invoice.client_email,
    metadata: { invoice_id: String(invoice.id), invoice_number: invoice.number },
    payment_intent_data: { metadata: { invoice_id: String(invoice.id) } },
    success_url: `${process.env.SITE_URL}/invoice?t=${invoice.public_token}&paid=1`,
    cancel_url: `${process.env.SITE_URL}/invoice?t=${invoice.public_token}`
  });

  await sql`UPDATE invoices SET stripe_checkout_session_id = ${session.id}, updated_at = now() WHERE id = ${invoice.id}`;

  res.status(200).json({ url: session.url });
};
