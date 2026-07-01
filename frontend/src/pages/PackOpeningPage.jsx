import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../hooks/useGame.js';
import { useSound } from '../hooks/useSound.js';
import { PACKS } from '../data/packs.js';
import { RARITIES, getRarityColor, getRarityName, getStars, resolveCardImage } from '../utils/cardUtils.js';
import { formatDuration } from '../hooks/useCountdown.js';

const PACK_ICON = { 'pack-base': 'ph-gift', 'pack-deluxe': 'ph-diamond', 'pack-premium': 'ph-crown' };
const PACK_GRADIENT = {
  'pack-base': 'linear-gradient(135deg, var(--neon-purple), var(--neon-magenta))',
  'pack-deluxe': 'linear-gradient(135deg, var(--neon-blue), var(--neon-cyan))',
  'pack-premium': 'linear-gradient(135deg, #FFD700, #FFA500)'
};

function RarityLadder() {
  return (
    <div className="pack-card-rarity-list">
      {Object.entries(RARITIES).map(([key, data]) => (
        <span key={key} style={{ color: data.color }}>{data.name.toUpperCase()}</span>
      ))}
    </div>
  );
}

function PackSelectCard({ pack, gold, isFreeAvailable, cooldownRemaining, giftedCount, onOpen }) {
  const canAffordPaid = gold >= pack.price;
  let priceBadge;
  if (pack.isFree) {
    priceBadge = isFreeAvailable
      ? <span className="pack-card-price-badge pack-card-price-free"><i className="ph-fill ph-sparkle" /> Gratis</span>
      : <span className="pack-card-price-badge"><i className="ph-fill ph-hourglass" /> {formatDuration(cooldownRemaining).slice(0, 5)}</span>;
  } else {
    priceBadge = <span className="pack-card-price-badge"><i className="ph-fill ph-coin" /> {pack.price}</span>;
  }

  return (
    <div className="pack-card glass-panel">
      <div className="pack-card-header" style={{ background: PACK_GRADIENT[pack.id] }}>
        <span className="pack-card-zigzag" />
        <span className="pack-card-brand"><i className="ph-fill ph-lightning" /> VinylLegends</span>
        <span className="pack-card-count">{pack.cardCount} carte</span>
        <span className="pack-icon"><i className={`ph-fill ${PACK_ICON[pack.id] || 'ph-gift'}`} /></span>
        <h3 className="pack-card-name">{pack.name}</h3>
        {priceBadge}
        {giftedCount > 0 && <span className="pack-card-price-badge pack-card-price-free"><i className="ph-fill ph-gift" /> x{giftedCount} Regalati</span>}
      </div>
      <div className="pack-card-body">
        <p className="pack-card-desc">{pack.description}</p>
        <RarityLadder />
        <div className="pack-card-actions">
          {giftedCount > 0 && (
            <button className="btn btn-primary" onClick={() => onOpen(pack.id, 'gift')}>
              <i className="ph-fill ph-gift" /> Apri Regalo (x{giftedCount})
            </button>
          )}
          {pack.isFree && (
            isFreeAvailable
              ? <button className="btn btn-primary" onClick={() => onOpen(pack.id, 'free')}><i className="ph-fill ph-sparkle" /> Apri Gratis</button>
              : <button className="btn btn-secondary" disabled><i className="ph-fill ph-hourglass" /> Gratis tra {formatDuration(cooldownRemaining).slice(0, 5)}</button>
          )}
          <button
            className={`btn ${canAffordPaid ? (pack.id === 'pack-premium' ? 'btn-gold' : 'btn-primary') : 'btn-secondary'}`}
            onClick={() => onOpen(pack.id, 'paid')}
          >
            <i className="ph-fill ph-coin" /> {pack.isFree ? `Compra (${pack.price})` : `Apri Pacchetto (${pack.price})`}
          </button>
        </div>
        <div className="pack-card-barcode" />
        <span className="pack-card-barcode-text">VDX-{pack.id.replace('pack-', '').toUpperCase().padEnd(3, 'X')}-{pack.cardCount}{String(pack.price).padStart(3, '0')}</span>
      </div>
    </div>
  );
}

function RevealCard({ card }) {
  const color = getRarityColor(card.rarity);
  const rarityClass = `card-rarity-${card.rarity}`;

  if (card.fullImage) {
    return (
      <div className={`pack-reveal-card ${rarityClass} pack-reveal-flip`} style={{ overflow: 'hidden', borderRadius: 12, position: 'relative' }}>
        <img src={resolveCardImage(card)} alt={card.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }} />
        <span className="pack-reveal-badge" style={{ background: color, position: 'absolute', top: 8, left: 8, zIndex: 2, fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4 }}>{getRarityName(card.rarity)}</span>
      </div>
    );
  }

  return (
    <div className={`pack-reveal-card ${rarityClass} pack-reveal-flip`}>
      <div className="pack-reveal-card-inner">
        <div className="pack-reveal-art"><img src={resolveCardImage(card)} alt={card.name} /></div>
        <div className="pack-reveal-info">
          <span className="pack-reveal-badge" style={{ background: color }}>{getRarityName(card.rarity)}</span>
          <span className="pack-reveal-name">{card.name}</span>
          <span className="pack-reveal-class">{card.artistClass}</span>
          <span className="pack-reveal-stars">
            {Array.from({ length: 5 }, (_, i) => (
              <i key={i} className={i < getStars(card.rarity) ? 'ph-fill ph-star' : 'ph ph-star'} style={{ color: i < getStars(card.rarity) ? color : '#333' }} />
            ))}
          </span>
        </div>
      </div>
      {card.rarity === 'legendary' && (
        <>
          {Array.from({ length: 6 }, (_, i) => (
            <span
              key={i}
              className="pack-sparkle"
              style={{
                left: `${10 + ((i * 37) % 80)}%`,
                top: `${10 + ((i * 53) % 60)}%`,
                animationDelay: `${(i % 4) * 0.25}s`,
                fontSize: `${0.6 + (i % 3) * 0.2}rem`
              }}
            >
              <i className={`ph-fill ${['ph-sparkle', 'ph-star', 'ph-confetti'][i % 3]}`} />
            </span>
          ))}
        </>
      )}
    </div>
  );
}

export default function PackOpeningPage() {
  const game = useGame();
  const { sound } = useSound();
  const navigate = useNavigate();

  const [phase, setPhase] = useState('select');
  const [selectedPack, setSelectedPack] = useState(null);
  const [cards, setCards] = useState([]);
  const [revealedCount, setRevealedCount] = useState(0);
  const [boxOpen, setBoxOpen] = useState(false);
  const [notice, setNotice] = useState(null);

  const basePack = PACKS.find((p) => p.isFree);
  const cooldownRemaining = game.getFreeCooldownRemaining(basePack);
  const isFreeAvailable = game.isFreeAvailable(basePack);

  useEffect(() => {
    if (phase !== 'opening') return undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset intenzionale all'ingresso nella fase 'opening'
    setBoxOpen(false);
    const t1 = setTimeout(() => { setBoxOpen(true); sound.packOpen(); }, 300);
    const t2 = setTimeout(() => setPhase('reveal'), 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (phase !== 'reveal') return undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset intenzionale all'ingresso nella fase 'reveal'
    setRevealedCount(0);
    const timers = cards.map((card, i) => setTimeout(() => {
      setRevealedCount((n) => Math.max(n, i + 1));
      sound.cardReveal(card.rarity);
      if (i === cards.length - 1) {
        setTimeout(() => setPhase('summary'), 600);
      }
    }, i * 500 + 200));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, cards]);

  async function handleOpen(packId, mode) {
    const pack = PACKS.find((p) => p.id === packId);
    if (mode === 'paid' && game.gold < pack.price) {
      sound.error();
      setNotice('Non hai abbastanza gold per questo pacchetto.');
      setTimeout(() => setNotice(null), 3000);
      return;
    }
    const res = await game.openPack(packId, mode);
    if (res.error) {
      if (res.error === 'insufficient_gold') {
        sound.error();
        setNotice('Non hai abbastanza gold per questo pacchetto.');
        setTimeout(() => setNotice(null), 3000);
      }
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
    setRevealedCount(0);
  }

  if (phase === 'select') {
    return (
      <section className="packs-page">
        <h2 className="section-title text-gradient"><i className="ph-fill ph-gift" /> Apri un Pacchetto</h2>
        <p className="text-center packs-subtitle">Scegli il pacchetto che vuoi aprire</p>

        <div className="gold-display glass-panel">
          <span className="gold-icon"><i className="ph-fill ph-coin" /></span>
          <span className="gold-amount">{game.gold}</span>
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

  return (
    <section className="pack-opening-page">
      <h2 className="section-title text-gradient">Apertura Pacchetto</h2>
      <div className="pack-opening-animation">
        <div className={`pack-box ${boxOpen ? 'pack-box-open' : ''}`}>
          <div className="pack-box-inner">
            <div className="pack-box-front">
              <span className="pack-box-icon"><i className={`ph-fill ${icon}`} /></span>
              <span className="pack-box-label">{selectedPack?.name}</span>
            </div>
            <div className="pack-box-back">
              <span className="pack-box-sparkle"><i className="ph-fill ph-sparkle" /></span>
            </div>
          </div>
        </div>
        <p className="pack-opening-text">
          {phase === 'opening' && !boxOpen && 'Apertura in corso...'}
          {phase === 'opening' && boxOpen && <><i className="ph-fill ph-sparkle" /> Le carte stanno per essere rivelate...</>}
          {(phase === 'reveal' || phase === 'summary') && <><i className="ph-fill ph-vinyl-record" /> Ecco le tue nuove carte!</>}
        </p>
      </div>

      {(phase === 'reveal' || phase === 'summary') && (
        <div className="pack-reveal-grid">
          {cards.map((card, i) => (
            <div className="pack-reveal-slot" key={`${card.id}-${i}`}>
              {i < revealedCount ? (
                <RevealCard card={card} />
              ) : (
                <div className="pack-reveal-card pack-reveal-placeholder">
                  <div className="pack-reveal-card-inner">
                    <div className="pack-reveal-front"><i className="ph ph-question" /></div>
                    <div className="pack-reveal-back" />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {phase === 'summary' && (
        <div className="pack-summary-actions">
          <button className="btn btn-primary" onClick={resetToSelect}><i className="ph-fill ph-gift" /> Apri un Altro</button>
          <button className="btn btn-secondary" onClick={() => navigate('/collection')}><i className="ph-fill ph-cards" /> Vai alla Collezione</button>
        </div>
      )}
    </section>
  );
}
