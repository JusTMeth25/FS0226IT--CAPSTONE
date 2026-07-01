const express = require('express');
const prisma = require('../prismaClient');
const { verifyToken, loadCurrentUser } = require('../middleware/auth');
const { serializeCard, serializePublicUser } = require('../utils/serializers');
const { resolveCardByPublicId } = require('../utils/resolveCard');
const { adjustGold } = require('../utils/wallet');

const router = express.Router();

const TRADE_INCLUDE = {
  fromUser: true,
  toUser: true,
  items: { include: { card: { include: { artistClass: true } } } }
};

function serializeTrade(trade) {
  return {
    id: trade.id,
    fromUser: serializePublicUser(trade.fromUser),
    toUser: serializePublicUser(trade.toUser),
    status: trade.status,
    offeredGold: trade.offeredGold,
    requestedGold: trade.requestedGold,
    offeredCards: trade.items.filter((i) => i.direction === 'OFFERED').map((i) => ({ card: serializeCard(i.card), quantity: i.quantity })),
    requestedCards: trade.items.filter((i) => i.direction === 'REQUESTED').map((i) => ({ card: serializeCard(i.card), quantity: i.quantity })),
    createdAt: trade.createdAt,
    updatedAt: trade.updatedAt
  };
}

/** POST /api/trades - crea una proposta di scambio. Le carte/gold offerti vengono messi in escrow. */
router.post('/trades', verifyToken, loadCurrentUser, async (req, res, next) => {
  try {
    const { toUserId, offeredCards = [], offeredGold = 0, requestedCards = [], requestedGold = 0 } = req.body || {};
    if (!toUserId) return res.status(400).json({ error: 'missing_recipient' });

    const fromUserId = req.currentUser.id;
    const toUser = await prisma.user.findFirst({ where: { OR: [{ username: toUserId }, { id: toUserId }] } });
    if (!toUser) return res.status(404).json({ error: 'recipient_not_found' });
    if (toUser.id === fromUserId) return res.status(400).json({ error: 'cannot_trade_with_yourself' });

    const trade = await prisma.$transaction(async (tx) => {
      const created = await tx.trade.create({
        data: { fromUserId, toUserId: toUser.id, offeredGold: Number(offeredGold) || 0, requestedGold: Number(requestedGold) || 0 }
      });

      for (const item of offeredCards) {
        const card = await resolveCardByPublicId(tx, item.cardId);
        if (!card) { const e = new Error('card_not_found'); e.code = 'CARD_NOT_FOUND'; throw e; }
        const qty = parseInt(item.quantity, 10) || 1;
        const userCard = await tx.userCard.findUnique({ where: { userId_cardId: { userId: fromUserId, cardId: card.id } } });
        if (!userCard || userCard.quantity < qty) { const e = new Error('insufficient_quantity'); e.code = 'INSUFFICIENT_QTY'; throw e; }
        await tx.userCard.update({ where: { id: userCard.id }, data: { quantity: { decrement: qty } } });
        await tx.tradeItem.create({ data: { tradeId: created.id, cardId: card.id, quantity: qty, direction: 'OFFERED' } });
      }

      for (const item of requestedCards) {
        const card = await resolveCardByPublicId(tx, item.cardId);
        if (!card) { const e = new Error('card_not_found'); e.code = 'CARD_NOT_FOUND'; throw e; }
        const qty = parseInt(item.quantity, 10) || 1;
        await tx.tradeItem.create({ data: { tradeId: created.id, cardId: card.id, quantity: qty, direction: 'REQUESTED' } });
      }

      if (Number(offeredGold) > 0) {
        await adjustGold(tx, fromUserId, -Number(offeredGold), 'TRADE', { relatedId: created.id, note: 'escrow' });
      }

      return tx.trade.findUnique({ where: { id: created.id }, include: TRADE_INCLUDE });
    });

    res.status(201).json({ trade: serializeTrade(trade) });
  } catch (err) {
    if (err.code === 'CARD_NOT_FOUND') return res.status(404).json({ error: 'card_not_found' });
    if (err.code === 'INSUFFICIENT_QTY') return res.status(400).json({ error: 'insufficient_quantity' });
    next(err);
  }
});

router.get('/trades/incoming', verifyToken, loadCurrentUser, async (req, res, next) => {
  try {
    const trades = await prisma.trade.findMany({
      where: { toUserId: req.currentUser.id },
      include: TRADE_INCLUDE,
      orderBy: { createdAt: 'desc' }
    });
    res.json({ trades: trades.map(serializeTrade) });
  } catch (err) {
    next(err);
  }
});

router.get('/trades/outgoing', verifyToken, loadCurrentUser, async (req, res, next) => {
  try {
    const trades = await prisma.trade.findMany({
      where: { fromUserId: req.currentUser.id },
      include: TRADE_INCLUDE,
      orderBy: { createdAt: 'desc' }
    });
    res.json({ trades: trades.map(serializeTrade) });
  } catch (err) {
    next(err);
  }
});

async function refundEscrow(tx, trade) {
  const offered = trade.items.filter((i) => i.direction === 'OFFERED');
  for (const item of offered) {
    await tx.userCard.upsert({
      where: { userId_cardId: { userId: trade.fromUserId, cardId: item.cardId } },
      update: { quantity: { increment: item.quantity } },
      create: { userId: trade.fromUserId, cardId: item.cardId, quantity: item.quantity }
    });
  }
  if (trade.offeredGold > 0) {
    await adjustGold(tx, trade.fromUserId, trade.offeredGold, 'TRADE', { relatedId: trade.id, note: 'refund' });
  }
}

router.post('/trades/:id/accept', verifyToken, loadCurrentUser, async (req, res, next) => {
  try {
    const userId = req.currentUser.id;
    const result = await prisma.$transaction(async (tx) => {
      const trade = await tx.trade.findUnique({ where: { id: req.params.id }, include: TRADE_INCLUDE });
      if (!trade || trade.status !== 'PENDING') { const e = new Error('trade_not_available'); e.code = 'NOT_AVAILABLE'; throw e; }
      if (trade.toUserId !== userId) { const e = new Error('forbidden'); e.code = 'FORBIDDEN'; throw e; }

      const requested = trade.items.filter((i) => i.direction === 'REQUESTED');
      const offered = trade.items.filter((i) => i.direction === 'OFFERED');

      for (const item of requested) {
        const userCard = await tx.userCard.findUnique({ where: { userId_cardId: { userId, cardId: item.cardId } } });
        if (!userCard || userCard.quantity < item.quantity) {
          const e = new Error('insufficient_quantity'); e.code = 'INSUFFICIENT_QTY'; throw e;
        }
      }

      for (const item of requested) {
        await tx.userCard.update({
          where: { userId_cardId: { userId, cardId: item.cardId } },
          data: { quantity: { decrement: item.quantity } }
        });
        await tx.userCard.upsert({
          where: { userId_cardId: { userId: trade.fromUserId, cardId: item.cardId } },
          update: { quantity: { increment: item.quantity } },
          create: { userId: trade.fromUserId, cardId: item.cardId, quantity: item.quantity }
        });
      }

      for (const item of offered) {
        await tx.userCard.upsert({
          where: { userId_cardId: { userId, cardId: item.cardId } },
          update: { quantity: { increment: item.quantity } },
          create: { userId, cardId: item.cardId, quantity: item.quantity }
        });
      }

      if (trade.requestedGold > 0) {
        await adjustGold(tx, userId, -trade.requestedGold, 'TRADE', { relatedId: trade.id });
        await adjustGold(tx, trade.fromUserId, trade.requestedGold, 'TRADE', { relatedId: trade.id });
      }
      if (trade.offeredGold > 0) {
        await adjustGold(tx, userId, trade.offeredGold, 'TRADE', { relatedId: trade.id });
      }

      return tx.trade.update({ where: { id: trade.id }, data: { status: 'ACCEPTED' }, include: TRADE_INCLUDE });
    });

    res.json({ trade: serializeTrade(result) });
  } catch (err) {
    if (err.code === 'NOT_AVAILABLE') return res.status(404).json({ error: 'trade_not_available' });
    if (err.code === 'FORBIDDEN') return res.status(403).json({ error: 'forbidden' });
    if (err.code === 'INSUFFICIENT_QTY' || err.name === 'InsufficientGoldError') return res.status(400).json({ error: 'insufficient_quantity_or_gold' });
    next(err);
  }
});

router.post('/trades/:id/reject', verifyToken, loadCurrentUser, async (req, res, next) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const trade = await tx.trade.findUnique({ where: { id: req.params.id }, include: TRADE_INCLUDE });
      if (!trade || trade.status !== 'PENDING') { const e = new Error('trade_not_available'); e.code = 'NOT_AVAILABLE'; throw e; }
      if (trade.toUserId !== req.currentUser.id) { const e = new Error('forbidden'); e.code = 'FORBIDDEN'; throw e; }
      await refundEscrow(tx, trade);
      return tx.trade.update({ where: { id: trade.id }, data: { status: 'REJECTED' }, include: TRADE_INCLUDE });
    });
    res.json({ trade: serializeTrade(result) });
  } catch (err) {
    if (err.code === 'NOT_AVAILABLE') return res.status(404).json({ error: 'trade_not_available' });
    if (err.code === 'FORBIDDEN') return res.status(403).json({ error: 'forbidden' });
    next(err);
  }
});

router.post('/trades/:id/cancel', verifyToken, loadCurrentUser, async (req, res, next) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const trade = await tx.trade.findUnique({ where: { id: req.params.id }, include: TRADE_INCLUDE });
      if (!trade || trade.status !== 'PENDING') { const e = new Error('trade_not_available'); e.code = 'NOT_AVAILABLE'; throw e; }
      if (trade.fromUserId !== req.currentUser.id) { const e = new Error('forbidden'); e.code = 'FORBIDDEN'; throw e; }
      await refundEscrow(tx, trade);
      return tx.trade.update({ where: { id: trade.id }, data: { status: 'CANCELLED' }, include: TRADE_INCLUDE });
    });
    res.json({ trade: serializeTrade(result) });
  } catch (err) {
    if (err.code === 'NOT_AVAILABLE') return res.status(404).json({ error: 'trade_not_available' });
    if (err.code === 'FORBIDDEN') return res.status(403).json({ error: 'forbidden' });
    next(err);
  }
});

module.exports = router;
