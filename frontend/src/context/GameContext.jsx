import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage.js';
import { useAuth } from '../hooks/useAuth.js';
import { findPackById, FREE_PACK_COOLDOWN_MS } from '../data/packs.js';
import { generatePackCards } from '../utils/packGenerator.js';
import { calcLevel, getLevelRewards } from '../utils/levelUtils.js';
import { todayString } from '../utils/missionUtils.js';
import { packApi } from '../services/packApi.js';
import { collectionApi } from '../services/collectionApi.js';
import { missionApi } from '../services/missionApi.js';
import { soundService } from '../services/soundService.js';
import { GameContext } from './game-context.js';

const STORAGE_KEY = 'vinyldex_game';

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
  lastDailyReset: '',
  lastLoginDate: '',
  loginStreak: 0,
  title: null,
  // Overlay usato SOLO in modalità autenticata per le ricompense battaglia (feature client-only,
  // non presente nello schema Prisma): si somma a gold/xp reali del server senza sovrascriverli.
  battleGoldBonus: 0,
  battleXpBonus: 0
};

function rarityCountsFromCollection(collection) {
  const counts = { legendaryCount: 0, epicCount: 0, rareCount: 0, uncommonCount: 0, commonCount: 0 };
  collection.forEach((c) => {
    const key = `${c.rarity}Count`;
    if (key in counts) counts[key] += c.quantity || 1;
  });
  return counts;
}

export function GameProvider({ children }) {
  const { isAuthenticated, user, refreshUser } = useAuth();
  const [local, setLocal] = useLocalStorage(STORAGE_KEY, DEFAULT_STATE);

  // ---------- Stato server (solo utenti autenticati) ----------
  const [remoteCollection, setRemoteCollection] = useState([]);
  const [remotePacks, setRemotePacks] = useState([]);
  const [remoteLastFreePackAt, setRemoteLastFreePackAt] = useState(null);
  const [remoteLoaded, setRemoteLoaded] = useState(false);
  // Totale carte attive nell'intero catalogo (tutte le fonti): usato per calcolare le percentuali
  // di completamento invece del catalogo statico locale (che copre solo le 43 carte originali).
  const [remoteCatalogSize, setRemoteCatalogSize] = useState(null);

  const refreshCollection = useCallback(async () => {
    try {
      const res = await collectionApi.getCollection({ owned: 'true' });
      setRemoteCollection(res.collection || []);
      if (typeof res.totalActiveCards === 'number') setRemoteCatalogSize(res.totalActiveCards);
    } catch {
      // rete/serve non disponibile: mantiene l'ultimo stato noto
    }
  }, []);

  const refreshPacksInfo = useCallback(async () => {
    try {
      const res = await packApi.getPacks();
      setRemotePacks(res.packs || []);
      setRemoteLastFreePackAt(res.lastFreePackAt || null);
    } catch {
      // rete/server non disponibile: mantiene l'ultimo stato noto
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset intenzionale su logout
      setRemoteLoaded(false);
      return;
    }
    let cancelled = false;
    (async () => {
      await Promise.all([refreshCollection(), refreshPacksInfo()]);
      if (!cancelled) setRemoteLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, user?.id, refreshCollection, refreshPacksInfo]);

  // Reset dei contatori giornalieri (solo modalità ospite: per utenti autenticati i contatori
  // giornalieri delle missioni sono calcolati e resettati dal server).
  useEffect(() => {
    if (isAuthenticated) return;
    const today = todayString();
    setLocal((prev) => {
      if (prev.lastDailyReset === today) return prev;
      const claimedMissions = (prev.claimedMissions || []).filter((id) => !id.startsWith('daily-'));
      return {
        ...prev,
        lastDailyReset: today,
        claimedMissions,
        stats: { ...prev.stats, dailyPacksOpened: 0, dailyCardsObtained: 0, dailyBattlesPlayed: 0 }
      };
    });
  }, [isAuthenticated, setLocal]);

  // ---------- Derivati comuni ----------
  const gold = isAuthenticated ? (user?.gold ?? 0) + (local.battleGoldBonus || 0) : local.gold;
  const xp = isAuthenticated ? (user?.xp ?? 0) + (local.battleXpBonus || 0) : local.xp;
  const levelInfo = useMemo(() => calcLevel(xp), [xp]);

  const collection = isAuthenticated ? remoteCollection : local.collection;
  const favorites = isAuthenticated ? remoteCollection.filter((c) => c.isFavorite).map((c) => c.id) : local.favorites;
  const freePacks = isAuthenticated
    ? Object.fromEntries(remotePacks.map((p) => [p.id, p.giftedCount || 0]))
    : local.freePacks;
  const lastFreePackAt = isAuthenticated ? remoteLastFreePackAt : local.lastFreePackAt;

  const stats = useMemo(() => {
    if (!isAuthenticated) return local.stats;
    return {
      ...local.stats, // vittorie/sconfitte/pareggi battaglia restano nell'overlay locale
      ...rarityCountsFromCollection(remoteCollection),
      totalCardsObtained: remoteCollection.reduce((sum, c) => sum + (c.quantity || 1), 0)
    };
  }, [isAuthenticated, local.stats, remoteCollection]);

  // ---------- Azioni: pacchetti ----------
  const isFreeAvailable = useCallback((pack) => {
    if (!pack.isFree) return false;
    if (!lastFreePackAt) return true;
    const lastTime = isAuthenticated ? new Date(lastFreePackAt).getTime() : lastFreePackAt;
    const cooldownMs = pack.freeCooldownHours ? pack.freeCooldownHours * 60 * 60 * 1000 : FREE_PACK_COOLDOWN_MS;
    return Date.now() - lastTime >= cooldownMs;
  }, [lastFreePackAt, isAuthenticated]);

  const getFreeCooldownRemaining = useCallback((pack) => {
    if (!pack.isFree || !lastFreePackAt) return 0;
    const lastTime = isAuthenticated ? new Date(lastFreePackAt).getTime() : lastFreePackAt;
    const cooldownMs = pack.freeCooldownHours ? pack.freeCooldownHours * 60 * 60 * 1000 : FREE_PACK_COOLDOWN_MS;
    const elapsed = Date.now() - lastTime;
    return Math.max(0, cooldownMs - elapsed);
  }, [lastFreePackAt, isAuthenticated]);

  const openPackAuthenticated = useCallback(async (packId, mode) => {
    try {
      const res = await packApi.openPack(packId, mode);
      await Promise.all([refreshUser(), refreshCollection(), refreshPacksInfo()]);
      return { cards: res.cards };
    } catch (err) {
      return { error: err.payload?.error || 'open_pack_failed' };
    }
  }, [refreshUser, refreshCollection, refreshPacksInfo]);

  const openPackGuest = useCallback(async (packId, mode = 'paid') => {
    const pack = findPackById(packId);
    if (!pack) return { error: 'pack_not_found' };

    if (mode === 'gift') {
      if (!(local.freePacks[packId] > 0)) return { error: 'no_gift_available' };
    } else if (mode === 'free') {
      if (!pack.isFree || !isFreeAvailable(pack)) return { error: 'cooldown' };
    } else if (local.gold < pack.price) {
      return { error: 'insufficient_gold' };
    }

    let cards = null;
    try {
      const res = await packApi.openPack(packId, mode);
      if (res && Array.isArray(res.cards) && res.cards.length) cards = res.cards;
    } catch {
      // ospite senza sessione valida: fallback locale per non bloccare la demo
    }
    if (!cards) cards = generatePackCards(pack);

    setLocal((prev) => {
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
  }, [local.freePacks, local.gold, isFreeAvailable, setLocal]);

  const openPack = isAuthenticated ? openPackAuthenticated : openPackGuest;

  const addFreePack = useCallback((packId, amount = 1) => {
    if (isAuthenticated) return; // i pacchetti regalo lato server arrivano solo da missioni/eventi
    setLocal((prev) => ({ ...prev, freePacks: { ...prev.freePacks, [packId]: (prev.freePacks[packId] || 0) + amount } }));
  }, [isAuthenticated, setLocal]);

  // ---------- Azioni: collezione ----------
  const toggleFavorite = useCallback(async (cardId) => {
    if (isAuthenticated) {
      try {
        await collectionApi.toggleFavorite(cardId);
        await refreshCollection();
      } catch {
        // ignorato: la carta potrebbe non essere posseduta
      }
      return;
    }
    setLocal((prev) => {
      const has = prev.favorites.includes(cardId);
      return { ...prev, favorites: has ? prev.favorites.filter((id) => id !== cardId) : [...prev.favorites, cardId] };
    });
  }, [isAuthenticated, refreshCollection, setLocal]);

  // ---------- Azioni: missioni / livelli / login ----------
  const claimMission = useCallback(async (mission) => {
    if (!mission || mission.claimed || mission.progress < mission.target) return;

    if (isAuthenticated) {
      try {
        await missionApi.claimMission(mission.id);
        await Promise.all([refreshUser(), refreshPacksInfo()]);
        soundService.reward();
      } catch {
        // mission già reclamata o non più valida: la UI si allineerà al prossimo refresh
      }
      return;
    }

    setLocal((prev) => {
      if (prev.claimedMissions.includes(mission.id)) return prev;
      const xpNext = prev.xp + (mission.rewardXP || 0);
      const next = {
        ...prev,
        claimedMissions: [...prev.claimedMissions, mission.id],
        gold: prev.gold + (mission.rewardGold || 0),
        xp: xpNext,
        level: calcLevel(xpNext).level
      };
      if (mission.pack) next.freePacks = { ...prev.freePacks, [mission.pack]: (prev.freePacks[mission.pack] || 0) + 1 };
      return next;
    });
    soundService.reward();
  }, [isAuthenticated, refreshUser, refreshPacksInfo, setLocal]);

  const claimLoginReward = useCallback(async () => {
    if (isAuthenticated) {
      try {
        await missionApi.claimDailyLogin();
        await refreshUser();
      } catch {
        // già reclamato oggi
      }
      return;
    }

    const today = todayString();
    setLocal((prev) => {
      if (prev.lastLoginDate === today) return prev;
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      const streak = prev.lastLoginDate === yesterday ? (prev.loginStreak || 0) + 1 : 1;
      const goldReward = 10 + streak * 2;
      const xpReward = 20 + streak * 3;
      const xpNext = prev.xp + xpReward;
      return {
        ...prev,
        gold: prev.gold + goldReward,
        xp: xpNext,
        level: calcLevel(xpNext).level,
        lastLoginDate: today,
        loginStreak: streak
      };
    });
  }, [isAuthenticated, refreshUser, setLocal]);

  // Ricompense di livello: non ancora persistite lato server (fuori scope Fase 2),
  // restano una feature locale per la modalità ospite.
  const claimLevelReward = useCallback((level) => {
    if (isAuthenticated) return;
    setLocal((prev) => {
      if (prev.claimedLevelRewards.includes(level)) return prev;
      const rewards = getLevelRewards(level);
      const next = { ...prev, claimedLevelRewards: [...prev.claimedLevelRewards, level], gold: prev.gold + rewards.gold };
      if (rewards.pack) next.freePacks = { ...prev.freePacks, [rewards.pack]: (prev.freePacks[rewards.pack] || 0) + 1 };
      return next;
    });
    soundService.levelUp();
  }, [isAuthenticated, setLocal]);

  // ---------- Battaglie (feature client-only, sia per ospiti che per utenti autenticati) ----------
  const addGold = useCallback((amount) => {
    if (isAuthenticated) {
      setLocal((prev) => ({ ...prev, battleGoldBonus: Math.max(0, (prev.battleGoldBonus || 0) + amount) }));
    } else {
      setLocal((prev) => ({ ...prev, gold: Math.max(0, prev.gold + amount) }));
    }
  }, [isAuthenticated, setLocal]);

  const addXP = useCallback((amount) => {
    if (isAuthenticated) {
      setLocal((prev) => ({ ...prev, battleXpBonus: Math.max(0, (prev.battleXpBonus || 0) + amount) }));
    } else {
      setLocal((prev) => {
        const xpNext = prev.xp + amount;
        return { ...prev, xp: xpNext, level: calcLevel(xpNext).level };
      });
    }
  }, [isAuthenticated, setLocal]);

  const recordBattleResult = useCallback((result) => {
    setLocal((prev) => {
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
  }, [setLocal]);

  const value = useMemo(() => ({
    gold,
    xp,
    level: levelInfo.level,
    levelInfo,
    collection,
    catalogSize: isAuthenticated ? remoteCatalogSize : null,
    favorites,
    stats,
    freePacks,
    lastFreePackAt,
    claimedMissions: isAuthenticated ? [] : local.claimedMissions,
    claimedLevelRewards: isAuthenticated ? [] : local.claimedLevelRewards,
    lastLoginDate: isAuthenticated ? (user?.lastLoginDate ? new Date(user.lastLoginDate).toDateString() : '') : local.lastLoginDate,
    loginStreak: isAuthenticated ? (user?.loginStreak || 0) : local.loginStreak,
    title: isAuthenticated ? null : local.title,
    loading: isAuthenticated && !remoteLoaded,
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
    recordBattleResult,
    refreshCollection
  }), [
    gold, xp, levelInfo, collection, remoteCatalogSize, favorites, stats, freePacks, lastFreePackAt, isAuthenticated, local,
    user, remoteLoaded, addGold, addXP, isFreeAvailable, getFreeCooldownRemaining, openPack, addFreePack,
    toggleFavorite, claimMission, claimLevelReward, claimLoginReward, recordBattleResult, refreshCollection
  ]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
