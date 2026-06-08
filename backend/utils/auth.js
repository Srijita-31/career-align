// utils/auth.js
// Authentication utilities using JWT
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const JWT_SECRET = process.env.JWT_SECRET || 'replace-with-strong-secret';
const JWT_EXPIRES_IN = '7d'; // token validity
const JWT_RESET_SECRET = process.env.JWT_RESET_SECRET || JWT_SECRET;
const JWT_RESET_EXPIRES_IN = '1h';

/**
 * Hash a plain‑text password.
 * @param {string} password
 * @returns {Promise<string>} bcrypt hash
 */
async function hashPassword(password) {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

/**
 * Verify a password against a stored bcrypt hash.
 * @param {string} password
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

/**
 * Generate a JWT for a given payload (e.g., user id & role).
 * @param {object} payload
 * @returns {string}
 */
function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function generateResetToken(email) {
  return jwt.sign({ email, type: 'password_reset' }, JWT_RESET_SECRET, { expiresIn: JWT_RESET_EXPIRES_IN });
}

function verifyResetToken(token) {
  const payload = jwt.verify(token, JWT_RESET_SECRET);
  if (payload.type !== 'password_reset' || !payload.email) {
    throw new Error('Invalid reset token.');
  }
  return payload.email;
}

/**
 * Middleware to verify JWT on protected routes.
 * Attaches `req.user` with payload if valid.
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return res.status(401).json({ status: 'error', message: 'Missing token' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ status: 'error', message: 'Invalid token' });
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  generateResetToken,
  verifyResetToken,
  authMiddleware,
};
