import { getRarityCSSClass, getRarityColor, getRarityIcon, getRarityName, getStars, resolveCardImage } from '../../utils/cardUtils.js';
import CardHoloFrame from './CardHoloFrame.jsx';

/** Icona piccola colorata (no testo): la rarità estesa resta disponibile via title/tooltip. */
export function RarityBadge({ rarity, style }) {
  return (
    <span className="card-rarity-badge" title={getRarityName(rarity)} style={style}>
      <i className={`ph-fill ph-${getRarityIcon(rarity)}`} />
    </span>
  );
}

function Stars({ count, color }) {
  return (
    <span className="card-stars">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ color: i < count ? color : '#333' }}>
          <i className={i < count ? 'ph-fill ph-star' : 'ph ph-star'} />
        </span>
      ))}
    </span>
  );
}

/** Riflesso olografico + sparkle (solo rarità alte, gestito via CSS) che segue il puntatore. */
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
 * Mini-card riusata in Home / Collection / Album.
 * `unknown`: mostra il placeholder "???" per carte non ancora possedute (Album).
 */
export default function CardTile({ card, quantity, unknown = false, onClick }) {
  const rarityClass = getRarityCSSClass(card.rarity);
  const color = getRarityColor(card.rarity);

  if (unknown) {
    return (
      <div className="card card-unknown" style={{ opacity: 0.6, filter: 'grayscale(0.7)' }} onClick={onClick}>
        <RarityBadge rarity={card.rarity} style={{ background: `${color}44`, color }} />
        <div className="card-artwork">
          <div style={{ fontSize: '2.5rem', opacity: 0.3, filter: 'blur(1px)' }}><i className="ph ph-question" /></div>
        </div>
        <div className="card-info">
          <div className="card-name" style={{ color }}>???</div>
          <div className="card-class" style={{ color: '#666' }}>{card.artistClass}</div>
          <Stars count={getStars(card.rarity)} color="#333" />
        </div>
      </div>
    );
  }

  if (card.fullImage) {
    return (
      <CardHoloFrame
        rarity={card.rarity}
        maxTilt={8}
        className={`card ${rarityClass} card-full-image`}
        title={`${card.name} - ${getRarityName(card.rarity)}`}
        onClick={onClick}
      >
        <img src={resolveCardImage(card)} alt={card.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }} />
        <HoloLayers />
        <RarityBadge rarity={card.rarity} />
        {quantity > 1 && <span className="card-quantity-badge" style={{ position: 'absolute', bottom: 8, right: 8, zIndex: 2 }}>×{quantity}</span>}
      </CardHoloFrame>
    );
  }

  return (
    <CardHoloFrame
      rarity={card.rarity}
      maxTilt={8}
      className={`card ${rarityClass}`}
      title={`${card.name} - ${getRarityName(card.rarity)}`}
      onClick={onClick}
    >
      <RarityBadge rarity={card.rarity} />
      {quantity > 1 && <span className="card-quantity-badge">×{quantity}</span>}
      <div className="card-artwork">
        <img src={resolveCardImage(card)} alt={card.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <div className="card-info">
        <div className="card-name">{card.name}</div>
        <div className="card-class">{card.artistClass}</div>
        <Stars count={getStars(card.rarity)} color={color} />
      </div>
      <HoloLayers />
    </CardHoloFrame>
  );
}
