const express = require('express');
const prisma = require('../prismaClient');
const { verifyToken, loadCurrentUser } = require('../middleware/auth');
const { serializeCard, serializePublicUser } = require('../utils/serializers');
const { resolveCardByPublicId } = require('../utils/resolveCard');
const { adjustGold, InsufficientGoldError } = require('../utils/wallet');
const { incrementMissionsByType, recomputeAbsoluteMissions } = require('../utils/missions');

const router = express.Router();

function serializeListing(listing) {
  return {
    id: listing.id,
    card: serializeCard(listing.card),
    seller: serializePublicUser(listing.seller),
    quantity: listing.quantity,
    pricePerUnit: listing.pricePerUnit,
    status: listing.status,
    createdAt: listing.createdAt
  };
}

/** GET /api/market/listings - pubblico, filtri opzionali: rarity, cardId */
router.get('/market/listings', async (req, res, next) => {
  try {
    const { rarity, cardId } = req.query;
    const where = { status: 'ACTIVE' };
    if (cardId) {
      const card = await resolveCardByPublicId(prisma, cardId);
      where.cardId = card ? card.id : '__none__';
    }
    if (rarity) where.card = { rarity };

    const listings = await prisma.marketListing.findMany({
      where,
      include: { card: { include: { artistClass: true } }, seller: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ listings: listings.map(serializeListing) });
  } catch (err) {
    next(err);
  }
});

/** POST /api/market/list - mette in vendita `quantity` copie di una carta posseduta */
router.post('/market/list', verifyToken, loadCurrentUser, async (req, res, next) => {
  try {
    const { cardId, quantity, pricePerUnit } = req.body || {};
    const qty = parseInt(quantity, 10);
    const price = parseInt(pricePerUnit, 10);
    if (!cardId || !Number.isInteger(qty) || qty <= 0 || !Number.isInteger(price) || price <= 0) {
      return res.status(400).json({ error: 'invalid_input' });
    }

    const card = await resolveCardByPublicId(prisma, cardId);
    if (!card) return res.status(404).json({ error: 'card_not_found' });

    const userId = req.currentUser.id;

    const listing = await prisma.$transaction(async (tx) => {
      const userCard = await tx.userCard.findUnique({ where: { userId_cardId: { userId, cardId: card.id } } });
      if (!userCard || userCard.quantity < qty) {
        const err = new Error('insufficient_quantity');
        err.code = 'INSUFFICIENT_QTY';
        throw err;
      }
      await tx.userCard.update({ where: { id: userCard.id }, data: { quantity: { decrement: qty } } });
      return tx.marketListing.create({
        data: { sellerId: userId, cardId: card.id, quantity: qty, pricePerUnit: price },
        include: { card: { include: { artistClass: true } }, seller: true }
      });
    });

    res.status(201).json({ listing: serializeListing(listing) });
  } catch (err) {
    if (err.code === 'INSUFFICIENT_QTY') return res.status(400).json({ error: 'insufficient_quantity' });
    next(err);
  }
});

/** POST /api/market/buy - acquisto atomico, gold buyer->seller, carta seller->buyer */
router.post('/market/buy', verifyToken, loadCurrentUser, async (req, res, next) => {
  try {
    const { listingId, quantity } = req.body || {};
    const qty = parseInt(quantity, 10) || 1;
    if (!listingId) return res.status(400).json({ error: 'missing_listing_id' });

    const buyerId = req.currentUser.id;

    const result = await prisma.$transaction(async (tx) => {
      const listing = await tx.marketListing.findUnique({ where: { id: listingId }, include: { card: true } });
      if (!listing || listing.status !== 'ACTIVE') {
        const err = new Error('listing_not_available');
        err.code = 'NOT_AVAILABLE';
        throw err;
      }
      if (listing.sellerId === buyerId) {
        const err = new Error('cannot_buy_own_listing');
        err.code = 'OWN_LISTING';
        throw err;
      }
      if (qty <= 0 || qty > listing.quantity) {
        const err = new Error('invalid_quantity');
        err.code = 'INVALID_QTY';
        throw err;
      }

      const total = listing.pricePerUnit * qty;
      await adjustGold(tx, buyerId, -total, 'MARKET_PURCHASE', { relatedId: listing.id });
      await adjustGold(tx, listing.sellerId, total, 'MARKET_SALE', { relatedId: listing.id });

      await tx.userCard.upsert({
        where: { userId_cardId: { userId: buyerId, cardId: listing.cardId } },
        update: { quantity: { increment: qty }, obtainedAt: new Date() },
        create: { userId: buyerId, cardId: listing.cardId, quantity: qty }
      });

      const remaining = listing.quantity - qty;
      const updatedListing = await tx.marketListing.update({
        where: { id: listing.id },
        data: { quantity: remaining, status: remaining <= 0 ? 'SOLD' : 'ACTIVE' },
        include: { card: { include: { artistClass: true } }, seller: true }
      });

      await incrementMissionsByType(tx, buyerId, 'buy_market', 1);
      await incrementMissionsByType(tx, listing.sellerId, 'sell_market', 1);
      await recomputeAbsoluteMissions(tx, buyerId);

      const buyer = await tx.user.findUnique({ where: { id: buyerId } });
      return { listing: updatedListing, gold: buyer.gold };
    });

    res.json({ listing: serializeListing(result.listing), gold: result.gold });
  } catch (err) {
    if (err instanceof InsufficientGoldError) return res.status(402).json({ error: 'insufficient_gold' });
    if (err.code === 'NOT_AVAILABLE') return res.status(404).json({ error: 'listing_not_available' });
    if (err.code === 'OWN_LISTING') return res.status(400).json({ error: 'cannot_buy_own_listing' });
    if (err.code === 'INVALID_QTY') return res.status(400).json({ error: 'invalid_quantity' });
    next(err);
  }
});

/** DELETE /api/market/listings/:id - il venditore ritira l'annuncio, le carte tornano in collezione */
router.delete('/market/listings/:id', verifyToken, loadCurrentUser, async (req, res, next) => {
  try {
    const userId = req.currentUser.id;
    const listing = await prisma.marketListing.findUnique({ where: { id: req.params.id } });
    if (!listing) return res.status(404).json({ error: 'listing_not_found' });
    if (listing.sellerId !== userId) return res.status(403).json({ error: 'forbidden' });
    if (listing.status !== 'ACTIVE') return res.status(400).json({ error: 'listing_not_active' });

    await prisma.$transaction(async (tx) => {
      await tx.userCard.upsert({
        where: { userId_cardId: { userId, cardId: listing.cardId } },
        update: { quantity: { increment: listing.quantity } },
        create: { userId, cardId: listing.cardId, quantity: listing.quantity }
      });
      await tx.marketListing.update({ where: { id: listing.id }, data: { status: 'CANCELLED' } });
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
