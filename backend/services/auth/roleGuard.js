// backend/services/auth/roleGuard.js
// Middleware to protect routes based on JWT role

const jwt = require('jsonwebtoken');
const { findUserByEmail } = require('../../utils/db');

// Secret should be from env
const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

/**
 * Verify JWT and extract user info
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

/**
 * Express middleware factory that allows only specified roles.
 * @param {...string} allowedRoles - roles that may access the route
 */
function requireRole(...allowedRoles) {
  return async (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return res.status(401).json({ status: 'error', message: 'Missing auth token' });
    }
    const payload = verifyToken(token);
    if (!payload) {
      return res.status(401).json({ status: 'error', message: 'Invalid auth token' });
    }
    // Attach user info to request for downstream handlers
    req.user = { id: payload.id, role: payload.role };
    // Role check
    if (allowedRoles.length && !allowedRoles.includes(payload.role)) {
      return res.status(403).json({ status: 'error', message: 'Forbidden: insufficient role' });
    }
    // Optional: fetch full user record for convenience
    try {
      const userRecord = await findUserByEmail(payload.email);
      req.userRecord = userRecord || null;
    } catch (_) {}
    next();
  };
}

module.exports = { requireRole, verifyToken };
