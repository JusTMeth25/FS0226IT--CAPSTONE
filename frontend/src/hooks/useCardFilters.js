import { useMemo, useState } from 'react';
import { RARITY_ORDER, getTotalScore } from '../utils/cardUtils.js';

const EMPTY = { q: '', cls: '', rarity: '', source: '', sort: 'date', dir: 'desc' };

const SORTS = {
  date: (a, b) => new Date(b.obtainedAt || 0) - new Date(a.obtainedAt || 0),
  name: (a, b) => a.name.localeCompare(b.name),
  rarity: (a, b) => (RARITY_ORDER[b.rarity] || 0) - (RARITY_ORDER[a.rarity] || 0),
  stats: (a, b) => getTotalScore(b) - getTotalScore(a),
  price: (a, b) => (b.marketPrice || 0) - (a.marketPrice || 0)
};

/**
 * Gli stessi filtri della Collezione (nome, classe, rarita', fonte, ordine) per ogni elenco di
 * carte da scegliere: mostra, banchetto, vendita al negozio, mercato.
 * `getCard` estrae la carta dall'elemento (per esempio un'offerta che contiene la carta).
 */
export function useCardFilters(items, getCard = (item) => item, initial = {}) {
  const [filters, setFilters] = useState(() => ({ ...EMPTY, ...initial }));
  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const reset = () => setFilters({ ...EMPTY, ...initial });

  const result = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    const list = (items || []).filter((item) => {
      const card = getCard(item);
      return card
        && (!q || card.name.toLowerCase().includes(q))
        && (!filters.cls || card.artistClass === filters.cls)
        && (!filters.rarity || card.rarity === filters.rarity)
        && (!filters.source || card.source === filters.source);
    });
    const compare = SORTS[filters.sort] || SORTS.date;
    list.sort((a, b) => {
      const cmp = compare(getCard(a), getCard(b)) || getCard(a).name.localeCompare(getCard(b).name);
      return filters.dir === 'desc' ? cmp : -cmp;
    });
    return list;
    // getCard e' una funzione in linea del chiamante: conta solo cosa estrae, non la sua identita'.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, filters]);

  return { filters, setFilter, reset, result };
}
