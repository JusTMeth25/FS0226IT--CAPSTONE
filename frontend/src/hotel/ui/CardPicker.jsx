import { useState } from 'react';
import { useGame } from '../../hooks/useGame.js';
import { useCardFilters } from '../../hooks/useCardFilters.js';
import { dedupeCollection } from '../../utils/collectionUtils.js';
import { getRarityColor, getRarityName, getSourceLabel, resolveCardImage } from '../../utils/cardUtils.js';
import CardFilterBar from '../../components/card/CardFilterBar.jsx';

const VIEWS = [
  { key: 'big', icon: 'ph-squares-four', label: 'Carte grandi' },
  { key: 'small', icon: 'ph-grid-nine', label: 'Carte piccole' },
  { key: 'list', icon: 'ph-list', label: 'Elenco' }
];
const VIEW_KEY = 'vinyldex_picker_view';

function savedView() {
  try {
    return localStorage.getItem(VIEW_KEY) || 'big';
  } catch {
    return 'big';
  }
}

/**
 * Scelta della carta da esporre (vetrina, quadro, teca 3D) o da mostrare sopra la testa.
 * Stessi filtri della Collezione (nome, classe, rarita', fonte, ordine) e tre viste: carte
 * grandi, piccole o in elenco. Il server controlla comunque di possederla.
 */
export default function CardPicker({ current, onPick, onClear, onClose, title = 'Scegli la carta' }) {
  const { collection } = useGame();
  const owned = dedupeCollection(collection).filter((c) => (c.quantity ?? 1) > 0);
  const filter = useCardFilters(owned, undefined, { sort: 'rarity' });
  const [view, setView] = useState(savedView);
  const cards = filter.result.slice(0, 240);

  const changeView = (key) => {
    setView(key);
    try {
      localStorage.setItem(VIEW_KEY, key);
    } catch {
      // la vista si ricorda solo per questa visita
    }
  };

  return (
    <div className="hotel-panel hotel-card-picker" role="dialog" aria-label={title}>
      <header className="hotel-panel-header">
        <h3><i className="ph-fill ph-cards" /> {title}</h3>
        <button type="button" className="hotel-panel-close" onClick={onClose} aria-label="Chiudi"><i className="ph ph-x" /></button>
      </header>
      <CardFilterBar compact items={owned} {...filter} count={filter.result.length} />
      <div className="hotel-card-picker-bar">
        <div className="picker-views" role="group" aria-label="Vista">
          {VIEWS.map((v) => (
            <button key={v.key} type="button" className={`picker-view${view === v.key ? ' active' : ''}`} onClick={() => changeView(v.key)}
              title={v.label} aria-label={v.label} aria-pressed={view === v.key}>
              <i className={`ph-fill ${v.icon}`} />
            </button>
          ))}
        </div>
        {current && onClear && (
          <button type="button" className="btn btn-secondary btn-small" onClick={onClear}>
            <i className="ph ph-x-circle" /> Togli la carta
          </button>
        )}
      </div>
      <ul className={`hotel-card-grid view-${view}`}>
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
              <span className="thumb-name">{card.name}</span>
              {view === 'list' && (
                <small className="thumb-meta">
                  <span style={{ color: getRarityColor(card.rarity) }}>{getRarityName(card.rarity)}</span> · {getSourceLabel(card.source)}
                  {card.quantity > 1 ? ` · ×${card.quantity}` : ''}
                </small>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
