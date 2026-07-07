import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../hooks/useGame.js';
import { useSound } from '../hooks/useSound.js';
import { useCountUp } from '../hooks/useCountUp.js';
import { PACKS } from '../data/packs.js';
import { getRarityColor, getStars, resolveCardImage } from '../utils/cardUtils.js';
import { formatDuration } from '../hooks/useCountdown.js';
import RevealSpark from '../components/common/RevealSpark.jsx';
import StarBorder from '../components/common/StarBorder.jsx';
import CardHoloFrame from '../components/card/CardHoloFrame.jsx';
import CardTile, { RarityBadge } from '../components/card/CardTile.jsx';
import CardHero from '../components/card/CardHero.jsx';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock.js';

// Trascinamento orizzontale (in px) necessario per completare lo strappo del pacchetto.
const TEAR_DRAG_MAX = 120;
const TEAR_COMPLETE_THRESHOLD = 0.5;

const PACK_ICON = { 'pack-base': 'ph-gift', 'pack-deluxe': 'ph-diamond', 'pack-premium': 'ph-crown' };
const PACK_GRADIENT = {
  'pack-base': 'linear-gradient(135deg, var(--neon-purple), var(--neon-magenta))',
  'pack-deluxe': 'linear-gradient(135deg, var(--neon-blue), var(--neon-cyan))',
  'pack-premium': 'linear-gradient(135deg, #FFD700, #FFA500)'
};
// Artwork dedicata per pacchetto (se assente si usa icona + gradient come fallback).
const PACK_IMAGE = {
  'pack-base': '/assets/img/BasePack.png',
  'pack-deluxe': '/assets/img/DeluxePack.png',
  'pack-premium': '/assets/img/PremiumPack.png'
};
// Intensità dell'effetto tilt/holo sui pacchetti, mappata su una rarità equivalente per tier.
const PACK_TILT_RARITY = { 'pack-base': 'rare', 'pack-deluxe': 'epic', 'pack-premium': 'legendary' };

/** Riflesso olografico + sparkle sopra la card pacchetto, stesso pattern usato per le carte. */
function PackHoloLayers() {
  return (
    <>
      <div className="card-holo-glare" />
      <div className="card-holo-rainbow" />
      <div className="card-holo-sparkles">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className={`card-sparkle card-sparkle-${i + 1}`} />
        ))}
      </div>
    </>
  );
}

function PackSelectCard({ pack, gold, isFreeAvailable, cooldownRemaining, giftedCount, onOpen, submitting }) {
  const canAffordPaid = gold >= pack.price;
  const packImage = PACK_IMAGE[pack.id];

  return (
    <CardHoloFrame rarity={PACK_TILT_RARITY[pack.id] || 'rare'} maxTilt={6} className="pack-card glass-panel">
      <div className="pack-card-art-wrap" style={{ background: packImage ? undefined : PACK_GRADIENT[pack.id] }}>
        {packImage ? (
          <img className="pack-card-art-full" src={packImage} alt={pack.name} />
        ) : (
          <>
            <span className="pack-icon"><i className={`ph-fill ${PACK_ICON[pack.id] || 'ph-gift'}`} /></span>
            <h3 className="pack-card-name">{pack.name}</h3>
          </>
        )}
        <span className="pack-card-count">{pack.cardCount} carte</span>
        {giftedCount > 0 && <span className="pack-card-price-badge pack-card-price-free pack-card-gift-badge"><i className="ph-fill ph-gift" /> x{giftedCount}</span>}
      </div>
      <PackHoloLayers />
      <div className="pack-card-body pack-card-body-slim">
        <div className="pack-card-actions">
          {giftedCount > 0 && (
            <button className="btn btn-primary" disabled={submitting} onClick={() => onOpen(pack.id, 'gift')}>
              <i className="ph-fill ph-gift" /> Apri Regalo (x{giftedCount})
            </button>
          )}
          {pack.isFree && (
            isFreeAvailable
              ? <button className="btn btn-primary" disabled={submitting} onClick={() => onOpen(pack.id, 'free')}><i className="ph-fill ph-sparkle" /> Apri Gratis</button>
              : <button className="btn btn-secondary" disabled><i className="ph-fill ph-hourglass" /> Gratis tra {formatDuration(cooldownRemaining).slice(0, 5)}</button>
          )}
          {pack.id === 'pack-premium' && canAffordPaid ? (
            <StarBorder color="#FFD700" speed="3s">
              <button className="btn btn-gold" style={{ width: '100%' }} disabled={submitting} onClick={() => onOpen(pack.id, 'paid')}>
                <i className="ph-fill ph-coin" /> {submitting ? 'Apertura…' : `Apri Pacchetto (${pack.price})`}
              </button>
            </StarBorder>
          ) : (
            <button
              className={`btn ${canAffordPaid ? 'btn-primary' : 'btn-secondary'}`}
              disabled={submitting}
              onClick={() => onOpen(pack.id, 'paid')}
            >
              <i className="ph-fill ph-coin" /> {submitting ? 'Apertura…' : pack.isFree ? `Compra (${pack.price})` : `Apri Pacchetto (${pack.price})`}
            </button>
          )}
        </div>
      </div>
    </CardHoloFrame>
  );
}

// Intensità della scintillata di rivelazione, scalata per rarità (le comuni ricevono solo un piccolo accenno).
const REVEAL_SPARK_BY_RARITY = {
  common: { count: 4, radius: 26, color: '#ccc' },
  uncommon: { count: 5, radius: 30 },
  rare: { count: 6, radius: 34 },
  epic: { count: 9, radius: 42 },
  legendary: { count: 14, radius: 55, color: '#FFD700' }
};

function RevealCard({ card, size = 'grid' }) {
  const color = getRarityColor(card.rarity);
  const rarityClass = `card-rarity-${card.rarity}`;
  const sizeClass = size === 'hero' ? 'pack-reveal-card-hero' : '';
  const spark = REVEAL_SPARK_BY_RARITY[card.rarity] || REVEAL_SPARK_BY_RARITY.common;

  if (card.fullImage) {
    return (
      <div className={`pack-reveal-card ${rarityClass} ${sizeClass} pack-reveal-flip`} style={{ overflow: 'hidden', borderRadius: 12, position: 'relative' }}>
        <img src={resolveCardImage(card)} alt={card.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }} />
        <RevealSpark color={spark.color || color} count={spark.count} radius={spark.radius} />
      </div>
    );
  }

  return (
    <div className={`pack-reveal-card ${rarityClass} ${sizeClass} pack-reveal-flip`}>
      <div className="pack-reveal-card-inner">
        <div className="pack-reveal-art">
          <img src={resolveCardImage(card)} alt={card.name} />
          <RarityBadge rarity={card.rarity} />
        </div>
        <div className="pack-reveal-info">
          <span className="pack-reveal-name">{card.name}</span>
          <span className="pack-reveal-class">{card.artistClass}</span>
          <span className="pack-reveal-stars">
            {Array.from({ length: 5 }, (_, i) => (
              <i key={i} className={i < getStars(card.rarity) ? 'ph-fill ph-star' : 'ph ph-star'} style={{ color: i < getStars(card.rarity) ? color : '#333' }} />
            ))}
          </span>
        </div>
      </div>
      <RevealSpark color={spark.color || color} count={spark.count} radius={spark.radius} />
    </div>
  );
}

export default function PackOpeningPage() {
  const game = useGame();
  const { sound } = useSound();
  const navigate = useNavigate();
  const displayGold = useCountUp(game.gold);

  const [phase, setPhase] = useState('select');
  const [selectedPack, setSelectedPack] = useState(null);
  const [cards, setCards] = useState([]);
  const [revealIndex, setRevealIndex] = useState(0);
  const [advancing, setAdvancing] = useState(false);
  const [notice, setNotice] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [inspectedCard, setInspectedCard] = useState(null);
  // Sul modal di ispezione, blocca lo scroll di sfondo: altrimenti trascinare il dito sulla
  // carta per l'effetto tilt scorre erroneamente il riepilogo sottostante.
  useBodyScrollLock(!!inspectedCard);

  // Strappo del pacchetto: l'utente deve trascinare fisicamente le due metà (niente auto-apertura).
  const [dragProgress, setDragProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [torn, setTorn] = useState(false);
  const dragStartX = useRef(0);

  // I setTimeout di questa pagina aggiornano stato dopo un delay (transizioni di fase, notice
  // auto-dismiss): se l'utente naviga via prima che scattino, andrebbero a scrivere su un
  // componente smontato. Li tracciamo qui e li ripuliamo tutti allo smontaggio.
  const pendingTimers = useRef(new Set());
  const trackedTimeout = useCallback((fn, ms) => {
    const id = setTimeout(() => { pendingTimers.current.delete(id); fn(); }, ms);
    pendingTimers.current.add(id);
    return id;
  }, []);
  useEffect(() => () => { pendingTimers.current.forEach(clearTimeout); }, []);

  const basePack = PACKS.find((p) => p.isFree);
  const cooldownRemaining = game.getFreeCooldownRemaining(basePack);
  const isFreeAvailable = game.isFreeAvailable(basePack);

  // Fase 'opening': reset dello stato di trascinamento all'ingresso (l'apertura vera e propria
  // parte solo quando l'utente trascina il pacchetto, vedi handleTear*).
  useEffect(() => {
    if (phase !== 'opening') return undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset intenzionale all'ingresso nella fase 'opening'
    setDragProgress(0);
    setDragging(false);
    setTorn(false);
    return undefined;
  }, [phase]);

  // Fase 'reveal': una carta gigante alla volta (stile Pokémon TCG Pocket), avanzamento a tocco.
  useEffect(() => {
    if (phase !== 'reveal') return undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset intenzionale all'ingresso nella fase 'reveal'
    setRevealIndex(0);
    setAdvancing(false);
    if (cards[0]) sound.cardReveal(cards[0].rarity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function handleTearPointerDown(e) {
    if (torn) return;
    dragStartX.current = e.clientX;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handleTearPointerMove(e) {
    if (!dragging || torn) return;
    const delta = Math.abs(e.clientX - dragStartX.current);
    setDragProgress(Math.min(1, delta / TEAR_DRAG_MAX));
  }

  function completeTear() {
    setDragging(false);
    setTorn(true);
    setDragProgress(1);
    sound.packOpen();
    trackedTimeout(() => setPhase('reveal'), 550);
  }

  function handleTearPointerUp() {
    if (!dragging || torn) return;
    setDragging(false);
    if (dragProgress >= TEAR_COMPLETE_THRESHOLD) {
      completeTear();
    } else {
      setDragProgress(0);
    }
  }

  function advanceReveal() {
    if (advancing) return;
    if (revealIndex + 1 >= cards.length) {
      setPhase('summary');
      return;
    }
    setAdvancing(true);
    const next = revealIndex + 1;
    setRevealIndex(next);
    sound.cardReveal(cards[next].rarity);
    trackedTimeout(() => setAdvancing(false), 450);
  }

  const ERROR_MESSAGES = {
    insufficient_gold: 'Non hai abbastanza gold per questo pacchetto.',
    cooldown: 'Il pacchetto gratuito non è ancora disponibile.',
    no_gift_available: 'Non hai più pacchetti regalo di questo tipo.',
    open_pack_failed: 'Non è stato possibile aprire il pacchetto. Riprova.'
  };

  async function handleOpen(packId, mode) {
    // Guardia anti doppio-click: senza, un secondo click mentre la richiesta è in corso
    // avviava una seconda apertura che, arrivando in ritardo, faceva ripartire da capo
    // l'animazione di reveal già avviata dalla prima.
    if (submitting) return;

    const pack = PACKS.find((p) => p.id === packId);
    if (mode === 'paid' && game.gold < pack.price) {
      sound.error();
      setNotice(ERROR_MESSAGES.insufficient_gold);
      trackedTimeout(() => setNotice(null), 3000);
      return;
    }

    setSubmitting(true);
    const res = await game.openPack(packId, mode);
    setSubmitting(false);

    if (res.error) {
      sound.error();
      setNotice(ERROR_MESSAGES[res.error] || ERROR_MESSAGES.open_pack_failed);
      trackedTimeout(() => setNotice(null), 3000);
      return;
    }
    setSelectedPack(pack);
    setCards(res.cards);
    setPhase('opening');
  }

  function resetToSelect() {
    setPhase('select');
    setSelectedPack(null);
    setCards([]);
    setRevealIndex(0);
    setDragProgress(0);
    setTorn(false);
    setInspectedCard(null);
  }

  if (phase === 'select') {
    return (
      <section className="packs-page">
        <h2 className="section-title text-gradient"><i className="ph-fill ph-gift" /> Apri un Pacchetto</h2>
        <p className="text-center packs-subtitle">Scegli il pacchetto che vuoi aprire</p>

        <div className="gold-display glass-panel">
          <span className="gold-icon"><i className="ph-fill ph-coin" /></span>
          <span className="gold-amount">{displayGold}</span>
          <span className="gold-label">Gold disponibili</span>
        </div>

        <div className="packs-grid">
          {PACKS.map((pack) => (
            <PackSelectCard
              key={pack.id}
              pack={pack}
              gold={game.gold}
              isFreeAvailable={pack.isFree && isFreeAvailable}
              cooldownRemaining={cooldownRemaining}
              giftedCount={game.freePacks[pack.id] || 0}
              onOpen={handleOpen}
              submitting={submitting}
            />
          ))}
        </div>

        {notice && (
          <div className="pack-overlay">
            <div className="pack-modal glass-panel">
              <div className="pack-modal-icon"><i className="ph-fill ph-warning-circle" /></div>
              <h3>Gold insufficienti!</h3>
              <p>{notice}</p>
              <p className="text-muted">Completa missioni e vendi carte nel mercato per guadagnare gold!</p>
              <button className="btn btn-primary" onClick={() => setNotice(null)}>Chiudi</button>
            </div>
          </div>
        )}
      </section>
    );
  }

  const icon = PACK_ICON[selectedPack?.id] || 'ph-gift';
  const boxImage = PACK_IMAGE[selectedPack?.id];
  const boxGradient = PACK_GRADIENT[selectedPack?.id];
  const currentCard = cards[revealIndex];
  const isLastCard = revealIndex >= cards.length - 1;

  const halfShift = dragProgress * 160;
  const halfRotate = dragProgress * 30;
  const liveDragStyle = (side) => ({
    transform: `translateX(${side === 'left' ? '-' : ''}${halfShift}px) rotate(${side === 'left' ? '-' : ''}${halfRotate}deg)`,
    opacity: 1 - dragProgress * 0.25,
    transition: dragging ? 'none' : 'transform 0.35s ease, opacity 0.35s ease',
    background: boxImage ? undefined : boxGradient
  });

  return (
    <section className="pack-opening-page">
      <h2 className="section-title text-gradient">Apertura Pacchetto</h2>

      {phase === 'opening' && (
        <div className="pack-tear-stage">
          <div
            className={`pack-tear ${!dragging && !torn ? 'pack-tear-idle' : ''}`}
            onPointerDown={handleTearPointerDown}
            onPointerMove={handleTearPointerMove}
            onPointerUp={handleTearPointerUp}
            onPointerCancel={handleTearPointerUp}
          >
            <div
              className={`pack-tear-half pack-tear-half-left ${torn ? 'pack-tear-half-done' : ''}`}
              style={torn ? undefined : liveDragStyle('left')}
            >
              {boxImage ? <img className="pack-tear-img" src={boxImage} alt="" style={{ objectPosition: 'left center' }} draggable={false} /> : <i className={`ph-fill ${icon} pack-tear-icon`} />}
            </div>
            <div
              className={`pack-tear-half pack-tear-half-right ${torn ? 'pack-tear-half-done' : ''}`}
              style={torn ? undefined : liveDragStyle('right')}
            >
              {boxImage && <img className="pack-tear-img" src={boxImage} alt="" style={{ objectPosition: 'right center' }} draggable={false} />}
            </div>
            <div className={`pack-tear-flash ${torn ? 'pack-tear-flash-burst' : ''}`} style={torn ? undefined : { opacity: dragProgress * 0.9 }} />
          </div>
          <p className="pack-opening-text pack-tear-hint">
            {torn ? <><i className="ph-fill ph-sparkle" /> Le carte stanno per essere rivelate...</> : <><i className="ph-fill ph-arrows-left-right" /> Trascina per aprire il pacchetto!</>}
          </p>
        </div>
      )}

      {phase === 'reveal' && currentCard && (
        <div className="pack-reveal-solo">
          <p className="pack-reveal-progress">Carta {revealIndex + 1} di {cards.length}</p>
          <div className="pack-reveal-solo-card" onClick={advanceReveal} key={revealIndex}>
            <RevealCard card={currentCard} size="hero" />
          </div>
          <button className="btn btn-primary pack-reveal-next" onClick={advanceReveal}>
            {isLastCard ? <><i className="ph-fill ph-check-circle" /> Vedi il Riepilogo</> : <><i className="ph-fill ph-arrow-right" /> Prossima Carta</>}
          </button>
        </div>
      )}

      {phase === 'summary' && (
        <>
          <p className="pack-opening-text"><i className="ph-fill ph-vinyl-record" /> Ecco le tue nuove carte!</p>
          <div className="pack-reveal-grid">
            {cards.map((card, i) => (
              <div className="pack-reveal-slot pack-reveal-flip" key={`${card.id}-${i}`}>
                <CardTile card={card} onClick={() => setInspectedCard(card)} />
              </div>
            ))}
          </div>
          <div className="pack-summary-actions">
            <button className="btn btn-primary" onClick={resetToSelect}><i className="ph-fill ph-gift" /> Apri un Altro</button>
            <button className="btn btn-secondary" onClick={() => navigate('/collection')}><i className="ph-fill ph-cards" /> Vai alla Collezione</button>
          </div>
        </>
      )}

      {inspectedCard && (
        <div className="pack-overlay" onClick={() => setInspectedCard(null)}>
          <div className="pack-inspect-modal" onClick={(e) => e.stopPropagation()}>
            <button className="btn btn-secondary pack-inspect-close" onClick={() => setInspectedCard(null)}>
              <i className="ph-fill ph-arrow-left" /> Torna al Riepilogo
            </button>
            <CardHero card={inspectedCard} />
          </div>
        </div>
      )}
    </section>
  );
}
