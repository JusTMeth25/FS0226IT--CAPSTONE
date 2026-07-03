/**
 * Language: JavaScript
 * Prisma client singleton for VinylDex backend
 * Ensures a single PrismaClient instance across modules (prevents too many connections during dev/hot-reload)
 */

const { PrismaClient } = require('@prisma/client');

// Il DB è remoto (Postgres cloud): ogni query dentro una transazione interattiva paga una
// latenza di rete non trascurabile. Il default di Prisma (5s) è troppo stretto per le
// transazioni con più operazioni sequenziali (es. apertura pacchetto con molte carte);
// alziamo il timeout globalmente invece di ripeterlo in ogni singola chiamata $transaction.
const CLIENT_OPTIONS = {
  transactionOptions: { timeout: 20000, maxWait: 10000 }
};

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient(CLIENT_OPTIONS);
} else {
  // Prevent multiple clients in development with nodemon / hot reload
  if (!global.__prisma) {
    global.__prisma = new PrismaClient(CLIENT_OPTIONS);
  }
  prisma = global.__prisma;
}

module.exports = prisma;
