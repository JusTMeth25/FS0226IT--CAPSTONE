const express = require('express');
const prisma = require('../prismaClient');
const { verifyToken, loadCurrentUser } = require('../middleware/auth');
const { recomputeAbsoluteMissions, getOrCreateUserMission } = require('../utils/missions');
const { adjustGold } = require('../utils/wallet');
const { calcLevel } = require('../utils/levelUtils');

const router = express.Router();

async function ensureAllUserMissions(userId) {
  await prisma.$transaction(async (tx) => {
    await recomputeAbsoluteMissions(tx, userId);
    const missions = await tx.mission.findMany({ where: { isActive: true } });
    for (const mission of missions) {
      await getOrCreateUserMission(tx, userId, mission);
    }
  });
}

function serializeMission(mission) {
  const um = mission.userMissions[0] || { progress: 0, completed: false, claimed: false };
  return {
    id: mission.code,
    title: mission.title,
    description: mission.description,
    type: mission.type,
    target: mission.targetValue,
    rewardGold: mission.rewardGold,
    rewardXP: mission.rewardXp,
    pack: mission.rewardPack,
    isDaily: mission.isDaily,
    progress: um.progress,
    completed: um.completed,
    claimed: um.claimed
  };
}

router.get('/missions', verifyToken, loadCurrentUser, async (req, res, next) => {
  try {
    const userId = req.currentUser.id;
    await ensureAllUserMissions(userId);
    const missions = await prisma.mission.findMany({
      where: { isActive: true },
      include: { userMissions: { where: { userId } } }
    });
    res.json({ missions: missions.map(serializeMission) });
  } catch (err) {
    next(err);
  }
});

// Registrata PRIMA di /missions/:missionId/claim: altrimenti Express interpreterebbe
// "daily-login" come un missionId e la richiesta finirebbe nella route generica.
router.post('/missions/daily-login/claim', verifyToken, loadCurrentUser, async (req, res, next) => {
  try {
    const userId = req.currentUser.id;
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      const today = new Date().toDateString();
      if (user.lastLoginDate && user.lastLoginDate.toDateString() === today) {
        const e = new Error('already_claimed'); e.code = 'ALREADY_CLAIMED'; throw e;
      }
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      const streak = user.lastLoginDate && user.lastLoginDate.toDateString() === yesterday ? user.loginStreak + 1 : 1;
      const goldReward = 10 + streak * 2;
      const xpReward = 20 + streak * 3;

      await tx.user.update({ where: { id: userId }, data: { lastLoginDate: new Date(), loginStreak: streak } });
      let updated = await adjustGold(tx, userId, goldReward, 'DAILY_LOGIN', {});
      const xp = updated.xp + xpReward;
      updated = await tx.user.update({ where: { id: userId }, data: { xp, level: calcLevel(xp) } });

      return { ...updated, rewards: { gold: goldReward, xp: xpReward } };
    });

    res.json({ gold: result.gold, xp: result.xp, level: result.level, loginStreak: result.loginStreak, rewards: result.rewards });
  } catch (err) {
    if (err.code === 'ALREADY_CLAIMED') return res.status(409).json({ error: 'already_claimed' });
    next(err);
  }
});

router.post('/missions/:missionId/claim', verifyToken, loadCurrentUser, async (req, res, next) => {
  try {
    const userId = req.currentUser.id;
    const mission = await prisma.mission.findUnique({ where: { code: req.params.missionId } });
    if (!mission) return res.status(404).json({ error: 'mission_not_found' });

    const result = await prisma.$transaction(async (tx) => {
      const um = await tx.userMission.findUnique({ where: { userId_missionId: { userId, missionId: mission.id } } });
      if (!um || !um.completed || um.claimed) {
        const e = new Error('mission_not_claimable'); e.code = 'NOT_CLAIMABLE'; throw e;
      }

      await tx.userMission.update({ where: { id: um.id }, data: { claimed: true } });

      let user = req.currentUser;
      if (mission.rewardGold > 0) {
        user = await adjustGold(tx, userId, mission.rewardGold, 'MISSION_REWARD', { relatedId: mission.id });
      }
      if (mission.rewardXp > 0) {
        const xp = user.xp + mission.rewardXp;
        user = await tx.user.update({ where: { id: userId }, data: { xp, level: calcLevel(xp) } });
      }
      if (mission.rewardPack) {
        await tx.userPackCredit.upsert({
          where: { userId_packCode: { userId, packCode: mission.rewardPack } },
          update: { quantity: { increment: 1 } },
          create: { userId, packCode: mission.rewardPack, quantity: 1 }
        });
      }

      return user;
    });

    res.json({ gold: result.gold, xp: result.xp, level: result.level });
  } catch (err) {
    if (err.code === 'NOT_CLAIMABLE') return res.status(400).json({ error: 'mission_not_claimable' });
    next(err);
  }
});

module.exports = router;
