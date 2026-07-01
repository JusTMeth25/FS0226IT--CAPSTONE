import { useCallback, useEffect, useMemo } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage.js';
import { findPackById, FREE_PACK_COOLDOWN_MS } from '../data/packs.js';
import { generatePackCards } from '../utils/packGenerator.js';
import { calcLevel, getLevelRewards } from '../utils/levelUtils.js';
import { todayString } from '../utils/missionUtils.js';
import { packApi } from '../services/packApi.js';
import { soundService } from '../services/soundService.js';
import { GameContext } from './game-context.js';

const STORAGE_KEY = 'vinyllegends_game';

const DEFAULT_STATE = {
  gold: 150,
  xp: 0,
  level: 1,
  collection: [],
  favorites: [],
  stats: {
    totalPacksOpened: 0,
    totalCardsObtained: 0,
    legendaryCount: 0,
    epicCount: 0,
    rareCount: 0,
    uncommonCount: 0,
    commonCount: 0,
    totalBattlesPlayed: 0,
    totalBattlesWon: 0,
    totalBattlesLost: 0,
    totalBattlesDrawn: 0,
    battleWinStreak: 0,
    bestBattleWinStreak: 0,
    dailyPacksOpened: 0,
    dailyCardsObtained: 0,
    dailyBattlesPlayed: 0
  },
  lastFreePackAt: 0,
  freePacks: {},
  claimedMissions: [],
  claimedLevelRewards: [],
  claimedAlbumRewards: [],
  lastDailyReset: '',
  lastLoginDate: '',
  loginStreak: 0,
  title: null
};

export function GameProvider({ children }) {
  const [state, setState] = useLocalStorage(STORAGE_KEY, DEFAULT_STATE);

  // Reset dei contatori giornalieri quando cambia il giorno (missioni daily).
  useEffect(() => {
    const today = todayString();
    setState((prev) => {
      if (prev.lastDailyReset === today) return prev;
      const claimedMissions = (prev.claimedMissions || []).filter((id) => !id.startsWith('daily-'));
      return {
        ...prev,
        lastDailyReset: today,
        claimedMissions,
        stats: { ...prev.stats, dailyPacksOpened: 0, dailyCardsObtained: 0, dailyBattlesPlayed: 0 }
      };
    });
  }, [setState]);

  const addGold = useCallback((amount) => {
    setState((prev) => ({ ...prev, gold: Math.max(0, prev.gold + amount) }));
  }, [setState]);

  const addXP = useCallback((amount) => {
    setState((prev) => {
      const xp = prev.xp + amount;
      return { ...prev, xp, level: calcLevel(xp).level };
    });
  }, [setState]);

  const isFreeAvailable = useCallback((pack) => {
    if (!pack.isFree) return false;
    if (!state.lastFreePackAt) return true;
    return Date.now() - state.lastFreePackAt >= FREE_PACK_COOLDOWN_MS;
  }, [state.lastFreePackAt]);

  const getFreeCooldownRemaining = useCallback((pack) => {
    if (!pack.isFree || !state.lastFreePackAt) return 0;
    const elapsed = Date.now() - state.lastFreePackAt;
    return Math.max(0, FREE_PACK_COOLDOWN_MS - elapsed);
  }, [state.lastFreePackAt]);

  /**
   * Apre un pacchetto. Prova prima il backend (fonte di verità per gold/drop-rate);
   * se non disponibile, ricade sulla generazione locale per non bloccare l'esperienza offline/demo.
   */
  const openPack = useCallback(async (packId, mode = 'paid') => {
    const pack = findPackById(packId);
    if (!pack) return { error: 'pack_not_found' };

    if (mode === 'gift') {
      if (!(state.freePacks[packId] > 0)) return { error: 'no_gift_available' };
    } else if (mode === 'free') {
      if (!pack.isFree || !isFreeAvailable(pack)) return { error: 'cooldown' };
    } else if (state.gold < pack.price) {
      return { error: 'insufficient_gold' };
    }

    let cards = null;
    try {
      const res = await packApi.openPack(packId, mode);
      if (res && Array.isArray(res.cards) && res.cards.length) cards = res.cards;
    } catch {
      // backend non disponibile in questa fase del progetto: fallback locale
    }
    if (!cards) cards = generatePackCards(pack);

    setState((prev) => {
      const next = { ...prev, stats: { ...prev.stats } };

      if (mode === 'gift') {
        next.freePacks = { ...prev.freePacks, [packId]: prev.freePacks[packId] - 1 };
      } else if (mode === 'free') {
        next.lastFreePackAt = Date.now();
      } else {
        next.gold = prev.gold - pack.price;
      }

      next.collection = [
        ...prev.collection,
        ...cards.map((c) => ({ ...c, obtainedAt: c.obtainedAt || Date.now() }))
      ];

      next.stats.totalPacksOpened = (next.stats.totalPacksOpened || 0) + 1;
      next.stats.dailyPacksOpened = (next.stats.dailyPacksOpened || 0) + 1;
      next.stats.totalCardsObtained = (next.stats.totalCardsObtained || 0) + cards.length;
      next.stats.dailyCardsObtained = (next.stats.dailyCardsObtained || 0) + cards.length;
      cards.forEach((c) => {
        const key = `${c.rarity}Count`;
        next.stats[key] = (next.stats[key] || 0) + 1;
      });

      return next;
    });

    return { cards };
  }, [state.freePacks, state.gold, isFreeAvailable, setState]);

  const addFreePack = useCallback((packId, amount = 1) => {
    setState((prev) => ({ ...prev, freePacks: { ...prev.freePacks, [packId]: (prev.freePacks[packId] || 0) + amount } }));
  }, [setState]);

  const toggleFavorite = useCallback((cardId) => {
    setState((prev) => {
      const has = prev.favorites.includes(cardId);
      return { ...prev, favorites: has ? prev.favorites.filter((id) => id !== cardId) : [...prev.favorites, cardId] };
    });
  }, [setState]);

  const claimMission = useCallback((mission) => {
    if (!mission || mission.claimed || mission.progress < mission.target) return;
    setState((prev) => {
      if (prev.claimedMissions.includes(mission.id)) return prev;
      const xp = prev.xp + (mission.rewardXP || 0);
      const next = {
        ...prev,
        claimedMissions: [...prev.claimedMissions, mission.id],
        gold: prev.gold + (mission.rewardGold || 0),
        xp,
        level: calcLevel(xp).level
      };
      if (mission.pack) next.freePacks = { ...prev.freePacks, [mission.pack]: (prev.freePacks[mission.pack] || 0) + 1 };
      return next;
    });
    soundService.reward();
  }, [setState]);

  const claimLevelReward = useCallback((level) => {
    setState((prev) => {
      if (prev.claimedLevelRewards.includes(level)) return prev;
      const rewards = getLevelRewards(level);
      const next = {
        ...prev,
        claimedLevelRewards: [...prev.claimedLevelRewards, level],
        gold: prev.gold + rewards.gold
      };
      if (rewards.pack) next.freePacks = { ...prev.freePacks, [rewards.pack]: (prev.freePacks[rewards.pack] || 0) + 1 };
      return next;
    });
    soundService.levelUp();
  }, [setState]);

  const claimLoginReward = useCallback(() => {
    const today = todayString();
    setState((prev) => {
      if (prev.lastLoginDate === today) return prev;
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      const streak = prev.lastLoginDate === yesterday ? (prev.loginStreak || 0) + 1 : 1;
      const goldReward = 10 + streak * 2;
      const xpReward = 20 + streak * 3;
      const xp = prev.xp + xpReward;
      return {
        ...prev,
        gold: prev.gold + goldReward,
        xp,
        level: calcLevel(xp).level,
        lastLoginDate: today,
        loginStreak: streak
      };
    });
  }, [setState]);

  const claimAlbumReward = useCallback((milestone) => {
    setState((prev) => {
      if (prev.claimedAlbumRewards.includes(milestone.percent)) return prev;
      const next = { ...prev, claimedAlbumRewards: [...prev.claimedAlbumRewards, milestone.percent] };
      if (milestone.gold) next.gold = prev.gold + milestone.gold;
      if (milestone.pack) next.freePacks = { ...prev.freePacks, [milestone.pack]: (prev.freePacks[milestone.pack] || 0) + 1 };
      if (milestone.title) next.title = milestone.title;
      return next;
    });
  }, [setState]);

  /** result: 'win' | 'loss' | 'draw' */
  const recordBattleResult = useCallback((result) => {
    setState((prev) => {
      const streak = result === 'win' ? (prev.stats.battleWinStreak || 0) + 1 : 0;
      return {
        ...prev,
        stats: {
          ...prev.stats,
          totalBattlesPlayed: (prev.stats.totalBattlesPlayed || 0) + 1,
          dailyBattlesPlayed: (prev.stats.dailyBattlesPlayed || 0) + 1,
          totalBattlesWon: (prev.stats.totalBattlesWon || 0) + (result === 'win' ? 1 : 0),
          totalBattlesLost: (prev.stats.totalBattlesLost || 0) + (result === 'loss' ? 1 : 0),
          totalBattlesDrawn: (prev.stats.totalBattlesDrawn || 0) + (result === 'draw' ? 1 : 0),
          battleWinStreak: streak,
          bestBattleWinStreak: Math.max(prev.stats.bestBattleWinStreak || 0, streak)
        }
      };
    });
  }, [setState]);

  const levelInfo = useMemo(() => calcLevel(state.xp), [state.xp]);

  const value = useMemo(() => ({
    ...state,
    levelInfo,
    addGold,
    addXP,
    isFreeAvailable,
    getFreeCooldownRemaining,
    openPack,
    addFreePack,
    toggleFavorite,
    claimMission,
    claimLevelReward,
    claimLoginReward,
    claimAlbumReward,
    recordBattleResult
  }), [state, levelInfo, addGold, addXP, isFreeAvailable, getFreeCooldownRemaining, openPack, addFreePack, toggleFavorite, claimMission, claimLevelReward, claimLoginReward, claimAlbumReward, recordBattleResult]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
