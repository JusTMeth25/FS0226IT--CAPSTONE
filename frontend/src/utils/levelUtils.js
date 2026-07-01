/**
 * Formula livelli/XP condivisa tra sidebar (barra XP) e pagina Missioni.
 */

function getLevelRewards(lv) {
  const rewards = { gold: 0, pack: null };
  if (lv % 5 === 0) rewards.gold = lv * 25;
  else if (lv % 2 === 0) rewards.gold = lv * 10;
  else rewards.gold = lv * 5;
  if (lv === 5) rewards.pack = 'pack-deluxe';
  if (lv === 10 || lv === 25 || lv === 50) rewards.pack = 'pack-premium';
  return rewards;
}

let LEVELS = null;
function buildLevels() {
  if (LEVELS) return LEVELS;
  LEVELS = [];
  for (let lv = 1; lv <= 50; lv++) {
    LEVELS.push({ level: lv, xpNeeded: lv * 100 + (lv - 1) * 50, rewards: getLevelRewards(lv) });
  }
  return LEVELS;
}

export function calcLevel(totalXP) {
  const levels = buildLevels();
  let xp = totalXP;
  let level = 1;
  for (const lv of levels) {
    if (xp >= lv.xpNeeded) {
      xp -= lv.xpNeeded;
      level = lv.level + 1;
    } else break;
  }
  const xpForNext = levels[Math.min(level - 1, levels.length - 1)].xpNeeded;
  return { level, xpRemaining: xp, xpForNext };
}

export { getLevelRewards };
