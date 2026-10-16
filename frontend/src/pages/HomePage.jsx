import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../hooks/useGame.js';
import { useApiResource } from '../hooks/useApiResource.js';
import { CARDS } from '../data/cards.js';
import { PACKS, findPackById } from '../data/packs.js';
import { RARITY_ORDER } from '../utils/cardUtils.js';
import { missionApi } from '../services/missionApi.js';
import { dedupeCollection } from '../utils/collectionUtils.js';
import { useCountdown } from '../hooks/useCountdown.js';
import { useAuth } from '../hooks/useAuth.js';
// Prima i token e la griglia, poi le sezioni: cosi' le regole delle sezioni vincono su quelle comuni.
import '../styles/home/tokens.css';
import '../styles/home/layout.css';
import HomeHero from '../components/home/HomeHero.jsx';
import HomeToday from '../components/home/HomeToday.jsx';
import HomeShelf from '../components/home/HomeShelf.jsx';

/**
 * Home: qui stanno solo i dati. La grafica e' divisa in tre sezioni, ognuna con il suo file:
 * HomeHero (copertina: chi sei, livello, azione principale), HomeToday (in vetrina: carta del
 * giorno, carta in evidenza, pacchetti) e HomeShelf (lo scaffale: album, ultime carte, missioni).
 */
export default function HomePage() {
  const game = useGame();
  const { user } = useAuth();
  const navigate = useNavigate();
  const basePack = findPackById('pack-base');
  // Il pacchetto del weekend si vede solo sabato e domenica, come in edicola.
  const weekendOpen = [0, 6].includes(new Date().getDay());
  const shopPacks = PACKS.filter((p) => !p.isFree && (!p.weekend || weekendOpen));

  const lastFreePackAtMs = game.lastFreePackAt
    ? (typeof game.lastFreePackAt === 'number' ? game.lastFreePackAt : new Date(game.lastFreePackAt).getTime())
    : 0;
  const cooldownMs = (basePack.freeCooldownHours || 4) * 60 * 60 * 1000;
  const freePackTargetAt = lastFreePackAtMs ? lastFreePackAtMs + cooldownMs : 0;
  const remainingMs = useCountdown(freePackTargetAt);
  const freePack = { available: game.isFreeAvailable(basePack), remainingMs, name: basePack.name };

  // Per gli utenti autenticati il totale reale del catalogo (tutte le fonti) arriva dal server;
  // in modalita' ospite l'unico universo possibile resta il catalogo statico locale delle carte originali.
  const totalCatalogCards = game.catalogSize ?? CARDS.length;

  const { recentCards, featuredCard, progressPercent, ownedCount } = useMemo(() => {
    const unique = dedupeCollection(game.collection);
    let featured = null;
    let bestWeight = -1;
    unique.forEach((c) => {
      const weight = RARITY_ORDER[c.rarity] || 0;
      if (weight > bestWeight || (weight === bestWeight && new Date(c.obtainedAt || 0) > new Date(featured?.obtainedAt || 0))) {
        featured = c;
        bestWeight = weight;
      }
    });
    return {
      recentCards: unique.slice(0, 12),
      featuredCard: featured,
      ownedCount: unique.length,
      progressPercent: totalCatalogCards > 0 ? Math.round((unique.length / totalCatalogCards) * 100) : 0
    };
  }, [game.collection, totalCatalogCards]);

  // Stesso endpoint di MissionsPage: le missioni con il progresso reale le tiene il server.
  const missionsServer = useApiResource(() => missionApi.getMissions(), [game.collection, game.stats]);
  const dailyMissions = useMemo(
    () => (missionsServer.data?.missions || []).filter((m) => m.id.startsWith('daily-')).slice(0, 3),
    [missionsServer.data]
  );

  const xp = {
    current: game.levelInfo.xpRemaining,
    next: game.levelInfo.xpForNext,
    percent: game.levelInfo.xpForNext ? Math.round((game.levelInfo.xpRemaining / game.levelInfo.xpForNext) * 100) : 0
  };

  return (
    <section className="home2" aria-label="Home">
      <HomeHero
        username={user?.username || 'collezionista'}
        level={game.level}
        xp={xp}
        stats={{ ownedCount, progressPercent, gold: game.gold, wins: game.stats.totalBattlesWon || 0 }}
        freePack={freePack}
        onNavigate={navigate}
      />
      <HomeToday
        featuredCard={featuredCard}
        packs={shopPacks}
        freePack={freePack}
        gold={game.gold}
        onNavigate={navigate}
      />
      <HomeShelf
        progressPercent={progressPercent}
        ownedCount={ownedCount}
        totalCards={totalCatalogCards}
        recentCards={recentCards}
        missions={dailyMissions}
        missionsLoading={missionsServer.loading && !missionsServer.data}
        onNavigate={navigate}
      />
    </section>
  );
}
