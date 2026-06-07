/**
 * VinylDex - Minimal Express server (step 2)
 * - SQLite + Prisma client
 * - Basic middleware: dotenv, cors, rate-limit, json
 * - Placeholder routes for health & api
 *
 * To run (locally):
 * 1) cd backend && npm install
 * 2) npx prisma generate
 * 3) npx prisma db push
 * 4) npm run dev
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const prisma = require('./prismaClient');

const app = express();
const PORT = process.env.PORT || 4000;

// Basic middlewares
app.use(cors());
app.use(express.json());
app.use(
  rateLimit({
    windowMs: 60_000, // 1 minute
    max: 200, // limit requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Health
app.get('/health', async (req, res) => {
  try {
    // quick DB check
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', db: 'unreachable', error: String(err) });
  }
});

const authRouter = require('./routes/auth');
app.use('/api/auth', authRouter);

const apiRouter = require('./routes/api');
app.use('/api', apiRouter);

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'internal_server_error' });
});

// Start
app.listen(PORT, () => {
  console.log(`VinylDex backend listening on http://localhost:${PORT}`);
});