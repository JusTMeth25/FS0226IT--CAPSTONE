const express = require('express');
const prisma = require('../prismaClient');
const { verifyToken, loadCurrentUser } = require('../middleware/auth');
const { generatePackCards } = require('../utils/packGenerator');
const { adjustGold, InsufficientGoldError } = require('../utils/wallet');
const { incrementMissionsByType, recomputeAbsoluteMissions } = require('../utils/missions');
const { serializeCard } = require('../utils/serializers');

const router = express.Router();

const FREE_PACK_COOLDOWN_MS_PER_HOUR = 60 * 60 * 1000;

router.get('/packs', async (req, res, next) => {
  try {
    const packs = await prisma.pack.findMany({
      where: { isActive: true },
      include: { packDropRates: true, packGuarantees: true }
    });
    res.json({
      packs: packs.map((p) => ({
        id: p.code,
        name: p.name,
        description: p.description,
        price: p.priceGold,
        cardCount: p.cardCount,
        isFree: p.isFree,
        freeCooldownHours: p.freeCooldownHours,
        dropRates: Object.fromEntries(p.packDropRates.map((dr) => [dr.rarity, dr.weight])),
        guarantees: Object.fromEntries(p.packGuarantees.map((g) => [g.rarity, g.count]))
      }))
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/open-pack
 * body: { packId, mode } - packId è il code del pacchetto (es. "pack-base"), mode: 'paid' | 'free' | 'gift'
 * Il server è l'unica fonte di verità per gold, drop-rate e carte vinte.
 */
router.post('/open-pack', verifyToken, loadCurrentUser, async (req, res, next) => {
  try {
    const { packId, mode = 'paid' } = req.body || {};
    if (!packId) return res.status(400).json({ error: 'missing_pack_id' });

    const pack = await prisma.pack.findUnique({
      where: { code: packId },
      include: { packDropRates: true, packGuarantees: true, event: true }
    });
    if (!pack || !pack.isActive) return res.status(404).json({ error: 'pack_not_found' });

    const userId = req.currentUser.id;

    const result = await prisma.$transaction(async (tx) => {
      if (mode === 'gift') {
        const credit = await tx.userPackCredit.findUnique({ where: { userId_packCode: { userId, packCode: pack.code } } });
        if (!credit || credit.quantity <= 0) {
          const err = new Error('no_gift_available');
          err.code = 'NO_GIFT';
          throw err;
        }
        await tx.userPackCredit.update({ where: { id: credit.id }, data: { quantity: { decrement: 1 } } });
      } else if (mode === 'free') {
        if (!pack.isFree) {
          const err = new Error('pack_not_free');
          err.code = 'NOT_FREE';
          throw err;
        }
        const user = await tx.user.findUnique({ where: { id: userId } });
        const cooldownMs = pack.freeCooldownHours * FREE_PACK_COOLDOWN_MS_PER_HOUR;
        if (user.lastFreePackAt && Date.now() - user.lastFreePackAt.getTime() < cooldownMs) {
          const err = new Error('cooldown');
          err.code = 'COOLDOWN';
          throw err;
        }
        await tx.user.update({ where: { id: userId }, data: { lastFreePackAt: new Date() } });
      } else {
        await adjustGold(tx, userId, -pack.priceGold, 'PACK_OPEN_PAID', { relatedId: pack.id });
      }

      const cards = await generatePackCards(tx, pack);

      const packOpening = await tx.packOpening.create({
        data: {
          userId, packId: pack.id,
          mode: mode === 'gift' ? 'GIFT' : mode === 'free' ? 'FREE' : 'PAID',
          goldSpent: mode === 'paid' ? pack.priceGold : 0
        }
      });

      for (const card of cards) {
        await tx.userCard.upsert({
          where: { userId_cardId: { userId, cardId: card.id } },
          update: { quantity: { increment: 1 }, obtainedAt: new Date() },
          create: { userId, cardId: card.id, quantity: 1 }
        });
        await tx.packOpeningCard.create({
          data: { packOpeningId: packOpening.id, cardId: card.id, rarity: card.rarity }
        });
      }

      await incrementMissionsByType(tx, userId, 'open_packs', 1);
      await incrementMissionsByType(tx, userId, 'collect_cards', cards.length);
      for (const card of cards) {
        await incrementMissionsByType(tx, userId, 'collect_rarity', 1, { rarity: card.rarity });
      }
      await recomputeAbsoluteMissions(tx, userId);

      const freshUser = await tx.user.findUnique({ where: { id: userId } });
      return { cards, gold: freshUser.gold };
    });

    res.json({ cards: result.cards.map(serializeCard), gold: result.gold });
  } catch (err) {
    if (err instanceof InsufficientGoldError) return res.status(402).json({ error: 'insufficient_gold' });
    if (err.code === 'COOLDOWN') return res.status(409).json({ error: 'cooldown' });
    if (err.code === 'NO_GIFT') return res.status(409).json({ error: 'no_gift_available' });
    if (err.code === 'NOT_FREE') return res.status(400).json({ error: 'pack_not_free' });
    next(err);
  }
});

module.exports = router;
