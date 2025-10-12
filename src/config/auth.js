const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const JWT_EXPIRES_IN = '7d';

/**
 * Generate JWT token
 */
function generateToken(userId, email, role) {
  return jwt.sign(
    { userId, email, role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Hash password
 */
async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

/**
 * Compare password
 */
async function comparePassword(password, hashedPassword) {
  return bcrypt.compare(password, hashedPassword);
}

/**
 * Authentication middleware
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = decoded;
  next();
}

/**
 * Optional authentication middleware (doesn't fail if no token)
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (decoded) {
      req.user = decoded;
    }
  }
  
  next();
}

/**
 * Admin authorization middleware (requires admin role)
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  next();
}

/**
 * Combined authentication and admin authorization middleware
 */
function authenticateAdmin(req, res, next) {
  authenticate(req, res, (err) => {
    if (err) return next(err);
    requireAdmin(req, res, next);
  });
}

module.exports = {
  generateToken,
  verifyToken,
  hashPassword,
  comparePassword,
  authenticate,
  optionalAuth,
  requireAdmin,
  authenticateAdmin,
};
