const { sql } = require('../../../_lib/db');
const { requireAdmin } = require('../../../_lib/auth');

module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  const { id } = req.query;
  const { rows } = await sql`SELECT status FROM invoices WHERE id = ${id}`;
  const invoice = rows[0];
  if (!invoice) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  if (invoice.status === 'paid') {
    res.status(400).json({ error: 'A paid invoice cannot be voided' });
    return;
  }

  await sql`UPDATE invoices SET status = 'void', updated_at = now() WHERE id = ${id}`;
  res.status(200).json({ ok: true });
};
