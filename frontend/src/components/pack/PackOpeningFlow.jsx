import { lazy, useCallback, useEffect, useRef, useState } from 'react';
import { useSound } from '../../hooks/useSound.js';
import { findBestCardIndex, getRarityColor, getStars, RARITY_ORDER, resolveCardImage } from '../../utils/cardUtils.js';
import RevealSpark from '../common/RevealSpark.jsx';
import CardTile, { RarityBadge } from '../card/CardTile.jsx';
import CardHero from '../card/CardHero.jsx';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock.js';
import { useAccessibility } from '../../hooks/useAccessibility.js';
import RevealStage from '../fx/RevealStage.jsx';
import RarityAnnounce from '../fx/RarityAnnounce.jsx';
import PackVerdict from '../fx/PackVerdict.jsx';
import PackValue from '../fx/PackValue.jsx';
import ThreeGate from '../three/ThreeGate.jsx';
import { useThreeEnabled } from '../three/useThreeEnabled.js';
import { PACK_GRADIENT, PACK_ICON, PACK_IMAGE, PACK_TILT_RARITY } from './packArt.js';
import { m } from 'motion/react';
import StarBurst from '../phantom/StarBurst.jsx';
import { SNAP, usePhantomSkin } from '../battle/phantomMotion.js';
import '../../styles/pages/game-packs.css';

// Lo strappo 3D porta con se' three.js: si scarica solo quando si apre davvero un pacchetto.
const PackTear3D = lazy(() => import('../three/PackTear3D.jsx'));
// Stessa carta 3D del dettaglio, per ispezionare le carte dal riepilogo del pacchetto.
const Card3D = lazy(() => import('../three/Card3D.jsx'));

// Attesa tra strappo e rivelazione. Con la scena 3D c'e' un'esplosione da guardare, e con una
// leggendaria anche il vinile d'oro che vola verso lo schermo.
const TEAR_TO_REVEAL_MS = { css: 550, three: 1200, threeLegendary: 1800 };

// Trascinamento orizzontale (in px) necessario per completare lo strappo del pacchetto.
const TEAR_DRAG_MAX = 120;
const TEAR_COMPLETE_THRESHOLD = 0.5;

/** Rarita' piu' alta del pacchetto, anche se sotto la soglia di "carta migliore". */
function topRarity(cards) {
  return cards.reduce(
    (best, card) => ((RARITY_ORDER[card.rarity] || 0) > (RARITY_ORDER[best] || 0) ? card.rarity : best),
    'common'
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
      <div className={`pack-reveal-card ${rarityClass} ${sizeClass} pack-reveal-flip${card.foil ? ' is-foil' : ''}`} style={{ overflow: 'hidden', borderRadius: 12, position: 'relative' }}>
        <img src={resolveCardImage(card)} alt={card.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }} />
        {card.foil > 0 && <span className="foil-badge">Olografica</span>}
        <RevealSpark color={spark.color || color} count={spark.count} radius={spark.radius} />
      </div>
    );
  }

  return (
    <div className={`pack-reveal-card ${rarityClass} ${sizeClass} pack-reveal-flip${card.foil ? ' is-foil' : ''}`}>
      {card.foil > 0 && <span className="foil-badge">Olografica</span>}
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

/**
 * Apertura di un pacchetto gia' comprato: strappo (in 3D se il dispositivo lo regge), una carta
 * gigante alla volta e il riepilogo con il verdetto, il valore e l'ispezione in 3D.
 *
 * La usano la pagina Pacchetti e l'hotel: le carte arrivano gia' dal server, qui c'e' solo lo
 * spettacolo. Per un altro pacchetto il genitore rimonta il componente con una key nuova.
 *
 * @param actions pulsanti del riepilogo: [{ label, icon, onClick, primary }]
 * @param onSummary chiamato una volta, quando si arriva al riepilogo (tutte le carte viste)
 */
export default function PackOpeningFlow({ packId, cards, actions = [], onSummary, phantom: phantomProp }) {
  const { sound } = useSound();
  const threeEnabled = useThreeEnabled();
  // Gli scatti in stile Phantom solo fuori dall'hotel: li' l'apertura resta quella di sempre.
  // Nell'hotel lo stile Phantom e' spento, tranne nell'apertura dei pacchetti (HotelPackOpening lo chiede).
  const phantomPage = usePhantomSkin();
  const phantom = phantomProp ?? phantomPage;
  // Modalita' sicura (fotosensibilita'): niente lampo bianco allo strappo ne' scheggia rossa che
  // attraversa la carta. La stella dietro le epiche e le leggendarie resta.
  const { safe } = useAccessibility();

  const [phase, setPhase] = useState('opening');
  const [revealIndex, setRevealIndex] = useState(0);
  const [advancing, setAdvancing] = useState(false);
  const [inspectedCard, setInspectedCard] = useState(null);
  // Sul modal di ispezione, blocca lo scroll di sfondo: altrimenti trascinare il dito sulla
  // carta per l'effetto tilt scorre erroneamente il riepilogo sottostante.
  useBodyScrollLock(!!inspectedCard);

  // Strappo del pacchetto: l'utente deve trascinare fisicamente le due metà (niente auto-apertura).
  const [dragProgress, setDragProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [torn, setTorn] = useState(false);
  const dragStartX = useRef(0);

  // I setTimeout aggiornano stato dopo un delay: se il componente viene smontato prima che
  // scattino, andrebbero a scrivere su un componente smontato. Si ripuliscono tutti allo smontaggio.
  const pendingTimers = useRef(new Set());
  const trackedTimeout = useCallback((fn, ms) => {
    const id = setTimeout(() => { pendingTimers.current.delete(id); fn(); }, ms);
    pendingTimers.current.add(id);
    return id;
  }, []);
  useEffect(() => () => { pendingTimers.current.forEach(clearTimeout); }, []);

  // Fase 'reveal': una carta gigante alla volta (stile Pokémon TCG Pocket), avanzamento a tocco.
  useEffect(() => {
    if (phase !== 'reveal') return undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset intenzionale all'ingresso nella fase 'reveal'
    setRevealIndex(0);
    setAdvancing(false);
    if (cards[0]) sound.cardReveal(cards[0].rarity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Arrivati al riepilogo: nell'hotel la stanza vede quanto vale il pacchetto.
  const summaryCallback = useRef(onSummary);
  useEffect(() => { summaryCallback.current = onSummary; }, [onSummary]);
  useEffect(() => {
    if (phase === 'summary') summaryCallback.current?.();
  }, [phase]);

  function handleTearPointerDown(e) {
    if (torn) return;
    dragStartX.current = e.clientX;
    setDragging(true);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* puntatore del controller */ }
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
    const delay = !threeEnabled
      ? TEAR_TO_REVEAL_MS.css
      : topRarity(cards) === 'legendary' ? TEAR_TO_REVEAL_MS.threeLegendary : TEAR_TO_REVEAL_MS.three;
    trackedTimeout(() => setPhase('reveal'), delay);
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

  const icon = PACK_ICON[packId] || 'ph-gift';
  const boxImage = PACK_IMAGE[packId];
  const boxGradient = PACK_GRADIENT[packId];
  const currentCard = cards[revealIndex];
  const isLastCard = revealIndex >= cards.length - 1;
  const bestCardIndex = findBestCardIndex(cards);

  const tearHandlers = {
    onPointerDown: handleTearPointerDown,
    onPointerMove: handleTearPointerMove,
    onPointerUp: handleTearPointerUp,
    onPointerCancel: handleTearPointerUp
  };

  const halfShift = dragProgress * 160;
  const halfRotate = dragProgress * 30;
  const liveDragStyle = (side) => ({
    transform: `translateX(${side === 'left' ? '-' : ''}${halfShift}px) rotate(${side === 'left' ? '-' : ''}${halfRotate}deg)`,
    opacity: 1 - dragProgress * 0.25,
    transition: dragging ? 'none' : 'transform 0.35s ease, opacity 0.35s ease',
    background: boxImage ? undefined : boxGradient
  });

  return (
    <>
      {phase === 'opening' && (
        <div className="pack-tear-stage">
          <ThreeGate fallback={
            <div
              className={`pack-tear ${!dragging && !torn ? 'pack-tear-idle' : ''}`}
              {...tearHandlers}
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
              <div className={`pack-tear-flash ${torn && !safe ? 'pack-tear-flash-burst' : ''}`} style={safe ? { opacity: torn ? 0 : dragProgress * 0.4, transition: torn ? 'opacity 0.6s ease-out' : undefined } : (torn ? undefined : { opacity: dragProgress * 0.9 })} />
            </div>
          }>
            <PackTear3D
              handlers={tearHandlers}
              packImage={boxImage}
              packRarity={PACK_TILT_RARITY[packId] || 'rare'}
              bestRarity={topRarity(cards)}
              dragProgress={dragProgress}
              dragging={dragging}
              torn={torn}
            />
          </ThreeGate>
          {phantom && torn && (
            <m.span
              className="p5-tear-slash"
              aria-hidden="true"
              initial={{ x: '-130%', opacity: 1 }}
              animate={{ x: '130%', opacity: 1, transitionEnd: { visibility: 'hidden' } }}
              transition={{ duration: 0.34, ease: [0.7, 0, 0.3, 1] }}
            />
          )}
          <p className="pack-opening-text pack-tear-hint">
            {torn ? <><i className="ph-fill ph-sparkle" /> Le carte stanno per essere rivelate...</> : <><i className="ph-fill ph-arrows-left-right" /> Trascina per aprire il pacchetto!</>}
          </p>
        </div>
      )}

      {phase === 'reveal' && currentCard && (
        <div className="pack-reveal-solo">
          <p className="pack-reveal-progress">Carta {revealIndex + 1} di {cards.length}</p>

          {/* Un pallino per carta, colorato con la rarita' di quelle gia' viste: mostra
              a colpo d'occhio com'e' andato il pacchetto senza aspettare il riepilogo. */}
          <div className="reveal-dots" aria-hidden="true">
            {cards.map((card, i) => (
              <span
                key={`${card.id}-${i}`}
                className={`reveal-dot${i < revealIndex ? ' seen' : ''}${i === revealIndex ? ' current' : ''}`}
                style={i <= revealIndex ? { '--dot-color': getRarityColor(card.rarity) } : undefined}
              />
            ))}
          </div>

          {/* key sull'indice: rimonta il palcoscenico a ogni carta, cosi' lampo, raggi e
              annuncio ripartono da capo invece di restare fermi dalla prima rivelazione. */}
          <div className="pack-reveal-solo-card" onClick={advanceReveal} key={revealIndex}>
            {phantom && (
              <>
                {/* Scheggia magenta che attraversa la carta mentre arriva, e una stella dietro le
                    epiche e le leggendarie: il colpo di scena prima ancora di leggerla. */}
                {!safe && <m.span
                  className="p5-reveal-slash"
                  aria-hidden="true"
                  initial={{ x: '-140%' }}
                  animate={{ x: '140%', transitionEnd: { visibility: 'hidden' } }}
                  transition={{ duration: 0.3, ease: [0.7, 0, 0.3, 1] }}
                />}
                {(currentCard.rarity === 'epic' || currentCard.rarity === 'legendary') && (
                  <m.span
                    className="p5-reveal-star"
                    aria-hidden="true"
                    initial={{ scale: 0, rotate: -60 }}
                    animate={{ scale: 1, rotate: -12 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 15, delay: 0.12 }}
                  >
                    <StarBurst size={170} fill={currentCard.rarity === 'legendary' ? 'var(--neon-gold)' : 'var(--neon-purple)'} />
                  </m.span>
                )}
              </>
            )}
            <m.div
              className="pack-reveal-solo-in"
              initial={phantom ? { x: 120, rotate: 8, opacity: 0 } : false}
              animate={{ x: 0, rotate: 0, opacity: 1 }}
              transition={SNAP}
            >
              <RevealStage rarity={currentCard.rarity}>
                <RevealCard card={currentCard} size="hero" />
              </RevealStage>
              <RarityAnnounce rarity={currentCard.rarity} />
            </m.div>
          </div>

          <button className="btn btn-primary pack-reveal-next" onClick={advanceReveal}>
            {isLastCard ? <><i className="ph-fill ph-check-circle" /> Vedi il Riepilogo</> : <><i className="ph-fill ph-arrow-right" /> Prossima Carta</>}
          </button>
        </div>
      )}

      {phase === 'summary' && (
        <>
          <p className="pack-opening-text"><i className="ph-fill ph-vinyl-record" /> Ecco le tue nuove carte!</p>
          <PackVerdict cards={cards} />
          <PackValue cards={cards} />
          <div className="pack-reveal-grid">
            {cards.map((card, i) => (
              <div
                className={`pack-reveal-slot pack-reveal-flip${i === bestCardIndex ? ' pack-reveal-slot-best' : ''}`}
                style={{ '--i': i, ...(i === bestCardIndex ? { '--rarity-color': getRarityColor(card.rarity) } : null) }}
                key={`${card.id}-${i}`}
              >
                <CardTile card={card} onClick={() => setInspectedCard(card)} />
              </div>
            ))}
          </div>
          <div className="pack-summary-actions">
            {actions.map((action) => (
              <button key={action.label} className={`btn ${action.primary ? 'btn-primary' : 'btn-secondary'}`} onClick={action.onClick}>
                <i className={`ph-fill ${action.icon}`} /> {action.label}
              </button>
            ))}
          </div>
        </>
      )}

      {inspectedCard && (
        <div className="pack-overlay" onClick={() => setInspectedCard(null)}>
          <div className="pack-inspect-modal" onClick={(e) => e.stopPropagation()}>
            <button className="btn btn-secondary pack-inspect-close" onClick={() => setInspectedCard(null)}>
              <i className="ph-fill ph-arrow-left" /> Torna al Riepilogo
            </button>
            <ThreeGate fallback={<CardHero card={inspectedCard} />}>
              <Card3D card={inspectedCard} />
              <CardHero card={inspectedCard} hideArt />
            </ThreeGate>
          </div>
        </div>
      )}
    </>
  );
}
