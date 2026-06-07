/**
 * Language: JavaScript
 * Prisma client singleton for VinylDex backend
 * Ensures a single PrismaClient instance across modules (prevents too many connections during dev/hot-reload)
 */

const { PrismaClient } = require('@prisma/client');

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  // Prevent multiple clients in development with nodemon / hot reload
  if (!global.__prisma) {
    global.__prisma = new PrismaClient();
  }
  prisma = global.__prisma;
}

module.exports = prisma;