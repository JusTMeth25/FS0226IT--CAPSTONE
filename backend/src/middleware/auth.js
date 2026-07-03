/**
 * Language: JavaScript
 * JWT auth middleware for VinylDex backend
 *
 * Exports:
 * - verifyToken: valida il Bearer token e imposta req.user (payload JWT: sub/username/email)
 * - loadCurrentUser: da usare dopo verifyToken, carica l'utente reale dal DB in req.currentUser
 *   (mai fidarsi di gold/ruolo dal payload JWT, possono essere cambiati dopo l'emissione del token)
 *   e blocca l'accesso se l'utente è bannato o è stato cancellato.
 * - requireAdmin: da usare dopo loadCurrentUser, richiede ruolo ADMIN
 * - decodeToken: helper per decodificare senza attaccare alla request
 *
 * Requires process.env.JWT_SECRET
 */

const jwt = require('jsonwebtoken');
const prisma = require('../prismaClient');

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

async function loadCurrentUser(req, res, next) {
  try {
    const userId = req.user?.sub;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(401).json({ error: 'user_not_found' });
    if (user.banned) return res.status(403).json({ error: 'user_banned', reason: user.banReason || null });

    req.currentUser = user;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Come loadCurrentUser, ma non blocca la richiesta se il token manca o non è valido:
 * imposta req.currentUser solo se un token valido e non bannato è presente.
 * Utile per endpoint pubblici che si arricchiscono di dati personalizzati se l'utente è loggato.
 */
async function optionalCurrentUser(req, res, next) {
  const auth = req.headers.authorization || req.headers.Authorization;
  if (!auth || !auth.startsWith('Bearer ')) return next();

  const payload = decodeToken(auth.split(' ')[1]);
  if (!payload?.sub) return next();

  try {
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (user && !user.banned) req.currentUser = user;
    next();
  } catch (err) {
    next(err);
  }
}

function requireAdmin(req, res, next) {
  if (!req.currentUser || req.currentUser.role !== 'ADMIN') {
    return res.status(403).json({ error: 'forbidden' });
  }
  next();
}

function decodeToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

module.exports = { verifyToken, loadCurrentUser, optionalCurrentUser, requireAdmin, decodeToken };
