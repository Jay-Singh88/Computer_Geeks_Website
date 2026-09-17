const crypto = require('crypto');
const { sql } = require('../../_lib/db');
const { requireAdmin } = require('../../_lib/auth');
const { computeTotals } = require('../../_lib/invoices');

function normalizeItems(items) {
  return (items || []).map((item) => ({
    description: String(item.description || '').trim(),
    quantity: Number(item.quantity) || 0,
    unitPriceCents: Math.round(Number(item.unitPriceCents) || 0)
  }));
}

module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  if (req.method === 'GET') {
    const { rows } = await sql`
      SELECT i.id, i.number, i.status, i.currency, i.total_cents, i.due_date, i.paid_at, i.created_at,
             c.name AS client_name,
             (i.status = 'sent' AND i.due_date < CURRENT_DATE) AS is_overdue
      FROM invoices i JOIN clients c ON c.id = i.client_id
      ORDER BY i.created_at DESC
    `;
    res.status(200).json({ invoices: rows });
    return;
  }

  if (req.method === 'POST') {
    const { currency, taxRatePercent, dueDate, notes, items } = req.body || {};
    const clientId = Number(req.body && req.body.clientId);
    const normalizedItems = normalizeItems(items);
    if (!clientId || normalizedItems.length === 0) {
      res.status(400).json({ error: 'A client and at least one line item are required' });
      return;
    }
    if (normalizedItems.some((item) => !item.description || item.quantity <= 0)) {
      res.status(400).json({ error: 'Each line item needs a description and a quantity greater than 0' });
      return;
    }

    const { subtotalCents, taxCents, totalCents } = computeTotals(normalizedItems, taxRatePercent);
    const publicToken = crypto.randomUUID();

    const { rows: numberRows } = await sql`SELECT nextval('invoice_number_seq') AS n`;
    const number = `INV-${numberRows[0].n}`;

    const { rows: invoiceRows } = await sql`
      INSERT INTO invoices (number, client_id, currency, subtotal_cents, tax_rate_percent, tax_cents, total_cents, notes, due_date, public_token)
      VALUES (${number}, ${clientId}, ${currency || 'INR'}, ${subtotalCents}, ${taxRatePercent || 0}, ${taxCents}, ${totalCents}, ${notes || null}, ${dueDate || null}, ${publicToken})
      RETURNING id
    `;
    const invoiceId = invoiceRows[0].id;

    for (let i = 0; i < normalizedItems.length; i++) {
      const item = normalizedItems[i];
      const amountCents = Math.round(item.quantity * item.unitPriceCents);
      await sql`
        INSERT INTO invoice_items (invoice_id, description, quantity, unit_price_cents, amount_cents, sort_order)
        VALUES (${invoiceId}, ${item.description}, ${item.quantity}, ${item.unitPriceCents}, ${amountCents}, ${i})
      `;
    }

    res.status(201).json({ id: invoiceId, number });
    return;
  }

  res.status(405).send('Method not allowed');
};
