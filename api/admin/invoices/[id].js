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
  const { id } = req.query;

  if (req.method === 'GET') {
    const { rows } = await sql`
      SELECT i.*, c.name AS client_name, c.email AS client_email,
             (i.status = 'sent' AND i.due_date < CURRENT_DATE) AS is_overdue
      FROM invoices i JOIN clients c ON c.id = i.client_id
      WHERE i.id = ${id}
    `;
    const invoice = rows[0];
    if (!invoice) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const { rows: items } = await sql`
      SELECT id, description, quantity, unit_price_cents, amount_cents, sort_order
      FROM invoice_items WHERE invoice_id = ${id} ORDER BY sort_order, id
    `;
    res.status(200).json({ invoice, items });
    return;
  }

  if (req.method === 'PATCH') {
    const { rows: existingRows } = await sql`SELECT status FROM invoices WHERE id = ${id}`;
    const existing = existingRows[0];
    if (!existing) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    if (existing.status !== 'draft') {
      res.status(400).json({ error: 'Only draft invoices can be edited. Void and recreate instead.' });
      return;
    }

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

    await sql`
      UPDATE invoices SET
        client_id = ${clientId}, currency = ${currency || 'INR'}, subtotal_cents = ${subtotalCents},
        tax_rate_percent = ${taxRatePercent || 0}, tax_cents = ${taxCents}, total_cents = ${totalCents},
        notes = ${notes || null}, due_date = ${dueDate || null}, updated_at = now()
      WHERE id = ${id}
    `;
    await sql`DELETE FROM invoice_items WHERE invoice_id = ${id}`;
    for (let i = 0; i < normalizedItems.length; i++) {
      const item = normalizedItems[i];
      const amountCents = Math.round(item.quantity * item.unitPriceCents);
      await sql`
        INSERT INTO invoice_items (invoice_id, description, quantity, unit_price_cents, amount_cents, sort_order)
        VALUES (${id}, ${item.description}, ${item.quantity}, ${item.unitPriceCents}, ${amountCents}, ${i})
      `;
    }

    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).send('Method not allowed');
};
