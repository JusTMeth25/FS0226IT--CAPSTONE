import { useMemo, useState } from 'react';
import { useGame } from '../../hooks/useGame.js';
import { RARITY_ORDER, getRarityColor, resolveCardImage } from '../../utils/cardUtils.js';
import { dedupeCollection } from '../../utils/collectionUtils.js';

/**
 * Scelta della carta da esporre in una vetrina o in un quadro. Le carte piu' rare in cima:
 * sono quelle che si vogliono mostrare. Il server controlla comunque di possederla.
 */
export default function CardPicker({ current, onPick, onClear, onClose }) {
  const { collection } = useGame();
  const [query, setQuery] = useState('');

  const cards = useMemo(() => {
    const q = query.trim().toLowerCase();
    return dedupeCollection(collection)
      .filter((c) => !q || c.name.toLowerCase().includes(q))
      .sort((a, b) => (RARITY_ORDER[b.rarity] || 0) - (RARITY_ORDER[a.rarity] || 0))
      .slice(0, 120);
  }, [collection, query]);

  return (
    <div className="hotel-panel hotel-card-picker" role="dialog" aria-label="Scegli una carta da esporre">
      <header className="hotel-panel-header">
        <h3><i className="ph-fill ph-cards" /> Scegli la carta</h3>
        <button type="button" className="hotel-panel-close" onClick={onClose} aria-label="Chiudi"><i className="ph ph-x" /></button>
      </header>
      <div className="hotel-card-picker-bar">
        <input className="hotel-chat-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cerca per nome…" aria-label="Cerca carta" />
        {current && (
          <button type="button" className="btn btn-secondary btn-small" onClick={onClear}>
            <i className="ph ph-x-circle" /> Togli
          </button>
        )}
      </div>
      <ul className="hotel-card-grid">
        {cards.length === 0 && <li className="hotel-room-empty">Nessuna carta trovata.</li>}
        {cards.map((card) => (
          <li key={card.id}>
            <button
              type="button"
              className={`hotel-card-thumb${current?.id === card.id ? ' selected' : ''}`}
              style={{ '--rarity-color': getRarityColor(card.rarity) }}
              onClick={() => onPick(card)}
              title={card.name}
            >
              <img src={resolveCardImage(card)} alt={card.name} loading="lazy" />
              <span>{card.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
