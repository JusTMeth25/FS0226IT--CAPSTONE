const express = require('express');
const prisma = require('../prismaClient');

const router = express.Router();

router.get('/leaderboard', async (req, res, next) => {
  try {
    const type = req.query.type || 'collection';

    if (type === 'gold') {
      const users = await prisma.user.findMany({
        where: { banned: false },
        orderBy: { gold: 'desc' },
        take: 20,
        select: { id: true, username: true, gold: true }
      });
      return res.json({ entries: users.map((u) => ({ userId: u.id, username: u.username, value: u.gold })) });
    }

    if (type === 'battles') {
      const users = await prisma.user.findMany({
        where: { banned: false, battlesWon: { gt: 0 } },
        orderBy: { battlesWon: 'desc' },
        take: 20,
        select: { id: true, username: true, battlesWon: true }
      });
      return res.json({ entries: users.map((u) => ({ userId: u.id, username: u.username, value: u.battlesWon })) });
    }

    // 'collection' (default): numero di carte uniche possedute
    const grouped = await prisma.userCard.groupBy({
      by: ['userId'],
      _count: { cardId: true },
      orderBy: { _count: { cardId: 'desc' } },
      take: 20
    });
    const users = await prisma.user.findMany({
      where: { id: { in: grouped.map((g) => g.userId) } },
      select: { id: true, username: true }
    });
    const usernameById = new Map(users.map((u) => [u.id, u.username]));

    res.json({
      entries: grouped.map((g) => ({ userId: g.userId, username: usernameById.get(g.userId) || '???', value: g._count.cardId }))
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
