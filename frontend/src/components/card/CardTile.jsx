import { getRarityCSSClass, getRarityColor, getRarityIcon, getRarityName, getStars, resolveCardImage } from '../../utils/cardUtils.js';
import CardHoloFrame from './CardHoloFrame.jsx';
import GradedSlab from './GradedSlab.jsx';

/** Gemma SVG piccola (no testo): la rarità estesa resta disponibile via title/tooltip. */
export function RarityBadge({ rarity, style }) {
  return (
    <span className="card-rarity-badge" title={getRarityName(rarity)} style={style}>
      <img className="card-rarity-icon" src={getRarityIcon(rarity)} alt="" />
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

/** Mini-card riusata in Home / Collection / Battaglia. */
export default function CardTile({ card, quantity, onClick }) {
  const rarityClass = getRarityCSSClass(card.rarity);
  const color = getRarityColor(card.rarity);

  // Copia gradata dal perito: sta nel cofanetto, con l'etichetta e il voto.
  if (card.grade > 0) {
    return (
      <div className="card-tile-slab" title={`${card.name} - voto ${card.grade}`}>
        <GradedSlab card={card} size="small" onClick={onClick} />
        {quantity > 1 && <span className="card-quantity-badge">×{quantity}</span>}
      </div>
    );
  }

  if (card.fullImage) {
    return (
      <CardHoloFrame
        rarity={card.rarity}
        maxTilt={8}
        className={`card ${rarityClass} card-full-image${card.foil > 0 ? ' is-foil' : ''}`}
        title={`${card.name} - ${getRarityName(card.rarity)}`}
        onClick={onClick}
      >
        <img src={resolveCardImage(card)} alt={card.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }} />
        <HoloLayers />
        {quantity > 1 && <span className="card-quantity-badge" style={{ position: 'absolute', bottom: 8, right: 8, zIndex: 2 }}>×{quantity}</span>}
        {card.foil > 0 && <span className="foil-badge" title={`${card.foil} copie olografiche`}>Olo{card.foil > 1 ? ` ×${card.foil}` : ''}</span>}
      </CardHoloFrame>
    );
  }

  return (
    <CardHoloFrame
      rarity={card.rarity}
      maxTilt={8}
      className={`card ${rarityClass}${card.foil > 0 ? ' is-foil' : ''}`}
      title={`${card.name} - ${getRarityName(card.rarity)}`}
      onClick={onClick}
    >
      <RarityBadge rarity={card.rarity} />
      {quantity > 1 && <span className="card-quantity-badge">×{quantity}</span>}
      {card.foil > 0 && <span className="foil-badge" title={`${card.foil} copie olografiche`}>Olo{card.foil > 1 ? ` ×${card.foil}` : ''}</span>}
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
