import { lazy, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGame } from '../hooks/useGame.js';
import { useAuth } from '../hooks/useAuth.js';
import { findCardById } from '../data/cards.js';
import { PACKS } from '../data/packs.js';
import { getRarityColor, getRarityName, getSourceLabel, formatCardPrice, resolveCardImage } from '../utils/cardUtils.js';
import { cardApi } from '../services/cardApi.js';
import { useApiResource } from '../hooks/useApiResource.js';
import CardHero from '../components/card/CardHero.jsx';
import Fc27Credits from '../components/card/Fc27Credits.jsx';
import NikkeCredits from '../components/card/NikkeCredits.jsx';
import TcgplayerCredits from '../components/card/TcgplayerCredits.jsx';
import GradingBox, { GradeBadge } from '../components/card/GradingBox.jsx';
import PriceHistory from '../components/card/PriceHistory.jsx';
import GradedSlab from '../components/card/GradedSlab.jsx';
import WishButton from '../components/card/WishButton.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import LoadingSpinner from '../components/common/LoadingSpinner.jsx';
import RarityAmbience from '../components/fx/RarityAmbience.jsx';
import ThreeGate from '../components/three/ThreeGate.jsx';

// La carta 3D porta con se' three.js: si scarica solo quando si apre il dettaglio di una carta posseduta.
const Card3D = lazy(() => import('../components/three/Card3D.jsx'));

export default function CardDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { collection, favorites, toggleFavorite, gold, refreshCollection } = useGame();
  const { refreshUser } = useAuth();

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
    // Solo un 404 vuol dire che la carta non c'e': per gli altri errori (server occupato, rete) si riprova.
    if (needsRemoteLookup && remote.error && remote.error.status !== 404) {
      return (
        <EmptyState
          icon="ph-wifi-slash"
          title="Carta non caricata"
          description={remote.error.status === 429
            ? 'Troppe richieste in poco tempo: aspetta qualche secondo e riprova.'
            : 'Il server non ha risposto. Riprova tra poco.'}
          action={<button className="btn btn-primary" onClick={() => remote.reload()}>Riprova</button>}
        />
      );
    }
    return (
      <EmptyState
        icon="ph-question"
        title="Carta non trovata"
        description="Questa carta non esiste nel catalogo."
        action={<button className="btn btn-primary" onClick={() => navigate('/collection')}>Torna alla Collezione</button>}
      />
    );
  }

  // Carta che non hai (vista su un NPC, in una vetrina, nel raccoglitore): si vede lo stesso per
  // intero, con in piu' il pacchetto dove e' piu' facile trovarla.
  let packHint = null;
  if (!ownedEntry) {
    // Il pacchetto del suo gioco, se c'e', pesca da un catalogo piu' piccolo: e' il consiglio migliore.
    const gamePack = PACKS.find((p) => p.source && p.source === referenceCard.source);
    const candidates = gamePack ? [gamePack] : PACKS.filter((p) => !p.source);
    let bestPack = candidates[0];
    let bestRate = candidates[0].dropRates[referenceCard.rarity] || 0;
    candidates.forEach((p) => {
      const rate = p.dropRates[referenceCard.rarity] || 0;
      if (rate > bestRate) { bestRate = rate; bestPack = p; }
    });

    let guaranteeText = '';
    if (gamePack) guaranteeText = referenceCard.rarity === 'rare' ? `Garantita nel ${gamePack.name}!` : '';
    else if (referenceCard.rarity === 'legendary') guaranteeText = 'Garantita nei Pacchetti Premium!';
    else if (referenceCard.rarity === 'epic') guaranteeText = 'Garantita nei Pacchetti Deluxe!';
    else if (referenceCard.rarity === 'rare') guaranteeText = 'Garantita in tutti i pacchetti!';
    packHint = { bestPack, bestRate, guaranteeText };
  }

  const isFavorite = favorites.includes(id);

  const card = ownedEntry || referenceCard;
  const dateStr = ownedEntry?.obtainedAt
    ? new Date(ownedEntry.obtainedAt).toLocaleDateString('it-IT', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'Sconosciuta';

  return (
    <section className="card-detail-page" style={{ '--rarity-color': getRarityColor(card.rarity) }}>
      <RarityAmbience rarity={card.rarity} />

      <ThreeGate fallback={card.grade > 0
        ? <><GradedSlab card={card} /><CardHero card={card} quantity={card.quantity} hideArt /></>
        : <CardHero card={card} quantity={card.quantity} />}
        loading={(
          <>
            <div className="card-3d-stage">
              <div className="card-3d-canvas card-3d-loading"><img src={resolveCardImage(card)} alt="" /></div>
              <span className="btn btn-secondary card-3d-flip card-3d-flip-placeholder" aria-hidden="true">Gira la carta</span>
            </div>
            <CardHero card={card} quantity={card.quantity} hideArt />
          </>
        )}>
        <Card3D card={card} />
        <CardHero card={card} quantity={card.quantity} hideArt />
      </ThreeGate>

      <h2 className="card-detail-title">{card.name}</h2>
      {!ownedEntry && <span className="card-detail-rarity-chip card-detail-missing"><i className="ph ph-lock-simple" /> Non ce l&apos;hai ancora</span>}
      <span className="card-detail-rarity-chip">{getRarityName(card.rarity)}</span>
      <GradeBadge grade={card.grade} />
      {card.firstEdition && (
        <span className="first-edition-badge" title="Una delle sole dieci copie numerate di questa carta: esce di rado (1% le comuni, 10% le leggendarie) e vale una volta e mezza">
          <i className="ph-fill ph-medal" /> Prima edizione #{card.firstEdition}/10
        </span>
      )}
      {card.foil > 0 && <span className="foil-badge foil-badge-inline">Olografica{card.foil > 1 ? ` ×${card.foil}` : ''}</span>}

      <div className="card-detail-meta" style={{ width: '100%' }}>
        {ownedEntry && (
          <>
            <div className="card-detail-meta-item">
              <span className="meta-label">Ottenuta il</span>
              <span className="meta-value">{dateStr}</span>
            </div>
            <div className="card-detail-meta-item">
              <span className="meta-label">Quantità</span>
              <span className="meta-value">×{card.quantity}</span>
            </div>
          </>
        )}
        <div className="card-detail-meta-item">
          <span className="meta-label">Fonte</span>
          <span className="meta-value">{getSourceLabel(card.source)}</span>
        </div>
        {formatCardPrice(ownedEntry) && (
          <div className="card-detail-meta-item">
            <span className="meta-label">{card.coinPrice ? 'Prezzo Ultimate Team' : 'Valore di mercato'}</span>
            <span className="meta-value" style={{ color: 'var(--neon-gold)' }}>{formatCardPrice(ownedEntry)}</span>
          </div>
        )}
      </div>

      {card.source === 'fc27' && <Fc27Credits />}
      {card.source === 'nikke' && <NikkeCredits />}
      <TcgplayerCredits source={card.source} />

      <PriceHistory code={card.id} />

      <WishButton code={card.id} />

      {ownedEntry ? (
        <>
          <GradingBox card={card} gold={gold} onGraded={() => { refreshCollection(); refreshUser(); }} />
          <button className={`btn ${isFavorite ? 'btn-gold' : 'btn-secondary'}`} onClick={() => toggleFavorite(id)}>
            <i className={isFavorite ? 'ph-fill ph-star' : 'ph ph-star'} /> {isFavorite ? 'Preferita' : 'Aggiungi ai preferiti'}
          </button>
        </>
      ) : (
        <div className="glass-panel" style={{ background: 'rgba(0,0,0,0.3)', width: '100%' }}>
          <p style={{ marginBottom: 'var(--space-sm)' }}><i className="ph-fill ph-lightbulb" /> <strong>La vuoi?</strong> Prova ad aprire</p>
          <p style={{ color: 'var(--neon-cyan)', fontWeight: 700 }}>{packHint.bestPack.name}</p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Drop rate: <span style={{ color: getRarityColor(card.rarity) }}>{(packHint.bestRate * 100).toFixed(0)}%</span></p>
          {packHint.guaranteeText && <p style={{ fontSize: '0.8rem', color: 'var(--neon-gold)' }}>{packHint.guaranteeText}</p>}
          <button className="btn btn-primary" style={{ marginTop: 'var(--space-md)' }} onClick={() => navigate('/packs')}>
            <i className="ph-fill ph-gift" /> Apri Pacchetti
          </button>
        </div>
      )}

      <button className="btn btn-secondary" onClick={() => navigate(-1)}>Indietro</button>
    </section>
  );
}
