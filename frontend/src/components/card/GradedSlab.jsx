import { getRarityColor, getSourceLabel, resolveCardImage } from '../../utils/cardUtils.js';
import { gradeInfo, gradeTone, gradedValue } from '../../utils/gradeUtils.js';

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
      <div className="slab-window">
        <img src={resolveCardImage(card)} alt={card.name} loading="lazy" />
      </div>
      <span className="slab-sheen" aria-hidden="true" />
    </figure>
  );
}
