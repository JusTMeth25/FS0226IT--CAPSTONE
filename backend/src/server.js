/**
 * VinylLegends - Express server
 *
 * To run (locally):
 * 1) cd backend && npm install
 * 2) npx prisma generate
 * 3) npx prisma db push
 * 4) node seed.js
 * 5) npm run dev
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const prisma = require('./prismaClient');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(
  rateLimit({
    windowMs: 60_000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', db: 'unreachable', error: String(err) });
  }
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api', require('./routes/packs'));
app.use('/api', require('./routes/collection'));
app.use('/api', require('./routes/market'));
app.use('/api', require('./routes/trades'));
app.use('/api', require('./routes/missions'));
app.use('/api', require('./routes/events'));
app.use('/api', require('./routes/leaderboard'));
app.use('/api/admin', require('./routes/admin'));

// 404 per rotte /api non riconosciute
app.use('/api', (req, res) => res.status(404).json({ error: 'not_found' }));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'internal_server_error' });
});

app.listen(PORT, () => {
  console.log(`VinylLegends backend listening on http://localhost:${PORT}`);
});
