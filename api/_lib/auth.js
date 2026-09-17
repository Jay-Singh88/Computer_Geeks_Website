const crypto = require('crypto');
const { sql } = require('./db');

const SESSION_COOKIE = 'admin_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 min

function verifyPassword(password) {
  const stored = process.env.ADMIN_PASSWORD_HASH || '';
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

function sign(value) {
  return crypto.createHmac('sha256', process.env.SESSION_SECRET).update(value).digest('hex');
}

function isLocalHost(req) {
  const host = (req && req.headers && req.headers.host) || '';
  return /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
}

function createSessionCookie(req) {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + SESSION_TTL_MS })).toString('base64url');
  const sig = sign(payload);
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  const secure = isLocalHost(req) ? '' : ' Secure;';
  return `${SESSION_COOKIE}=${payload}.${sig}; Path=/; HttpOnly;${secure} SameSite=Strict; Max-Age=${maxAge}`;
}

function clearSessionCookie(req) {
  const secure = isLocalHost(req) ? '' : ' Secure;';
  return `${SESSION_COOKIE}=; Path=/; HttpOnly;${secure} SameSite=Strict; Max-Age=0`;
}

function isValidSession(req) {
  const raw = req.cookies && req.cookies[SESSION_COOKIE];
  if (!raw) return false;
  const dot = raw.lastIndexOf('.');
  if (dot === -1) return false;
  const payload = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);

  let sigBuf, expectedBuf;
  try {
    sigBuf = Buffer.from(sig, 'hex');
    expectedBuf = Buffer.from(sign(payload), 'hex');
  } catch {
    return false;
  }
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) return false;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof data.exp === 'number' && data.exp > Date.now();
  } catch {
    return false;
  }
}

// SameSite=Strict on the session cookie already blocks cross-site use of it, but this
// is a cheap second layer: reject any state-changing admin request whose Origin header
// (when present) doesn't match the Host it was sent to.
function isSafeOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

function requireAdmin(req, res) {
  if (req.method !== 'GET' && !isSafeOrigin(req)) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  if (!isValidSession(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return fwd.split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

// Brute-force protection for /api/admin/login, backed by Postgres since serverless
// functions don't share in-memory state between invocations.
async function checkLoginRateLimit(ip) {
  const { rows } = await sql`SELECT locked_until FROM login_attempts WHERE ip = ${ip}`;
  const row = rows[0];
  if (row && row.locked_until && new Date(row.locked_until) > new Date()) {
    return { allowed: false, retryAfterSeconds: Math.ceil((new Date(row.locked_until) - Date.now()) / 1000) };
  }
  return { allowed: true };
}

async function recordFailedLogin(ip) {
  const { rows } = await sql`SELECT failed_count, first_failed_at FROM login_attempts WHERE ip = ${ip}`;
  const row = rows[0];
  const windowExpired = !row || (Date.now() - new Date(row.first_failed_at).getTime()) > LOGIN_WINDOW_MS;

  if (windowExpired) {
    await sql`
      INSERT INTO login_attempts (ip, failed_count, first_failed_at, locked_until)
      VALUES (${ip}, 1, now(), NULL)
      ON CONFLICT (ip) DO UPDATE SET failed_count = 1, first_failed_at = now(), locked_until = NULL
    `;
    return;
  }

  const newCount = row.failed_count + 1;
  const lockedUntil = newCount >= LOGIN_MAX_ATTEMPTS ? new Date(Date.now() + LOGIN_WINDOW_MS).toISOString() : null;
  await sql`UPDATE login_attempts SET failed_count = ${newCount}, locked_until = ${lockedUntil} WHERE ip = ${ip}`;
}

async function resetLoginAttempts(ip) {
  await sql`DELETE FROM login_attempts WHERE ip = ${ip}`;
}

module.exports = {
  verifyPassword,
  createSessionCookie,
  clearSessionCookie,
  requireAdmin,
  getClientIp,
  checkLoginRateLimit,
  recordFailedLogin,
  resetLoginAttempts
};
