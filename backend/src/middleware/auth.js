/**
 * Language: JavaScript
 * JWT auth middleware for VinylDex backend
 *
 * Exports:
 * - verifyToken: Express middleware that validates Bearer token and sets req.user
 * - optional decodeToken: helper to decode without attaching to request
 *
 * Requires process.env.JWT_SECRET
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

function verifyToken(req, res, next) {
  const auth = req.headers.authorization || req.headers.Authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing_token' });
  }
  const token = auth.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid_token' });
  }
}

function decodeToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

module.exports = { verifyToken, decodeToken };