/**
 * Language: JavaScript
 * Minimal seed script for VinylDex
 *
 * Behavior:
 * - Loads data from ../assets/js/data/*.js when available
 * - Uses backend/src/prismaClient to insert artists, packs and cards when models exist
 * - Safe to run multiple times (uses upsert-like behavior)
 *
 * Run: node backend/seed.js
 */

const path = require('path');
const fs = require('fs');

const prismaClientPath = path.join(__dirname, 'src', 'prismaClient.js');
if (!fs.existsSync(prismaClientPath)) {
  console.error('Prisma client not found at', prismaClientPath);
  process.exit(1);
}
const prisma = require('./src/prismaClient');

async function loadData() {
  const dataDir = path.join(process.cwd(), 'assets', 'js', 'data');

  const artistsFile = path.join(dataDir, 'artists.js');
  const packsFile = path.join(dataDir, 'packs.js');

  const artists = fs.existsSync(artistsFile) ? require(artistsFile) : [];
  const packs = fs.existsSync(packsFile) ? require(packsFile) : [];

  return { artists, packs };
}

async function seed() {
  console.log('VinylDex seed starting...');
  const { artists, packs } = await loadData();

  try {
    // Artists
    if (prisma.artist) {
      for (const a of artists) {
        // attempt upsert by slug or name
        const where = a.slug ? { slug: a.slug } : { name: a.name };
        await prisma.artist.upsert({
          where,
          update: { ...a },
          create: { ...a },
        });
      }
      console.log(`Seeded ${artists.length} artists`);
    } else {
      console.log('Prisma model "artist" not found — skipping artists');
    }

    // Packs
    if (prisma.pack) {
      for (const p of packs) {
        const where = p.id ? { id: p.id } : { name: p.name };
        // create simple pack record
        await prisma.pack.upsert({
          where,
          update: { ...p },
          create: { ...p },
        });
      }
      console.log(`Seeded ${packs.length} packs`);
    } else {
      console.log('Prisma model "pack" not found — skipping packs');
    }

    // Cards: try to derive from packs if prisma.card exists
    if (prisma.card) {
      let total = 0;
      for (const p of packs) {
        const cards = p.cards || [];
        for (const c of cards) {
          const where = c.slug ? { slug: c.slug } : { name: c.name };
          await prisma.card.upsert({
            where,
            update: { ...c, packId: p.id || null },
            create: { ...c, packId: p.id || null },
          });
          total++;
        }
      }
      console.log(`Seeded ${total} cards`);
    } else {
      console.log('Prisma model "card" not found — skipping cards');
    }

    console.log('Seed completed.');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(2);
  }
}

seed();