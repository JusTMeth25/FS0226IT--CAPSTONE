import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGame } from '../hooks/useGame.js';
import { CARDS, findCardById } from '../data/cards.js';
import { PACKS } from '../data/packs.js';
import { getRarityColor, getRarityName } from '../utils/cardUtils.js';
import { cardApi } from '../services/cardApi.js';
import { useApiResource } from '../hooks/useApiResource.js';
import CardHero from '../components/card/CardHero.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import LoadingSpinner from '../components/common/LoadingSpinner.jsx';

export default function CardDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { collection, favorites, toggleFavorite } = useGame();

  // Catalogo statico locale (le 43 carte originali): copre subito il flusso "carta non ancora
  // scoperta" dell'Album. Le carte importate da API esterne non ci sono e vanno cercate lato server.
  const localCard = findCardById(id);

  const ownedEntry = useMemo(() => {
    const matches = collection.filter((c) => c.id === id);
    if (!matches.length) return null;
    const mostRecent = [...matches].sort((a, b) => new Date(b.obtainedAt || 0) - new Date(a.obtainedAt || 0))[0];
    // Il server restituisce già la quantità reale sull'entry; l'ospite ha una entry per copia.
    return { ...mostRecent, quantity: 'quantity' in mostRecent ? mostRecent.quantity : matches.length };
  }, [collection, id]);

  // Se la carta non è né nel catalogo locale né tra quelle possedute, potrebbe comunque esistere
  // nel catalogo backend (es. importata da Pokémon/Scryfall/Yu-Gi-Oh! ma non ancora posseduta).
  const needsRemoteLookup = !localCard && !ownedEntry;
  const remote = useApiResource(
    () => (needsRemoteLookup ? cardApi.getCard(id) : Promise.resolve(null)),
    [id, needsRemoteLookup]
  );

  const referenceCard = ownedEntry || localCard || remote.data?.card || null;

  if (!referenceCard) {
    if (needsRemoteLookup && remote.loading) return <LoadingSpinner label="Carico la carta…" />;
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
    const color = getRarityColor(referenceCard.rarity);
    let bestPack = PACKS[0];
    let bestRate = PACKS[0].dropRates[referenceCard.rarity] || 0;
    PACKS.forEach((p) => {
      const rate = p.dropRates[referenceCard.rarity] || 0;
      if (rate > bestRate) { bestRate = rate; bestPack = p; }
    });

    let guaranteeText = '';
    if (referenceCard.rarity === 'legendary') guaranteeText = 'Garantita nei Pacchetti Premium!';
    else if (referenceCard.rarity === 'epic') guaranteeText = 'Garantita nei Pacchetti Deluxe!';
    else if (referenceCard.rarity === 'rare') guaranteeText = 'Garantita in tutti i pacchetti!';

    return (
      <section className="card-detail-page">
        <div style={{ fontSize: '4rem', opacity: 0.3, margin: 'var(--space-lg) 0' }}><i className="ph ph-question" /></div>
        <h2 style={{ color }}>???</h2>
        <span className="card-detail-class">{referenceCard.artistClass || referenceCard.source} — {getRarityName(referenceCard.rarity)}</span>

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

  // Carta posseduta: usiamo sempre i dati reali di `ownedEntry` (collezione), mai il catalogo
  // locale — così funziona anche per le carte importate, che non sono nel catalogo statico.
  const classCards = ownedEntry.artistClass ? CARDS.filter((c) => c.artistClass === ownedEntry.artistClass) : [];
  const ownedIds = new Set(collection.map((c) => c.id));
  const classProgress = classCards.filter((c) => ownedIds.has(c.id)).length;
  const classTotal = classCards.length;
  const color = getRarityColor(ownedEntry.rarity);
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
        {classTotal > 0 ? (
          <div className="card-detail-meta-item">
            <span className="meta-label">Classe completata</span>
            <span className="meta-value">{classProgress}/{classTotal}</span>
          </div>
        ) : (
          <div className="card-detail-meta-item">
            <span className="meta-label">Fonte</span>
            <span className="meta-value">{ownedEntry.source === 'original' ? 'VinylDex' : ownedEntry.source}</span>
          </div>
        )}
      </div>

      {classTotal > 0 && (
        <div className="progress-bar" style={{ width: '100%' }}>
          <div className="progress-fill" style={{ width: `${(classProgress / classTotal) * 100}%`, background: `linear-gradient(90deg, ${color}, ${color}88)` }} />
        </div>
      )}

      <button className={`btn ${isFavorite ? 'btn-gold' : 'btn-secondary'}`} onClick={() => toggleFavorite(id)}>
        <i className={isFavorite ? 'ph-fill ph-star' : 'ph ph-star'} /> {isFavorite ? 'Preferita' : 'Aggiungi ai preferiti'}
      </button>

      <button className="btn btn-secondary" onClick={() => navigate(-1)}>Indietro</button>
    </section>
  );
}
