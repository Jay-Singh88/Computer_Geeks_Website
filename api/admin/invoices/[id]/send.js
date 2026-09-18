const { sql } = require('../../../_lib/db');
const { requireAdmin } = require('../../../_lib/auth');
const { sendInvoiceEmail } = require('../../../_lib/email');

module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  const { id } = req.query;
  const { rows } = await sql`
    SELECT i.*, c.email AS client_email, c.name AS client_name
    FROM invoices i JOIN clients c ON c.id = i.client_id
    WHERE i.id = ${id}
  `;
  const invoice = rows[0];
  if (!invoice) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  if (invoice.status === 'void' || invoice.status === 'paid') {
    res.status(400).json({ error: `Cannot send a ${invoice.status} invoice` });
    return;
  }
  if (!invoice.due_date) {
    res.status(400).json({ error: 'Set a due date before sending' });
    return;
  }

  if (invoice.status === 'draft') {
    await sql`UPDATE invoices SET status = 'sent', issued_at = now(), updated_at = now() WHERE id = ${id}`;
  }

  const { rows: itemRows } = await sql`
    SELECT description, quantity, unit_price_cents, amount_cents
    FROM invoice_items WHERE invoice_id = ${id} ORDER BY sort_order, id
  `;

  const money = (cents) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: invoice.currency
  }).format(cents / 100);

  const items = itemRows.map((item) => ({
    description: item.description,
    quantity: Number(item.quantity),
    unitPriceFormatted: money(item.unit_price_cents),
    amountFormatted: money(item.amount_cents)
  }));

  const dueDateFormatted = new Date(invoice.due_date).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Kolkata'
  });

  try {
    await sendInvoiceEmail({
      to: invoice.client_email,
      clientName: invoice.client_name,
      invoiceNumber: invoice.number,
      items,
      subtotalFormatted: money(invoice.subtotal_cents),
      taxFormatted: invoice.tax_cents > 0 ? money(invoice.tax_cents) : null,
      taxRatePercent: invoice.tax_rate_percent,
      totalFormatted: money(invoice.total_cents),
      dueDateFormatted,
      notes: invoice.notes,
      payUrl: `${process.env.SITE_URL}/invoice?t=${invoice.public_token}`,
      businessName: 'Computer Geeks'
    });
  } catch (err) {
    res.status(502).json({ error: `Invoice marked sent, but the email failed: ${err.message}` });
    return;
  }

  res.status(200).json({ ok: true });
};
