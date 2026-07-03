import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../hooks/useGame.js';
import { CARDS } from '../data/cards.js';
import { PACKS } from '../data/packs.js';
import { findPackById } from '../data/packs.js';
import { getRarityColor, getTotalScore, RARITY_ORDER } from '../utils/cardUtils.js';
import { generateMissions } from '../utils/missionUtils.js';
import { dedupeCollection } from '../utils/collectionUtils.js';
import { useCountdown, formatDuration } from '../hooks/useCountdown.js';
import CardTile from '../components/card/CardTile.jsx';
import EmptyState from '../components/common/EmptyState.jsx';

function StatBar({ label, value, max, color }) {
  const percent = Math.min((value / max) * 100, 100);
  return (
    <div className="stat-bar-row">
      <span className="stat-bar-label">{label}</span>
      <div className="stat-bar-track"><div className="stat-bar-fill" style={{ width: `${percent}%`, background: color }} /></div>
      <span className="stat-bar-value" style={{ color }}>{value}</span>
    </div>
  );
}

export default function HomePage() {
  const game = useGame();
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
      recentCards: unique.slice(0, 8),
      featuredCard: featured,
      ownedCount: unique.length,
      progressPercent: CARDS.length > 0 ? Math.round((unique.length / CARDS.length) * 100) : 0
    };
  }, [game.collection]);

  const dailyMissions = useMemo(
    () => generateMissions(game).filter((m) => m.type === 'daily').slice(0, 3),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [game.stats, game.claimedMissions]
  );

  return (
    <section className="home-page">
      <h2 className="section-title text-gradient"><i className="ph-fill ph-house" /> Home</h2>

      <div className="dashboard-grid">
        {/* Pannello apertura pacchetto */}
        <div className="glass-panel panel-pack">
          <h3 className="panel-title"><i className="ph-fill ph-gift" /> Apertura Pacchetto</h3>
          {isFreeAvailable ? (
            <div className="free-pack-notice available" onClick={() => navigate('/packs')}>
              <span className="pulse-dot" />
              <span>Pacchetto Base Disponibile!</span>
              <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>Clicca per aprire</span>
            </div>
          ) : (
            <div className="free-pack-notice">
              <span><i className="ph-fill ph-gift" /></span>
              <span>Prossimo pacchetto gratuito:</span>
              <span className="cooldown-timer">{formatDuration(remaining)}</span>
            </div>
          )}
          <button className="btn btn-primary btn-large" onClick={() => navigate('/packs')}>
            <i className="ph-fill ph-vinyl-record" /> Apri un Pacchetto
          </button>
          <div className="panel-pack-other-row">
            {otherPacks.map((p) => (
              <div className="pack-detail" key={p.id}>
                <span className="pack-detail-label">{p.name}</span>
                <span className="pack-detail-value"><i className="ph-fill ph-coin" /> {p.price}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Carta in evidenza */}
        <div className="glass-panel panel-featured-card">
          <h3 className="panel-title"><i className="ph-fill ph-star" /> Carta in Evidenza</h3>
          {featuredCard ? (
            <CardTile card={featuredCard} onClick={() => navigate(`/card/${featuredCard.id}`)} />
          ) : (
            <EmptyState description="Apri il tuo primo pacchetto per scoprire la tua prima carta." />
          )}
        </div>

        {/* Progresso album */}
        <div className="glass-panel panel-full">
          <div className="panel-header-row">
            <h3 className="panel-title"><i className="ph-fill ph-book-open" /> Progresso VinylLegends</h3>
            <span className="progress-text">{progressPercent}%</span>
          </div>
          <div className="progress-bar"><div className="progress-fill" style={{ width: `${progressPercent}%` }} /></div>
        </div>

        {/* Preview collezione */}
        <div className="glass-panel panel-full">
          <div className="panel-header-row">
            <h3 className="panel-title"><i className="ph-fill ph-cards" /> La Tua Collezione</h3>
            <span className="panel-header-count">{ownedCount} / {CARDS.length} carte</span>
          </div>
          {recentCards.length > 0 ? (
            <div className="collection-grid">
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
          <div className="text-center" style={{ marginTop: 'var(--space-md)' }}>
            <button className="btn btn-secondary btn-small" onClick={() => navigate('/collection')}>Vedi tutta la collezione</button>
          </div>
        </div>

        {/* Statistiche carta in evidenza */}
        <div className="glass-panel">
          {featuredCard ? (
            <div className="card-detail-stats">
              <h3><i className="ph-fill ph-chart-bar" /> Statistiche — {featuredCard.name}</h3>
              <StatBar label={<><i className="ph-fill ph-microphone-stage" /> Fans</>} value={featuredCard.stats.fans} max={100} color={getRarityColor(featuredCard.rarity)} />
              <StatBar label={<><i className="ph-fill ph-palette" /> Style</>} value={featuredCard.stats.style} max={100} color={getRarityColor(featuredCard.rarity)} />
              <StatBar label={<><i className="ph-fill ph-megaphone" /> Influence</>} value={featuredCard.stats.influence} max={100} color={getRarityColor(featuredCard.rarity)} />
              <StatBar label={<><i className="ph-fill ph-lightning" /> Energy</>} value={featuredCard.stats.energy} max={100} color={getRarityColor(featuredCard.rarity)} />
              <div className="stat-total">
                <span>Punteggio Totale</span>
                <span className="stat-total-value">{getTotalScore(featuredCard)}/400</span>
              </div>
            </div>
          ) : (
            <>
              <h3 className="panel-title"><i className="ph-fill ph-chart-bar" /> Statistiche</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Nessuna carta da mostrare.</p>
            </>
          )}
        </div>

        {/* Missioni giornaliere */}
        <div className="glass-panel panel-full">
          <h3 className="panel-title"><i className="ph-fill ph-target" /> Missioni Giornaliere</h3>
          {dailyMissions.length > 0 ? (
            <div className="missions-list">
              {dailyMissions.map((m) => {
                const percent = Math.min((m.progress / m.target) * 100, 100);
                return (
                  <div className="missions-item" key={m.id}>
                    <span className="missions-item-icon"><i className={`ph-fill ${m.icon}`} /></span>
                    <div className="missions-item-info">
                      <span className="missions-item-title">{m.title}</span>
                      <div className="missions-item-progress">
                        <div className="missions-item-bar"><div className="missions-item-fill" style={{ width: `${percent}%` }} /></div>
                        <span className="missions-item-text">{m.progress}/{m.target}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Nessuna missione giornaliera attiva.</p>
          )}
          <div className="text-center" style={{ marginTop: 'var(--space-md)' }}>
            <button className="btn btn-secondary btn-small" onClick={() => navigate('/missions')}>Vai alle Missioni</button>
          </div>
        </div>
      </div>
    </section>
  );
}
