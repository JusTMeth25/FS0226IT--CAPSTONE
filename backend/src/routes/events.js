const express = require('express');
const prisma = require('../prismaClient');

const router = express.Router();

router.get('/events', async (req, res, next) => {
  try {
    const now = new Date();
    const events = await prisma.event.findMany({
      where: { isActive: true },
      include: { packs: { select: { code: true, name: true } }, missions: { select: { code: true, title: true } } },
      orderBy: { startsAt: 'asc' }
    });

    res.json({
      events: events
        .filter((e) => !e.endsAt || e.endsAt >= now)
        .map((e) => ({
          id: e.code,
          name: e.name,
          description: e.description,
          startsAt: e.startsAt,
          endsAt: e.endsAt,
          bonusDropRate: e.bonusDropRateMultiplier > 1 ? e.bonusDropRateMultiplier - 1 : 0,
          packs: e.packs.map((p) => p.code),
          missions: e.missions.map((m) => m.code)
        }))
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
