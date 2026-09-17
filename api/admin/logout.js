const { clearSessionCookie } = require('../_lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  res.setHeader('Set-Cookie', clearSessionCookie(req));
  res.status(200).json({ ok: true });
};
