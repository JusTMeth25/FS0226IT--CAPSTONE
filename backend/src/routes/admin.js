const express = require('express');
const prisma = require('../prismaClient');
const { verifyToken, loadCurrentUser, requireAdmin } = require('../middleware/auth');
const { serializePublicUser } = require('../utils/serializers');
const { adjustGold } = require('../utils/wallet');
const { importPokemonCards } = require('../services/importers/pokemonImporter');
const { importScryfallCards } = require('../services/importers/scryfallImporter');
const { importYugiohCards } = require('../services/importers/yugiohImporter');
const { importOnePieceCards } = require('../services/importers/onePieceImporter');
const { importDigimonCards } = require('../services/importers/digimonImporter');
const { importLorcanaCards } = require('../services/importers/lorcanaImporter');
const { importRiftboundCards } = require('../services/importers/riftboundImporter');
const { importGundamCards } = require('../services/importers/gundamImporter');

const router = express.Router();
router.use(verifyToken, loadCurrentUser, requireAdmin);

// ---------- Utenti ----------
router.get('/users', async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ users: users.map(serializePublicUser) });
  } catch (err) { next(err); }
});

router.post('/users/:id/ban', async (req, res, next) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { banned: true, banReason: req.body?.reason || null }
    });
    res.json({ user: serializePublicUser(user) });
  } catch (err) { next(err); }
});

router.post('/users/:id/unban', async (req, res, next) => {
  try {
    const user = await prisma.user.update({ where: { id: req.params.id }, data: { banned: false, banReason: null } });
    res.json({ user: serializePublicUser(user) });
  } catch (err) { next(err); }
});

router.patch('/users/:id/gold', async (req, res, next) => {
  try {
    const targetGold = parseInt(req.body?.gold, 10);
    if (!Number.isInteger(targetGold) || targetGold < 0) return res.status(400).json({ error: 'invalid_gold' });

    const user = await prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({ where: { id: req.params.id } });
      if (!current) { const e = new Error('user_not_found'); e.code = 'NOT_FOUND'; throw e; }
      const delta = targetGold - current.gold;
      if (delta === 0) return current;
      return adjustGold(tx, current.id, delta, 'ADMIN_ADJUST', { note: `admin:${req.currentUser.username}` });
    });
    res.json({ user: serializePublicUser(user) });
  } catch (err) {
    if (err.code === 'NOT_FOUND') return res.status(404).json({ error: 'user_not_found' });
    next(err);
  }
});

// ---------- Carte ----------
router.get('/cards', async (req, res, next) => {
  try {
    const cards = await prisma.card.findMany({ include: { artistClass: true }, orderBy: { createdAt: 'desc' } });
    res.json({
      cards: cards.map((c) => ({
        id: c.id, code: c.code, name: c.name, artistClass: c.artistClass?.name || null,
        rarity: c.rarity, source: c.source, setName: c.setName, isActive: c.isActive
      }))
    });
  } catch (err) { next(err); }
});

router.post('/cards', async (req, res, next) => {
  try {
    const { code, name, rarity, variant, imgUrl, fans, style, influence, energy, description, artistClassSlug } = req.body || {};
    if (!code || !name || !rarity) return res.status(400).json({ error: 'missing_fields' });

    let artistClassId = null;
    if (artistClassSlug) {
      const ac = await prisma.artistClass.findUnique({ where: { slug: artistClassSlug } });
      artistClassId = ac?.id || null;
    }

    const card = await prisma.card.create({
      data: {
        code, name, rarity, variant: variant || null, imgUrl: imgUrl || null,
        fans: fans ?? 50, style: style ?? 50, influence: influence ?? 50, energy: energy ?? 50,
        description: description || null, artistClassId, source: 'original'
      }
    });
    res.status(201).json({ card });
  } catch (err) { next(err); }
});

router.patch('/cards/:id', async (req, res, next) => {
  try {
    const allowed = ['name', 'rarity', 'variant', 'imgUrl', 'fans', 'style', 'influence', 'energy', 'description', 'isActive'];
    const data = {};
    for (const key of allowed) if (key in (req.body || {})) data[key] = req.body[key];
    const card = await prisma.card.update({ where: { id: req.params.id }, data });
    res.json({ card });
  } catch (err) { next(err); }
});

// ---------- Pacchetti ----------
router.get('/packs', async (req, res, next) => {
  try {
    const packs = await prisma.pack.findMany({ include: { packDropRates: true, packGuarantees: true }, orderBy: { createdAt: 'desc' } });
    res.json({ packs });
  } catch (err) { next(err); }
});

router.post('/packs', async (req, res, next) => {
  try {
    const { code, name, description, priceGold, cardCount, isFree, freeCooldownHours } = req.body || {};
    if (!code || !name || priceGold == null || !cardCount) return res.status(400).json({ error: 'missing_fields' });
    const pack = await prisma.pack.create({
      data: { code, name, description: description || null, priceGold, cardCount, isFree: !!isFree, freeCooldownHours: freeCooldownHours || 0 }
    });
    res.status(201).json({ pack });
  } catch (err) { next(err); }
});

router.patch('/packs/:id', async (req, res, next) => {
  try {
    const allowed = ['name', 'description', 'priceGold', 'cardCount', 'isFree', 'freeCooldownHours', 'isActive', 'eventId'];
    const data = {};
    for (const key of allowed) if (key in (req.body || {})) data[key] = req.body[key];
    const pack = await prisma.pack.update({ where: { id: req.params.id }, data });
    res.json({ pack });
  } catch (err) { next(err); }
});

router.put('/packs/:id/drop-rates', async (req, res, next) => {
  try {
    const dropRates = req.body?.dropRates || {};
    await prisma.$transaction(async (tx) => {
      await tx.packDropRate.deleteMany({ where: { packId: req.params.id } });
      for (const [rarity, weight] of Object.entries(dropRates)) {
        await tx.packDropRate.create({ data: { packId: req.params.id, rarity, weight: Number(weight) } });
      }
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.put('/packs/:id/guarantees', async (req, res, next) => {
  try {
    const guarantees = req.body?.guarantees || {};
    await prisma.$transaction(async (tx) => {
      await tx.packGuarantee.deleteMany({ where: { packId: req.params.id } });
      for (const [rarity, count] of Object.entries(guarantees)) {
        await tx.packGuarantee.create({ data: { packId: req.params.id, rarity, count: Number(count) } });
      }
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ---------- Import carte esterne ----------
router.post('/import/pokemon', async (req, res, next) => {
  try { res.json(await importPokemonCards(req.body || {})); } catch (err) { next(err); }
});
router.post('/import/scryfall', async (req, res, next) => {
  try { res.json(await importScryfallCards(req.body || {})); } catch (err) { next(err); }
});
router.post('/import/yugioh', async (req, res, next) => {
  try { res.json(await importYugiohCards(req.body || {})); } catch (err) { next(err); }
});
router.post('/import/onepiece', async (req, res, next) => {
  try { res.json(await importOnePieceCards(req.body || {})); } catch (err) { next(err); }
});
router.post('/import/digimon', async (req, res, next) => {
  try { res.json(await importDigimonCards(req.body || {})); } catch (err) { next(err); }
});
router.post('/import/lorcana', async (req, res, next) => {
  try { res.json(await importLorcanaCards(req.body || {})); } catch (err) { next(err); }
});
router.post('/import/riftbound', async (req, res, next) => {
  try { res.json(await importRiftboundCards(req.body || {})); } catch (err) { next(err); }
});
router.post('/import/gundam', async (req, res, next) => {
  try { res.json(await importGundamCards(req.body || {})); } catch (err) { next(err); }
});

// ---------- Missioni ----------
router.get('/missions', async (req, res, next) => {
  try {
    const missions = await prisma.mission.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ missions });
  } catch (err) { next(err); }
});

router.post('/missions', async (req, res, next) => {
  try {
    const { code, title, description, type, targetValue, rewardGold, rewardXp, rewardPack, isDaily, eventId } = req.body || {};
    if (!code || !title || !type || !targetValue) return res.status(400).json({ error: 'missing_fields' });
    const mission = await prisma.mission.create({
      data: { code, title, description: description || null, type, targetValue, rewardGold: rewardGold || 0, rewardXp: rewardXp || 0, rewardPack: rewardPack || null, isDaily: !!isDaily, eventId: eventId || null }
    });
    res.status(201).json({ mission });
  } catch (err) { next(err); }
});

router.patch('/missions/:id', async (req, res, next) => {
  try {
    const allowed = ['title', 'description', 'targetValue', 'rewardGold', 'rewardXp', 'rewardPack', 'isDaily', 'isActive'];
    const data = {};
    for (const key of allowed) if (key in (req.body || {})) data[key] = req.body[key];
    const mission = await prisma.mission.update({ where: { id: req.params.id }, data });
    res.json({ mission });
  } catch (err) { next(err); }
});

// ---------- Eventi ----------
router.get('/events', async (req, res, next) => {
  try {
    const events = await prisma.event.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ events });
  } catch (err) { next(err); }
});

router.post('/events', async (req, res, next) => {
  try {
    const { code, name, description, startsAt, endsAt, bonusDropRateMultiplier } = req.body || {};
    if (!code || !name) return res.status(400).json({ error: 'missing_fields' });
    const event = await prisma.event.create({
      data: {
        code, name, description: description || null,
        startsAt: startsAt ? new Date(startsAt) : null,
        endsAt: endsAt ? new Date(endsAt) : null,
        bonusDropRateMultiplier: bonusDropRateMultiplier ?? 1
      }
    });
    res.status(201).json({ event });
  } catch (err) { next(err); }
});

router.patch('/events/:id', async (req, res, next) => {
  try {
    const allowed = ['name', 'description', 'startsAt', 'endsAt', 'bonusDropRateMultiplier', 'isActive'];
    const data = {};
    for (const key of allowed) {
      if (key in (req.body || {})) {
        data[key] = (key === 'startsAt' || key === 'endsAt') && req.body[key] ? new Date(req.body[key]) : req.body[key];
      }
    }
    const event = await prisma.event.update({ where: { id: req.params.id }, data });
    res.json({ event });
  } catch (err) { next(err); }
});

// ---------- Log ----------
router.get('/logs/pack-openings', async (req, res, next) => {
  try {
    const logs = await prisma.packOpening.findMany({
      include: { user: true, pack: true },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    res.json({ logs: logs.map((l) => ({ id: l.id, user: serializePublicUser(l.user), pack: { name: l.pack.name, code: l.pack.code }, mode: l.mode, goldSpent: l.goldSpent, createdAt: l.createdAt })) });
  } catch (err) { next(err); }
});

router.get('/market/listings', async (req, res, next) => {
  try {
    const listings = await prisma.marketListing.findMany({
      include: { seller: true, card: true },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    res.json({ listings: listings.map((l) => ({ id: l.id, seller: serializePublicUser(l.seller), card: { name: l.card.name, code: l.card.code }, quantity: l.quantity, pricePerUnit: l.pricePerUnit, status: l.status, createdAt: l.createdAt })) });
  } catch (err) { next(err); }
});

router.get('/trades', async (req, res, next) => {
  try {
    const trades = await prisma.trade.findMany({
      include: { fromUser: true, toUser: true },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    res.json({ trades: trades.map((t) => ({ id: t.id, fromUser: serializePublicUser(t.fromUser), toUser: serializePublicUser(t.toUser), status: t.status, createdAt: t.createdAt })) });
  } catch (err) { next(err); }
});

module.exports = router;
