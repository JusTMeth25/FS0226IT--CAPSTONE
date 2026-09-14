import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage.js';
import { useAuth } from '../hooks/useAuth.js';
import { FREE_PACK_COOLDOWN_MS } from '../data/packs.js';
import { calcLevel } from '../utils/levelUtils.js';
import { packApi } from '../services/packApi.js';
import { collectionApi } from '../services/collectionApi.js';
import { missionApi } from '../services/missionApi.js';
import { battleApi } from '../services/battleApi.js';
import { soundService } from '../services/soundService.js';
import { GameContext } from './game-context.js';

const STORAGE_KEY = 'vinyldex_game';

/**
 * Stato tenuto in locale.
 *
 * Gold, esperienza, collezione, missioni e pacchetti regalo stanno tutti sul server:
 * qui resta solo quello che il server non traccia, cioe' l'andamento delle battaglie
 * e il numero di bustine aperte. Sono statistiche personali senza effetto sul gioco,
 * quindi non vale la pena farne tabelle lato server.
 */
const DEFAULT_STATE = {
  stats: {
    totalPacksOpened: 0,
    totalBattlesPlayed: 0,
    totalBattlesWon: 0,
    totalBattlesLost: 0,
    totalBattlesDrawn: 0,
    battleWinStreak: 0,
    bestBattleWinStreak: 0
  }
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

  const [remoteCollection, setRemoteCollection] = useState([]);
  const [remotePacks, setRemotePacks] = useState([]);
  const [remoteLastFreePackAt, setRemoteLastFreePackAt] = useState(null);
  const [remoteLoaded, setRemoteLoaded] = useState(false);
  // Totale carte attive nell'intero catalogo, tutte le fonti comprese: e' il denominatore
  // delle percentuali di completamento.
  const [remoteCatalogSize, setRemoteCatalogSize] = useState(null);

  const refreshCollection = useCallback(async () => {
    try {
      const res = await collectionApi.getCollection({ owned: 'true' });
      setRemoteCollection(res.collection || []);
      if (typeof res.totalActiveCards === 'number') setRemoteCatalogSize(res.totalActiveCards);
    } catch {
      // rete o server non disponibili: si mantiene l'ultimo stato noto
    }
  }, []);

  const refreshPacksInfo = useCallback(async () => {
    try {
      const res = await packApi.getPacks();
      setRemotePacks(res.packs || []);
      setRemoteLastFreePackAt(res.lastFreePackAt || null);
    } catch {
      // rete o server non disponibili: si mantiene l'ultimo stato noto
    }
  }, []);

  // Il provider avvolge anche la pagina di accesso, dove non c'e' ancora una sessione:
  // senza questa guardia si chiamerebbero le API senza token a ogni visita al login.
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

  // ---------- Derivati ----------
  const gold = user?.gold ?? 0;
  const xp = user?.xp ?? 0;
  const levelInfo = useMemo(() => calcLevel(xp), [xp]);

  const collection = remoteCollection;
  const favorites = useMemo(
    () => remoteCollection.filter((c) => c.isFavorite).map((c) => c.id),
    [remoteCollection]
  );
  const freePacks = useMemo(
    () => Object.fromEntries(remotePacks.map((p) => [p.id, p.giftedCount || 0])),
    [remotePacks]
  );

  const stats = useMemo(() => ({
    // Battaglie e bustine aperte vengono dall'archiviazione locale, il resto dalla
    // collezione reale: le due parti non si sovrappongono.
    ...local.stats,
    ...rarityCountsFromCollection(remoteCollection),
    totalCardsObtained: remoteCollection.reduce((sum, c) => sum + (c.quantity || 1), 0)
  }), [local.stats, remoteCollection]);

  // ---------- Pacchetti ----------
  // Il server restituisce la data in formato ISO, da convertire prima di confrontarla.
  const lastFreePackMs = remoteLastFreePackAt ? new Date(remoteLastFreePackAt).getTime() : 0;

  const cooldownMsFor = (pack) => (
    pack.freeCooldownHours ? pack.freeCooldownHours * 60 * 60 * 1000 : FREE_PACK_COOLDOWN_MS
  );

  const isFreeAvailable = useCallback((pack) => {
    if (!pack.isFree) return false;
    if (!lastFreePackMs) return true;
    return Date.now() - lastFreePackMs >= cooldownMsFor(pack);
  }, [lastFreePackMs]);

  const getFreeCooldownRemaining = useCallback((pack) => {
    if (!pack.isFree || !lastFreePackMs) return 0;
    return Math.max(0, cooldownMsFor(pack) - (Date.now() - lastFreePackMs));
  }, [lastFreePackMs]);

  const openPack = useCallback(async (packId, mode) => {
    try {
      const res = await packApi.openPack(packId, mode);
      await Promise.all([refreshUser(), refreshCollection(), refreshPacksInfo()]);

      // Il server non tiene il conto delle aperture: si incrementa qui, come per le battaglie.
      setLocal((prev) => ({
        ...prev,
        stats: { ...prev.stats, totalPacksOpened: (prev.stats.totalPacksOpened || 0) + 1 }
      }));

      return { cards: res.cards };
    } catch (err) {
      return { error: err.payload?.error || 'open_pack_failed' };
    }
  }, [refreshUser, refreshCollection, refreshPacksInfo, setLocal]);

  // ---------- Collezione ----------
  const toggleFavorite = useCallback(async (cardId) => {
    try {
      await collectionApi.toggleFavorite(cardId);
      await refreshCollection();
    } catch {
      // ignorato: la carta potrebbe non essere posseduta
    }
  }, [refreshCollection]);

  // ---------- Missioni e accesso giornaliero ----------
  const claimMission = useCallback(async (mission) => {
    if (!mission || mission.claimed || mission.progress < mission.target) return;
    try {
      await missionApi.claimMission(mission.id);
      await Promise.all([refreshUser(), refreshPacksInfo()]);
      soundService.reward();
    } catch {
      // gia' reclamata o non piu' valida: la schermata si allinea al prossimo aggiornamento
    }
  }, [refreshUser, refreshPacksInfo]);

  const claimLoginReward = useCallback(async () => {
    try {
      await missionApi.claimDailyLogin();
      await refreshUser();
    } catch {
      // gia' reclamato oggi
    }
  }, [refreshUser]);

  // ---------- Battaglie ----------
  // La ricompensa la calcola e l'accredita il server, sullo stesso saldo che controllano
  // mercato e pacchetti. Tenerla in locale avrebbe gonfiato il numero mostrato senza
  // produrre gold spendibile, con acquisti rifiutati per saldo insufficiente a fronte di
  // un contatore che ne mostrava a sufficienza.
  const claimBattleReward = useCallback(async (payload) => {
    try {
      await battleApi.claimReward(payload);
    } catch {
      // rete o server non disponibili: la prossima battaglia riprova
    } finally {
      await refreshUser();
    }
  }, [refreshUser]);

  const recordBattleResult = useCallback((result) => {
    setLocal((prev) => {
      const streak = result === 'win' ? (prev.stats.battleWinStreak || 0) + 1 : 0;
      return {
        ...prev,
        stats: {
          ...prev.stats,
          totalBattlesPlayed: (prev.stats.totalBattlesPlayed || 0) + 1,
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
    catalogSize: remoteCatalogSize,
    favorites,
    stats,
    freePacks,
    lastFreePackAt: remoteLastFreePackAt,
    lastLoginDate: user?.lastLoginDate ? new Date(user.lastLoginDate).toDateString() : '',
    loginStreak: user?.loginStreak || 0,
    loading: !remoteLoaded,
    isFreeAvailable,
    getFreeCooldownRemaining,
    openPack,
    toggleFavorite,
    claimMission,
    claimLoginReward,
    claimBattleReward,
    recordBattleResult,
    refreshCollection
  }), [
    gold, xp, levelInfo, collection, remoteCatalogSize, favorites, stats, freePacks,
    remoteLastFreePackAt, user, remoteLoaded, isFreeAvailable, getFreeCooldownRemaining,
    openPack, toggleFavorite, claimMission, claimLoginReward, claimBattleReward,
    recordBattleResult, refreshCollection
  ]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
