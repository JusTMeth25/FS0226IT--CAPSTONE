const express = require('express');
const prisma = require('../prismaClient');
const { verifyToken, loadCurrentUser } = require('../middleware/auth');
const { adjustGold } = require('../utils/wallet');
const { calcLevel } = require('../utils/levelUtils');

const router = express.Router();

// Tabelle ricompense identiche a quelle usate lato client in BattlePage.jsx: il client comunica
// solo l'esito (risultato/difficoltà/stage raggiunto), l'importo gold/xp lo decide sempre il
// server, così non è possibile ottenere ricompense arbitrarie manipolando la richiesta.
const SINGLE_REWARDS = { win: { gold: 50, xp: 100 }, draw: { gold: 20, xp: 40 }, loss: { gold: 10, xp: 20 } };
const TOURNAMENT_ORDER = ['easy', 'normal', 'hard'];
const DIFFICULTY_REWARDS = { easy: { gold: 30, xp: 60 }, normal: { gold: 60, xp: 120 }, hard: { gold: 100, xp: 200 } };
const CHAMPION_BONUS = { gold: 100, xp: 150 };

function computeReward(body) {
  if (body.mode === 'tournament') {
    const stagesCleared = Math.max(0, Math.min(TOURNAMENT_ORDER.length, parseInt(body.stagesCleared, 10) || 0));
    let gold = 0;
    let xp = 0;
    for (let i = 0; i < stagesCleared; i++) {
      const cfg = DIFFICULTY_REWARDS[TOURNAMENT_ORDER[i]];
      gold += cfg.gold;
      xp += cfg.xp;
    }
    if (body.wonAllStages) { gold += CHAMPION_BONUS.gold; xp += CHAMPION_BONUS.xp; }
    // Ogni stage superato è una battaglia vinta a tutti gli effetti (conta per la classifica "Battaglie vinte").
    return { gold, xp, battlesWon: stagesCleared };
  }
  const r = SINGLE_REWARDS[body.result] || SINGLE_REWARDS.loss;
  return { gold: r.gold, xp: r.xp, battlesWon: body.result === 'win' ? 1 : 0 };
}

/** POST /api/battles/reward - accredita gold/xp reali al termine di una battaglia (singola o torneo). */
router.post('/battles/reward', verifyToken, loadCurrentUser, async (req, res, next) => {
  try {
    const userId = req.currentUser.id;
    const { gold: goldReward, xp: xpReward, battlesWon } = computeReward(req.body || {});

    const result = await prisma.$transaction(async (tx) => {
      let user = req.currentUser;
      if (goldReward > 0) user = await adjustGold(tx, userId, goldReward, 'BATTLE_REWARD', {});
      if (xpReward > 0) {
        const xp = user.xp + xpReward;
        user = await tx.user.update({ where: { id: userId }, data: { xp, level: calcLevel(xp) } });
      }
      if (battlesWon > 0) {
        user = await tx.user.update({ where: { id: userId }, data: { battlesWon: { increment: battlesWon } } });
      }
      return user;
    });

    res.json({ gold: result.gold, xp: result.xp, level: result.level, rewards: { gold: goldReward, xp: xpReward } });
  } catch (err) { next(err); }
});

module.exports = router;
