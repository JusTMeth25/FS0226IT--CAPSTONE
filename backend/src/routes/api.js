/**
 * Language: JavaScript
 * Minimal API router for VinylDex
 * - Placeholder endpoints for cards, packs, collection, missions
 * - Uses prisma when models exist; otherwise returns sensible defaults
 *
 * Mounted at /api
 */

const express = require('express');
const prisma = require('../prismaClient');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/cards
router.get('/cards', async (req, res, next) => {
  try {
    if (prisma.card) {
      const cards = await prisma.card.findMany();
      return res.json({ cards });
    }
    return res.json({ cards: [], note: 'cards model not found in prisma schema' });
  } catch (err) {
    next(err);
  }
});

// GET /api/packs
router.get('/packs', async (req, res, next) => {
  try {
    if (prisma.pack) {
      const packs = await prisma.pack.findMany();
      return res.json({ packs });
    }
    return res.json({ packs: [], note: 'packs model not found in prisma schema' });
  } catch (err) {
    next(err);
  }
});

// POST /api/open-pack
// body: { packId }
// Minimal placeholder: returns 501 with outline for future implementation
router.post('/open-pack', async (req, res) => {
  res.status(501).json({ error: 'not_implemented', message: 'Pack opening logic will be implemented in a later step' });
});

// GET /api/collection - protected
router.get('/collection', verifyToken, async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    if (prisma.collection) {
      const items = await prisma.collection.findMany({ where: { userId } });
      return res.json({ collection: items });
    }

    return res.json({ collection: [], note: 'collection model not found in prisma schema' });
  } catch (err) {
    next(err);
  }
});

// GET /api/missions
router.get('/missions', async (req, res, next) => {
  try {
    if (prisma.mission) {
      const missions = await prisma.mission.findMany();
      return res.json({ missions });
    }
    // Provide simple example missions for frontend development
    const example = [
      { id: 'm1', title: 'Open 3 packs', reward: { gold: 50 }, completed: false },
      { id: 'm2', title: 'Collect 5 artists', reward: { xp: 100 }, completed: false },
    ];
    return res.json({ missions: example, note: 'example missions' });
  } catch (err) {
    next(err);
  }
});


/**
 * POST /api/migrate
 * Runs Prisma schema push to ensure DB schema is up-to-date and optionally runs the seed script.
 * - Protected by MIGRATE_SECRET header in non-development environments.
 * - Runs `npx prisma db push` and then `node ../seed.js` (if seed exists).
 */
router.post('/migrate', async (req, res) => {
  try {
    const secret = process.env.MIGRATE_SECRET || 'dev-only';
    const provided = req.headers['x-migrate-secret'] || req.query.secret;
    if (process.env.NODE_ENV === 'production' && provided !== secret) {
      return res.status(403).json({ error: 'forbidden' });
    }

    const { exec } = require('child_process');
    // Run prisma db push first
    exec('npx prisma db push', { cwd: process.cwd() }, (err, stdout, stderr) => {
      if (err) {
        return res.status(500).json({ error: 'migrate_failed', details: stderr || String(err) });
      }

      // Attempt to run seed script if present
      const seedPath = require('path').join(process.cwd(), 'backend', 'seed.js');
      const fs = require('fs');
      if (fs.existsSync(seedPath)) {
        exec(`node "${seedPath.replace(/"/g, '\\"')}"`, { cwd: process.cwd() }, (sErr, sOut, sErrOut) => {
          if (sErr) {
            return res.status(500).json({ migrate: stdout, seedError: sErrOut || String(sErr) });
          }
          return res.json({ migrate: stdout, seed: sOut });
        });
      } else {
        return res.json({ migrate: stdout, note: 'seed.js not found' });
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'migrate_exception', message: String(err) });
  }
});

module.exports = router;
