import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../hooks/useGame.js';
import { useApiResource } from '../hooks/useApiResource.js';
import { CARDS } from '../data/cards.js';
import { PACKS } from '../data/packs.js';
import { findPackById } from '../data/packs.js';
import { RARITY_ORDER } from '../utils/cardUtils.js';
import { missionApi } from '../services/missionApi.js';
import { dedupeCollection } from '../utils/collectionUtils.js';
import { useCountdown, formatDuration } from '../hooks/useCountdown.js';
import CardTile from '../components/card/CardTile.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import SplitText from '../components/fx/SplitText.jsx';
import AlbumProgress from '../components/fx/AlbumProgress.jsx';
import DailyCard from '../components/card/DailyCard.jsx';
import { PACK_GRADIENT, PACK_ICON, PACK_IMAGE } from '../components/pack/packArt.js';
import { useAuth } from '../hooks/useAuth.js';

export default function HomePage() {
  const game = useGame();
  const { user } = useAuth();
  const navigate = useNavigate();
  const basePack = findPackById('pack-base');
  const otherPacks = PACKS.filter((p) => !p.isFree);

  const lastFreePackAtMs = game.lastFreePackAt
    ? (typeof game.lastFreePackAt === 'number' ? game.lastFreePackAt : new Date(game.lastFreePackAt).getTime())
    : 0;
  const cooldownMs = (basePack.freeCooldownHours || 4) * 60 * 60 * 1000;
  const freePackTargetAt = lastFreePackAtMs ? lastFreePackAtMs + cooldownMs : 0;
  const remaining = useCountdown(freePackTargetAt);
  const isFreeAvailable = game.isFreeAvailable(basePack);

  // Per gli utenti autenticati il totale reale del catalogo (tutte le fonti) arriva dal server;
  // in modalità ospite l'unico universo possibile resta il catalogo statico locale delle carte originali.
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
  const missionsServer = useApiResource(
    () => missionApi.getMissions(),
    [game.collection, game.stats]
  );

  const dailyMissions = useMemo(
    () => (missionsServer.data?.missions || []).filter((m) => m.id.startsWith('daily-')).slice(0, 3),
    [missionsServer.data]
  );

  const username = user?.username || 'collezionista';
  const xpPercent = game.levelInfo.xpForNext ? Math.round((game.levelInfo.xpRemaining / game.levelInfo.xpForNext) * 100) : 0;
  const stats = [
    { icon: 'ph-cards', label: 'Carte uniche', value: ownedCount },
    { icon: 'ph-book-open', label: 'Album completo', value: `${progressPercent}%` },
    { icon: 'ph-coin', label: 'Gold', value: game.gold },
    { icon: 'ph-sword', label: 'Vittorie', value: game.stats.totalBattlesWon || 0 }
  ];
  const shortcuts = [
    { to: '/hotel', icon: 'ph-buildings', label: 'Hotel' },
    { to: '/battle', icon: 'ph-sword', label: 'Battaglia' },
    { to: '/binder', icon: 'ph-book-open', label: 'Raccoglitore' },
    { to: '/marketplace', icon: 'ph-storefront', label: 'Mercato' }
  ];

  return (
    <section className="home-page">
      {/* Benvenuto: livello, numeri principali e scorciatoie */}
      <header className="glass-panel home-hero">
        <div className="home-hero-main">
          <p className="home-hero-kicker"><i className="ph-fill ph-house" /> Home</p>
          <h2 className="home-hero-title text-gradient"><SplitText text={`Bentornato, ${username}!`} /></h2>
          <div className="home-hero-level">
            <span className="home-level-badge">Lv {game.level}</span>
            <div className="home-level-bar" role="progressbar" aria-valuenow={xpPercent} aria-valuemin={0} aria-valuemax={100} aria-label="Esperienza verso il prossimo livello">
              <div style={{ width: `${xpPercent}%` }} />
            </div>
            <small>{game.levelInfo.xpRemaining} / {game.levelInfo.xpForNext} XP</small>
          </div>
          <div className="home-hero-actions">
            <button type="button" className="btn btn-primary" onClick={() => navigate('/packs')}>
              <i className="ph-fill ph-gift" /> Apri un pacchetto
            </button>
            {shortcuts.map((s) => (
              <button key={s.to} type="button" className="btn btn-secondary btn-small" onClick={() => navigate(s.to)}>
                <i className={`ph-fill ${s.icon}`} /> {s.label}
              </button>
            ))}
          </div>
        </div>
        <ul className="home-hero-stats">
          {stats.map((st) => (
            <li key={st.label}>
              <i className={`ph-fill ${st.icon}`} />
              <strong>{st.value}</strong>
              <span>{st.label}</span>
            </li>
          ))}
        </ul>
      </header>

      <div className="home-top">
        <DailyCard />

        {/* Pacchetti: quello gratis in evidenza, gli altri come copertine */}
        <div className="glass-panel panel-pack">
          <h3 className="panel-title"><i className="ph-fill ph-gift" /> Pacchetti</h3>
          {isFreeAvailable ? (
            <button type="button" className="free-pack-notice available" onClick={() => navigate('/packs')}>
              <span className="pulse-dot" />
              <span>Pacchetto Base gratis disponibile!</span>
              <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>Clicca per aprire</span>
            </button>
          ) : (
            <div className="free-pack-notice">
              <span><i className="ph-fill ph-gift" /></span>
              <span>Prossimo pacchetto gratuito:</span>
              <span className="cooldown-timer">{formatDuration(remaining)}</span>
            </div>
          )}
          <ul className="home-pack-grid">
            {otherPacks.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => navigate('/packs')} title={`${p.name} · ${p.price} gold`}>
                  <span className="home-pack-art" style={{ background: PACK_IMAGE[p.id] ? undefined : PACK_GRADIENT[p.id] }}>
                    {PACK_IMAGE[p.id] ? <img src={PACK_IMAGE[p.id]} alt="" loading="lazy" /> : <i className={`ph-fill ${PACK_ICON[p.id] || 'ph-gift'}`} />}
                  </span>
                  <small><i className="ph-fill ph-coin" /> {p.price}</small>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Carta in evidenza */}
        <div className="glass-panel panel-featured-card">
          <h3 className="panel-title"><i className="ph-fill ph-star" /> Carta in evidenza</h3>
          {featuredCard ? (
            <>
              <CardTile card={featuredCard} onClick={() => navigate(`/card/${featuredCard.id}`)} />
              <strong className="home-featured-name">{featuredCard.name}</strong>
            </>
          ) : (
            <EmptyState description="Apri il tuo primo pacchetto per scoprire la tua prima carta." />
          )}
        </div>
      </div>

      {/* Progresso album */}
      <div className="glass-panel">
        <div className="panel-header-row">
          <h3 className="panel-title"><i className="ph-fill ph-book-open" /> Progresso VinylDex</h3>
          <span className="progress-text">{progressPercent}%</span>
        </div>
        <AlbumProgress percent={progressPercent} owned={ownedCount} total={totalCatalogCards} />
      </div>

      {/* Ultime carte trovate */}
      <div className="glass-panel">
        <div className="panel-header-row">
          <h3 className="panel-title"><i className="ph-fill ph-cards" /> Ultime carte trovate</h3>
          <button type="button" className="btn btn-secondary btn-small" onClick={() => navigate('/collection')}>
            Tutta la collezione ({ownedCount} / {totalCatalogCards})
          </button>
        </div>
        {recentCards.length > 0 ? (
          <div className="home-recent">
            {recentCards.map((c) => (
              <CardTile key={c.id} card={c} quantity={c.quantity} onClick={() => navigate(`/card/${c.id}`)} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="La tua avventura inizia qui!"
            description="Non hai ancora nessuna carta. Apri il tuo primo pacchetto per iniziare la collezione."
            action={<button className="btn btn-primary" onClick={() => navigate('/packs')}><i className="ph-fill ph-vinyl-record" /> Apri il Primo Pacchetto</button>}
          />
        )}
      </div>

      {/* Missioni giornaliere */}
      <div className="glass-panel">
        <div className="panel-header-row">
          <h3 className="panel-title"><i className="ph-fill ph-target" /> Missioni di oggi</h3>
          <button type="button" className="btn btn-secondary btn-small" onClick={() => navigate('/missions')}>Tutte le missioni</button>
        </div>
        {dailyMissions.length > 0 ? (
          <div className="home-missions">
            {dailyMissions.map((m) => {
              const percent = Math.min((m.progress / m.target) * 100, 100);
              const done = m.progress >= m.target;
              return (
                <div className={`home-mission${done ? ' done' : ''}`} key={m.id}>
                  <span className="home-mission-icon"><i className={`ph-fill ${done ? 'ph-check-circle' : m.icon || 'ph-target'}`} /></span>
                  <div className="home-mission-info">
                    <span className="home-mission-title">{m.title}</span>
                    <div className="home-mission-bar"><div style={{ width: `${percent}%` }} /></div>
                  </div>
                  <span className="home-mission-count">{m.progress}/{m.target}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Nessuna missione giornaliera attiva.</p>
        )}
      </div>
    </section>
  );
}
