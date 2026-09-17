const { sql } = require('../../_lib/db');
const { requireAdmin } = require('../../_lib/auth');

module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  if (req.method === 'GET') {
    const { rows } = await sql`SELECT id, name, email, phone, address FROM clients ORDER BY name`;
    res.status(200).json({ clients: rows });
    return;
  }

  if (req.method === 'POST') {
    const { name, email, phone, address } = req.body || {};
    if (!name || !email) {
      res.status(400).json({ error: 'Name and email are required' });
      return;
    }
    const { rows } = await sql`
      INSERT INTO clients (name, email, phone, address)
      VALUES (${name}, ${email}, ${phone || null}, ${address || null})
      RETURNING id, name, email, phone, address
    `;
    res.status(201).json({ client: rows[0] });
    return;
  }

  res.status(405).send('Method not allowed');
};
