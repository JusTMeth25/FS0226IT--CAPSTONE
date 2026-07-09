import { CARDS } from '../data/cards.js';

/**
 * Genera le missioni daily/weekly/progress a partire dallo stato di gioco locale.
 * Missioni "vere" (persistite, validate server-side) arriveranno con l'endpoint
 * GET /api/missions in Fase 2: questa funzione alimenta la UI nel frattempo.
 */
export function generateMissions(game) {
  const stats = game.stats || {};
  const ownedIds = new Set((game.collection || []).map((c) => c.id));
  const claimedIds = new Set(game.claimedMissions || []);

  const missions = [];

  missions.push({
    id: 'daily-open-pack', title: 'Apri un pacchetto', description: 'Apri 1 pacchetto', type: 'daily',
    icon: 'ph-gift', target: 1, progress: Math.min(stats.dailyPacksOpened || 0, 1),
    rewardGold: 25, rewardXP: 50, claimed: claimedIds.has('daily-open-pack')
  });
  missions.push({
    id: 'daily-collect-cards', title: 'Colleziona carte', description: 'Ottieni 3 carte', type: 'daily',
    icon: 'ph-cards', target: 3, progress: Math.min(stats.dailyCardsObtained || 0, 3),
    rewardGold: 30, rewardXP: 60, claimed: claimedIds.has('daily-collect-cards')
  });
  missions.push({
    id: 'daily-fight', title: 'Combatti!', description: 'Completa 1 battaglia', type: 'daily',
    icon: 'ph-sword', target: 1, progress: Math.min(stats.dailyBattlesPlayed || 0, 1),
    rewardGold: 35, rewardXP: 70, claimed: claimedIds.has('daily-fight')
  });

  missions.push({
    id: 'weekly-open-5', title: 'Apri 5 pacchetti', description: 'Apri 5 pacchetti', type: 'weekly',
    icon: 'ph-gift', target: 5, progress: Math.min(stats.totalPacksOpened || 0, 5),
    rewardGold: 100, rewardXP: 200, claimed: claimedIds.has('weekly-open-5')
  });
  missions.push({
    id: 'weekly-legendary', title: 'Caccia alla Leggendaria', description: 'Ottieni 1 carta Leggendaria', type: 'weekly',
    icon: 'ph-crown', target: 1, progress: Math.min(stats.legendaryCount || 0, 1),
    rewardGold: 150, rewardXP: 300, pack: 'pack-deluxe', claimed: claimedIds.has('weekly-legendary')
  });
  missions.push({
    id: 'weekly-battle-win', title: 'Vittorie Strepitose', description: 'Vinci 3 battaglie', type: 'weekly',
    icon: 'ph-trophy', target: 3, progress: Math.min(stats.totalBattlesWon || 0, 3),
    rewardGold: 200, rewardXP: 400, pack: 'pack-premium', claimed: claimedIds.has('weekly-battle-win')
  });

  const progressMissions = [
    { id: 'progress-10', target: 10, title: 'Prime 10 Carte!', rewardGold: 100, rewardXP: 150 },
    { id: 'progress-25', target: 25, title: 'Collezionista', rewardGold: 200, rewardXP: 300 },
    { id: 'progress-40', target: CARDS.length, title: 'Completista!', rewardGold: 500, rewardXP: 1000, pack: 'pack-premium' }
  ];
  progressMissions.forEach((pm) => {
    missions.push({
      id: pm.id, title: pm.title, description: `Colleziona ${pm.target} carte uniche`, type: 'progress',
      icon: 'ph-book-open', target: pm.target, progress: Math.min(ownedIds.size, pm.target),
      rewardGold: pm.rewardGold || 0, rewardXP: pm.rewardXP || 0, pack: pm.pack || null,
      claimed: claimedIds.has(pm.id)
    });
  });

  return missions;
}

export function todayString() {
  return new Date().toDateString();
}
