import { getRarityColor, getSourceLabel, resolveCardImage } from '../../utils/cardUtils.js';
import { gradeInfo, gradeTone, gradedValue } from '../../utils/gradeUtils.js';
import CardHoloFrame from './CardHoloFrame.jsx';
import HoloLayers from './HoloLayers.jsx';

/**
 * Cofanetto del perito, come quelli delle agenzie di gradazione vere: la carta sigillata in una
 * custodia trasparente, con l'etichetta in alto (nome, set, voto, giudizio, certificato e valore).
 * `size`: "large" nel dettaglio carta, "small" nelle griglie della collezione.
 */
export default function GradedSlab({ card, size = 'large', onClick }) {
  const info = gradeInfo(card.grade);
  const value = gradedValue(card);
  const year = card.gradedAt ? new Date(card.gradedAt).getFullYear() : new Date().getFullYear();
  const set = [card.setName || getSourceLabel(card.source), card.number ? `#${card.number}` : null].filter(Boolean).join(' ');
  return (
    <figure className={`graded-slab graded-slab-${size} tone-${gradeTone(card.grade)}`} style={{ '--rarity-color': getRarityColor(card.rarity) }}
      onClick={onClick} aria-label={`${card.name}, voto ${card.grade} ${info.label}`}>
      <div className="slab-label">
        <div className="slab-brand"><span>VinylDex</span> Grading</div>
        <div className="slab-label-body">
          <div className="slab-card-info">
            <strong>{card.name}</strong>
            {size === 'large' && <small>{set}</small>}
            <small>{year} · {info.label}</small>
          </div>
          <div className="slab-grade">
            <b>{card.grade}</b>
            <small>{info.label}</small>
          </div>
        </div>
        {size === 'large' && (
          <div className="slab-meta">
            <span>CERT {card.gradeCert || 'VDX'}</span>
            {value && <span>Valore stimato {value}</span>}
          </div>
        )}
      </div>
      {/* La carta nel cofanetto tiene gli stessi effetti di quando era sfusa: riflesso che segue il
          puntatore e, se olografica, l'arcobaleno che scorre. */}
      <CardHoloFrame rarity={card.rarity} maxTilt={size === 'large' ? 6 : 4}
        className={`slab-window card-rarity-${card.rarity}${card.foil > 0 ? ' is-foil' : ''}`}>
        <img src={resolveCardImage(card)} alt={card.name} loading="lazy" />
        <HoloLayers />
        {card.foil > 0 && <span className="slab-foil-chip">Olo</span>}
      </CardHoloFrame>
      <span className="slab-sheen" aria-hidden="true" />
    </figure>
  );
}
