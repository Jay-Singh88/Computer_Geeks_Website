const {
  verifyPassword,
  createSessionCookie,
  getClientIp,
  checkLoginRateLimit,
  recordFailedLogin,
  resetLoginAttempts
} = require('../_lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  const ip = getClientIp(req);
  const limit = await checkLoginRateLimit(ip);
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfterSeconds));
    res.status(429).json({ error: 'Too many failed attempts. Try again later.' });
    return;
  }

  const { password } = req.body || {};
  if (!password || !verifyPassword(password)) {
    await recordFailedLogin(ip);
    res.status(401).json({ error: 'Incorrect password' });
    return;
  }

  await resetLoginAttempts(ip);
  res.setHeader('Set-Cookie', createSessionCookie(req));
  res.status(200).json({ ok: true });
};
