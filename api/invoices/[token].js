const { sql } = require('../_lib/db');
const { isOverdue } = require('../_lib/invoices');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).send('Method not allowed');
    return;
  }

  const { token } = req.query;
  const { rows } = await sql`
    SELECT i.*, c.name AS client_name, c.email AS client_email, c.address AS client_address
    FROM invoices i JOIN clients c ON c.id = i.client_id
    WHERE i.public_token = ${token}
  `;
  const invoice = rows[0];
  if (!invoice || invoice.status === 'draft') {
    res.status(404).json({ error: 'Invoice not found' });
    return;
  }

  const { rows: items } = await sql`
    SELECT description, quantity, unit_price_cents, amount_cents
    FROM invoice_items WHERE invoice_id = ${invoice.id} ORDER BY sort_order, id
  `;

  res.status(200).json({
    number: invoice.number,
    status: invoice.status,
    isOverdue: isOverdue(invoice),
    currency: invoice.currency,
    subtotalCents: invoice.subtotal_cents,
    taxCents: invoice.tax_cents,
    taxRatePercent: Number(invoice.tax_rate_percent),
    totalCents: invoice.total_cents,
    notes: invoice.notes,
    dueDate: invoice.due_date,
    issuedAt: invoice.issued_at,
    paidAt: invoice.paid_at,
    client: { name: invoice.client_name, email: invoice.client_email, address: invoice.client_address },
    items: items.map((item) => ({
      description: item.description,
      quantity: Number(item.quantity),
      unitPriceCents: item.unit_price_cents,
      amountCents: item.amount_cents
    }))
  });
};
