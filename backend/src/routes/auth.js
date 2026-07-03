/**
 * Language: JavaScript
 * Auth routes: register, login, profile (JWT)
 *
 * Exports an Express router mounted at /api/auth
 *
 * Notes:
 * - Requires backend/src/prismaClient.js
 * - Expects process.env.JWT_SECRET
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../prismaClient');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function generateToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * POST /api/auth/register
 * body: { username, email, password }
 */
router.post('/register', async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'missing_fields' });
    }

    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) return res.status(409).json({ error: 'email_taken' });

    const existingUsername = await prisma.user.findUnique({ where: { username } });
    if (existingUsername) return res.status(409).json({ error: 'username_taken' });

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { username, email, passwordHash },
      select: { id: true, username: true, email: true, gold: true, xp: true, level: true, role: true, lastLoginDate: true, loginStreak: true, createdAt: true },
    });

    const token = generateToken(user);
    res.status(201).json({ user, token });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/login
 * body: { email, password }
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'missing_fields' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'invalid_credentials' });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ error: 'invalid_credentials' });
    if (user.banned) return res.status(403).json({ error: 'user_banned', reason: user.banReason || null });

    const publicUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      gold: user.gold,
      xp: user.xp,
      level: user.level,
      role: user.role,
      lastLoginDate: user.lastLoginDate,
      loginStreak: user.loginStreak,
    };

    const token = generateToken(publicUser);
    res.json({ user: publicUser, token });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/profile
 * Protected - returns current user profile (safe fields)
 */
router.get('/profile', verifyToken, async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        gold: true,
        xp: true,
        level: true,
        role: true,
        banned: true,
        lastLoginDate: true,
        loginStreak: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) return res.status(404).json({ error: 'not_found' });
    if (user.banned) return res.status(403).json({ error: 'user_banned' });
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

module.exports = router;