const express = require('express');
const prisma = require('../prismaClient');
const { verifyToken, loadCurrentUser } = require('../middleware/auth');
const { serializeCard } = require('../utils/serializers');
const { resolveCardByPublicId } = require('../utils/resolveCard');

const router = express.Router();

/**
 * GET /api/collection
 * Query: search, rarity, set, source, owned ('true' | 'false')
 * Restituisce il catalogo (filtrato) con lo stato di possesso dell'utente autenticato
 * e la percentuale di completamento album.
 */
router.get('/collection', verifyToken, loadCurrentUser, async (req, res, next) => {
  try {
    const { search, rarity, set, source, owned } = req.query;
    const userId = req.currentUser.id;

    const where = { isActive: true };
    if (rarity) where.rarity = rarity;
    if (source) where.source = source;
    if (search) where.name = { contains: String(search), mode: 'insensitive' };
    if (set) {
      where.OR = [
        { setName: { contains: String(set), mode: 'insensitive' } },
        { setCode: { contains: String(set), mode: 'insensitive' } }
      ];
    }

    const [cards, userCards, totalAlbumCards] = await Promise.all([
      prisma.card.findMany({ where, include: { artistClass: true }, orderBy: { name: 'asc' } }),
      prisma.userCard.findMany({ where: { userId } }),
      prisma.albumCard.count()
    ]);

    const ownedMap = new Map(userCards.map((uc) => [uc.cardId, uc]));

    let combined = cards.map((card) => {
      const uc = ownedMap.get(card.id);
      return {
        ...serializeCard(card),
        owned: !!uc,
        quantity: uc?.quantity || 0,
        isFavorite: uc?.isFavorite || false,
        obtainedAt: uc?.obtainedAt || null
      };
    });

    if (owned === 'true') combined = combined.filter((c) => c.owned);
    if (owned === 'false') combined = combined.filter((c) => !c.owned);

    const albumCompletionPercent = totalAlbumCards > 0
      ? Math.round((userCards.length / totalAlbumCards) * 100)
      : 0;

    res.json({ collection: combined, albumCompletionPercent });
  } catch (err) {
    next(err);
  }
});

/** GET /api/cards/:id - lookup pubblico di una singola carta dal catalogo (id = code) */
router.get('/cards/:id', async (req, res, next) => {
  try {
    const card = await prisma.card.findUnique({ where: { code: req.params.id }, include: { artistClass: true } });
    if (!card || !card.isActive) return res.status(404).json({ error: 'card_not_found' });
    res.json({ card: serializeCard(card) });
  } catch (err) {
    next(err);
  }
});

/** POST /api/collection/:cardId/favorite - cardId è il code pubblico della carta */
router.post('/collection/:cardId/favorite', verifyToken, loadCurrentUser, async (req, res, next) => {
  try {
    const card = await resolveCardByPublicId(prisma, req.params.cardId);
    if (!card) return res.status(404).json({ error: 'card_not_found' });

    const userCard = await prisma.userCard.findUnique({
      where: { userId_cardId: { userId: req.currentUser.id, cardId: card.id } }
    });
    if (!userCard) return res.status(404).json({ error: 'card_not_owned' });

    const updated = await prisma.userCard.update({
      where: { id: userCard.id },
      data: { isFavorite: !userCard.isFavorite }
    });

    res.json({ isFavorite: updated.isFavorite });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
