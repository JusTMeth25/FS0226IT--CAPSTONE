import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../hooks/useGame.js';
import { useSound } from '../hooks/useSound.js';
import { CARDS, getArtistClasses } from '../data/cards.js';
import { RARITIES } from '../utils/cardUtils.js';
import CardTile from '../components/card/CardTile.jsx';

const MILESTONES = [
  { percent: 25, reward: '100 Gold', icon: 'ph-coin', gold: 100 },
  { percent: 50, reward: 'Pacchetto Deluxe', icon: 'ph-diamond', pack: 'pack-deluxe' },
  { percent: 75, reward: '200 Gold', icon: 'ph-coin', gold: 200 },
  { percent: 100, reward: 'Trofeo Collezionista', icon: 'ph-trophy', title: 'Collezionista Assoluto' }
];

function Confetti() {
  // Randomicità puramente decorativa (posizione/colore dei coriandoli): generata una sola
  // volta e memoizzata, non influisce sullo stato di gioco né sulla logica di rendering.
  /* eslint-disable react-hooks/purity */
  const pieces = useMemo(() => {
    const colors = ['#FFD700', '#8B5CF6', '#EC4899', '#22D3EE', '#FF6B6B', '#4CAF50', '#FF9800'];
    return Array.from({ length: 60 }, (_, i) => ({
      left: Math.random() * 100,
      color: colors[i % colors.length],
      size: 6 + Math.random() * 8,
      duration: 2 + Math.random() * 3,
      delay: Math.random() * 2,
      round: Math.random() > 0.5
    }));
  }, []);
  /* eslint-enable react-hooks/purity */

  return (
    <>
      {pieces.map((p, i) => (
        <div
          key={i}
          className="vinyl-dex-confetti"
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            width: p.size,
            height: p.size,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            borderRadius: p.round ? '50%' : '2px'
          }}
        />
      ))}
    </>
  );
}

export default function AlbumPage() {
  const game = useGame();
  const { sound } = useSound();
  const navigate = useNavigate();
  const [classFilter, setClassFilter] = useState('');
  const [rarityFilter, setRarityFilter] = useState('');

  const artistClasses = useMemo(() => getArtistClasses(), []);
  const ownedIds = useMemo(() => new Set(game.collection.map((c) => c.id)), [game.collection]);
  const ownedCount = ownedIds.size;
  const totalCards = CARDS.length;
  const progressPercent = totalCards > 0 ? Math.round((ownedCount / totalCards) * 100) : 0;

  const filteredCards = useMemo(() => {
    let cards = [...CARDS];
    if (classFilter) cards = cards.filter((c) => c.artistClass === classFilter);
    if (rarityFilter) cards = cards.filter((c) => c.rarity === rarityFilter);
    return cards;
  }, [classFilter, rarityFilter]);

  function handleClaim(milestone) {
    const reached = ownedCount >= Math.ceil(totalCards * (milestone.percent / 100));
    const claimed = game.claimedAlbumRewards.includes(milestone.percent);
    if (!reached || claimed) return;
    game.claimAlbumReward(milestone);
    if (milestone.percent === 100) sound.levelUp();
    else sound.reward();
  }

  return (
    <section className="vinyl-dex-page">
      {progressPercent >= 100 && <Confetti />}
      <h2 className="section-title text-gradient"><i className="ph-fill ph-book-open" /> VinylLegends</h2>
      <p className="text-center vinyl-dex-subtitle">Catalogo completo degli artisti dell'universo VinylLegends</p>

      <div className="glass-panel vinyl-dex-progress-card">
        <div className="vinyl-dex-progress-top">
          <div className="vinyl-dex-progress-info">
            <span className="vinyl-dex-progress-title">Progresso Catalogo</span>
            <span className="vinyl-dex-progress-count">{ownedCount} / {totalCards}</span>
          </div>
          <span className="vinyl-dex-progress-percent">{progressPercent}%</span>
        </div>
        <div className="progress-bar vinyl-dex-progress-bar"><div className="progress-fill" style={{ width: `${progressPercent}%` }} /></div>

        <div className="vinyl-dex-rewards">
          {MILESTONES.map((m) => {
            const needed = Math.ceil(totalCards * (m.percent / 100));
            const reached = ownedCount >= needed;
            const claimed = game.claimedAlbumRewards.includes(m.percent);
            return (
              <div
                key={m.percent}
                className={`vinyl-dex-reward ${reached ? 'reward-reached' : ''} ${claimed ? 'reward-claimed' : ''}`}
                onClick={() => handleClaim(m)}
              >
                <span className="reward-icon"><i className={`ph-fill ${claimed ? 'ph-check-circle' : reached ? m.icon : 'ph-lock'}`} /></span>
                <div className="reward-info">
                  <span className="reward-label">{m.percent}% — {m.reward}</span>
                  <span className="reward-status">{claimed ? 'Reclamato!' : reached ? 'Clicca per reclamare!' : `${needed} carte necessarie`}</span>
                </div>
                {!reached && <div className="reward-progress-mini"><div className="reward-progress-fill" style={{ width: `${Math.min((ownedCount / needed) * 100, 100)}%` }} /></div>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="collection-filters glass-panel">
        <div className="filter-row">
          <div className="filter-group">
            <label className="filter-label">Classe</label>
            <select className="filter-select" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
              <option value="">Tutte le Classi</option>
              {artistClasses.map((cls) => <option key={cls} value={cls}>{cls}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Rarità</label>
            <select className="filter-select" value={rarityFilter} onChange={(e) => setRarityFilter(e.target.value)}>
              <option value="">Tutte le Rarità</option>
              {Object.entries(RARITIES).map(([key, r]) => <option key={key} value={key}>{r.name}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Filtro rapido</label>
            <div className="filter-buttons">
              <button className="btn btn-secondary btn-small" onClick={() => setRarityFilter('')}>Tutte</button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid vinyl-dex-grid">
        {filteredCards.map((card) => (
          <CardTile
            key={card.id}
            card={card}
            unknown={!ownedIds.has(card.id)}
            onClick={() => navigate(`/card/${card.id}`)}
          />
        ))}
      </div>
    </section>
  );
}
