import { useMemo } from 'react';
import { RARITIES, SOURCE_LABELS, getSourceLabel } from '../../utils/cardUtils.js';

/** Barra dei filtri di `useCardFilters`. `compact` la stringe per i pannelli dell'hotel. */
export default function CardFilterBar({ items, getCard = (item) => item, filters, setFilter, reset, compact = false, count }) {
  const { sources, classes } = useMemo(() => {
    const src = new Set();
    const cls = new Set();
    (items || []).forEach((item) => {
      const card = getCard(item);
      if (card?.source) src.add(card.source);
      if (card?.artistClass) cls.add(card.artistClass);
    });
    return {
      sources: Object.keys(SOURCE_LABELS).filter((s) => src.has(s)),
      classes: [...cls].sort()
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);
  const active = filters.q || filters.cls || filters.rarity || filters.source;

  return (
    <div className={`card-filter-bar${compact ? ' compact' : ''}`}>
      <input className="filter-select card-filter-search" type="search" value={filters.q} onChange={(e) => setFilter('q', e.target.value)}
        placeholder="Cerca per nome…" aria-label="Cerca per nome" />
      {classes.length > 0 && (
        <select className="filter-select" value={filters.cls} onChange={(e) => setFilter('cls', e.target.value)} aria-label="Classe">
          <option value="">Tutte le classi</option>
          {classes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      )}
      <select className="filter-select" value={filters.rarity} onChange={(e) => setFilter('rarity', e.target.value)} aria-label="Rarità">
        <option value="">Tutte le rarità</option>
        {Object.entries(RARITIES).map(([key, r]) => <option key={key} value={key}>{r.name}</option>)}
      </select>
      {sources.length > 1 && (
        <select className="filter-select" value={filters.source} onChange={(e) => setFilter('source', e.target.value)} aria-label="Fonte">
          <option value="">Tutte le fonti</option>
          {sources.map((s) => <option key={s} value={s}>{getSourceLabel(s)}</option>)}
        </select>
      )}
      <select className="filter-select" value={filters.sort} onChange={(e) => setFilter('sort', e.target.value)} aria-label="Ordina per">
        <option value="date">Più recenti</option>
        <option value="name">Nome</option>
        <option value="rarity">Rarità</option>
        <option value="stats">Stats totali</option>
        <option value="price">Valore</option>
      </select>
      <button type="button" className="btn btn-secondary btn-small card-filter-dir" onClick={() => setFilter('dir', filters.dir === 'desc' ? 'asc' : 'desc')}
        title={filters.dir === 'desc' ? 'Decrescente' : 'Crescente'} aria-label={filters.dir === 'desc' ? 'Ordine decrescente' : 'Ordine crescente'}>
        <i className={`ph-fill ${filters.dir === 'desc' ? 'ph-sort-descending' : 'ph-sort-ascending'}`} />
      </button>
      {active && (
        <button type="button" className="btn btn-secondary btn-small" onClick={reset} title="Togli i filtri">
          <i className="ph ph-x" /> Filtri
        </button>
      )}
      {count !== undefined && <small className="card-filter-count">{count} carte</small>}
    </div>
  );
}
