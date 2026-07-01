import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGame } from '../hooks/useGame.js';
import { CARDS, findCardById } from '../data/cards.js';
import { PACKS } from '../data/packs.js';
import { getRarityColor, getRarityName } from '../utils/cardUtils.js';
import CardHero from '../components/card/CardHero.jsx';
import EmptyState from '../components/common/EmptyState.jsx';

export default function CardDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { collection, favorites, toggleFavorite } = useGame();

  const masterCard = findCardById(id);

  const ownedEntry = useMemo(() => {
    const matches = collection.filter((c) => c.id === id);
    if (!matches.length) return null;
    const mostRecent = [...matches].sort((a, b) => (b.obtainedAt || 0) - (a.obtainedAt || 0))[0];
    return { ...mostRecent, quantity: matches.length };
  }, [collection, id]);

  if (!masterCard) {
    return (
      <EmptyState
        icon="ph-question"
        title="Carta non trovata"
        description="Questa carta non esiste nel catalogo."
        action={<button className="btn btn-primary" onClick={() => navigate('/album')}>Torna all'Album</button>}
      />
    );
  }

  if (!ownedEntry) {
    const color = getRarityColor(masterCard.rarity);
    let bestPack = PACKS[0];
    let bestRate = PACKS[0].dropRates[masterCard.rarity] || 0;
    PACKS.forEach((p) => {
      const rate = p.dropRates[masterCard.rarity] || 0;
      if (rate > bestRate) { bestRate = rate; bestPack = p; }
    });

    let guaranteeText = '';
    if (masterCard.rarity === 'legendary') guaranteeText = 'Garantita nei Pacchetti Premium!';
    else if (masterCard.rarity === 'epic') guaranteeText = 'Garantita nei Pacchetti Deluxe!';
    else if (masterCard.rarity === 'rare') guaranteeText = 'Garantita in tutti i pacchetti!';

    return (
      <section className="card-detail-page">
        <div style={{ fontSize: '4rem', opacity: 0.3, margin: 'var(--space-lg) 0' }}><i className="ph ph-question" /></div>
        <h2 style={{ color }}>???</h2>
        <span className="card-detail-class">{masterCard.artistClass} — {getRarityName(masterCard.rarity)}</span>

        <div className="glass-panel" style={{ marginTop: 'var(--space-md)', background: 'rgba(0,0,0,0.3)', width: '100%' }}>
          <p style={{ fontStyle: 'italic', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
            Questa carta non è ancora stata scoperta!
          </p>
          {guaranteeText && (
            <div className="card-detail-meta-item">
              <span className="meta-label">Garanzia</span>
              <span className="meta-value" style={{ color: 'var(--neon-gold)' }}>{guaranteeText}</span>
            </div>
          )}
        </div>

        <div className="glass-panel" style={{ marginTop: 'var(--space-md)', background: 'rgba(0,0,0,0.3)', width: '100%' }}>
          <p style={{ marginBottom: 'var(--space-sm)' }}><i className="ph-fill ph-lightbulb" /> <strong>Suggerimento:</strong> Prova ad aprire</p>
          <p style={{ color: 'var(--neon-cyan)', fontWeight: 700 }}>{bestPack.name}</p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Drop rate: <span style={{ color }}>{(bestRate * 100).toFixed(0)}%</span></p>
          <button className="btn btn-primary" style={{ marginTop: 'var(--space-md)' }} onClick={() => navigate('/packs')}>
            <i className="ph-fill ph-gift" /> Apri Pacchetti
          </button>
        </div>
      </section>
    );
  }

  const classCards = CARDS.filter((c) => c.artistClass === masterCard.artistClass);
  const ownedIds = new Set(collection.map((c) => c.id));
  const classProgress = classCards.filter((c) => ownedIds.has(c.id)).length;
  const classTotal = classCards.length;
  const color = getRarityColor(masterCard.rarity);
  const isFavorite = favorites.includes(id);

  const dateStr = ownedEntry.obtainedAt
    ? new Date(ownedEntry.obtainedAt).toLocaleDateString('it-IT', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'Sconosciuta';

  return (
    <section className="card-detail-page">
      <CardHero card={ownedEntry} quantity={ownedEntry.quantity} />

      <div className="card-detail-meta" style={{ width: '100%' }}>
        <div className="card-detail-meta-item">
          <span className="meta-label">Ottenuta il</span>
          <span className="meta-value">{dateStr}</span>
        </div>
        <div className="card-detail-meta-item">
          <span className="meta-label">Quantità</span>
          <span className="meta-value">×{ownedEntry.quantity}</span>
        </div>
        <div className="card-detail-meta-item">
          <span className="meta-label">Classe completata</span>
          <span className="meta-value">{classProgress}/{classTotal}</span>
        </div>
      </div>

      <div className="progress-bar" style={{ width: '100%' }}>
        <div className="progress-fill" style={{ width: `${(classProgress / classTotal) * 100}%`, background: `linear-gradient(90deg, ${color}, ${color}88)` }} />
      </div>

      <button className={`btn ${isFavorite ? 'btn-gold' : 'btn-secondary'}`} onClick={() => toggleFavorite(id)}>
        <i className={isFavorite ? 'ph-fill ph-star' : 'ph ph-star'} /> {isFavorite ? 'Preferita' : 'Aggiungi ai preferiti'}
      </button>

      <button className="btn btn-secondary" onClick={() => navigate(-1)}>Indietro</button>
    </section>
  );
}
