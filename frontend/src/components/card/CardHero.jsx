import { getRarityCSSClass, getRarityColor, getRarityIcon, getRarityName, getTotalScore, resolveCardImage } from '../../utils/cardUtils.js';
import CardHoloFrame from './CardHoloFrame.jsx';

const STAT_DEFS = [
  { key: 'fans', label: 'Fans', icon: 'ph-users-three', color: 'var(--neon-purple)' },
  { key: 'style', label: 'Style', icon: 'ph-star', color: 'var(--neon-gold)' },
  { key: 'influence', label: 'Influence', icon: 'ph-megaphone', color: 'var(--neon-magenta)' },
  { key: 'energy', label: 'Energy', icon: 'ph-lightning', color: '#FF5252' }
];

/** Riflesso olografico + sparkle: stessi 3 layer sopra l'artwork, per entrambe le varianti di carta. */
function HoloLayers() {
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

/**
 * Vista di dettaglio "hero" di una carta: artwork a tutta larghezza, rarità,
 * citazione e statistiche. Usata da CardDetailPage e dal modal reveal.
 * L'artwork ha un effetto holo (tilt 3D + riflesso arcobaleno) che segue
 * il puntatore, più marcato per le rarità alte.
 *
 * Con `hideArt` l'artwork non viene mostrato: serve quando sopra c'e' gia' la carta 3D, per
 * non vedere la stessa immagine due volte. Restano citazione, tag e statistiche.
 */
export default function CardHero({ card, quantity = 1, hideArt = false }) {
  const rarityClass = getRarityCSSClass(card.rarity);

  if (card.fullImage) {
    if (hideArt) return null;
    return (
      <CardHoloFrame rarity={card.rarity} className={`card-hero card-hero-full ${rarityClass}`}>
        <img className="card-hero-art" src={resolveCardImage(card)} alt={card.name} />
        <HoloLayers />
        {quantity > 1 && <span className="card-hero-qty-badge">×{quantity}</span>}
      </CardHoloFrame>
    );
  }

  const color = getRarityColor(card.rarity);
  const total = getTotalScore(card);

  return (
    <div className={`card-hero ${rarityClass}`}>
      {!hideArt && (
        <CardHoloFrame rarity={card.rarity} className="card-hero-art-wrap">
          <img className="card-hero-art" src={resolveCardImage(card)} alt={card.name} />
          <div className="card-hero-scrim" />
          <HoloLayers />
          <span className="card-hero-rarity-badge" style={{ color, borderColor: color }}>
            {getRarityName(card.rarity).toUpperCase()} <img className="card-hero-rarity-icon" src={getRarityIcon(card.rarity)} alt="" />
          </span>
          {quantity > 1 && <span className="card-hero-qty-badge">×{quantity}</span>}
          <div className="card-hero-heading">
            <h2 className="card-hero-name">{card.name}</h2>
            {card.variant && card.variant !== card.name && <p className="card-hero-variant">{card.variant}</p>}
          </div>
        </CardHoloFrame>
      )}
      <div className="card-hero-body">
        {card.description && <p className="card-hero-quote">&quot;{card.description}&quot;</p>}
        <div className="card-hero-tags">
          <div className="card-hero-tag">
            <i className="ph-fill ph-identification-badge" />
            <div><span className="card-hero-tag-label">Classe</span><span className="card-hero-tag-value">{card.artistClass}</span></div>
          </div>
          {card.group && (
            <div className="card-hero-tag">
              <i className="ph-fill ph-users-three" />
              <div><span className="card-hero-tag-label">Gruppo</span><span className="card-hero-tag-value">{card.group}</span></div>
            </div>
          )}
        </div>
        <div className="card-hero-stats-grid">
          {STAT_DEFS.map((s) => (
            <div key={s.key} className="card-hero-stat" style={{ '--stat-color': s.color }}>
              <i className={`ph-fill ${s.icon}`} />
              <span className="card-hero-stat-value">{card.stats?.[s.key] || 0}</span>
              <span className="card-hero-stat-label">{s.label}</span>
            </div>
          ))}
          <div className="card-hero-stat card-hero-stat-total">
            <span className="card-hero-stat-value">{total}</span>
            <span className="card-hero-stat-label">Totale</span>
            <span className="card-hero-stat-sublabel">Somma Statistiche</span>
          </div>
        </div>
      </div>
    </div>
  );
}
