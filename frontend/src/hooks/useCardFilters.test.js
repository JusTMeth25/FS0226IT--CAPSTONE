import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useCardFilters } from './useCardFilters.js';

const CARDS = [
  { id: 1, name: 'Bravo', artistClass: 'The MVP', rarity: 'rare', source: 'original', obtainedAt: '2026-01-01', marketPrice: 5, stats: { fans: 10 } },
  { id: 2, name: 'Alfa', artistClass: 'The Showman', rarity: 'legendary', source: 'pokemon', obtainedAt: '2026-03-01', marketPrice: 1, stats: { fans: 50 } },
  { id: 3, name: 'Charlie', artistClass: 'The MVP', rarity: 'common', source: 'pokemon', obtainedAt: '2026-02-01', stats: { fans: 30 } },
  { id: 4, name: 'Delta', artistClass: 'The Showman', rarity: 'rare', source: 'scryfall', marketPrice: 20, stats: {} }
];

const ids = (result) => result.current.result.map((c) => c.id);

describe('useCardFilters', () => {
  it('senza filtri mostra tutto, dalla carta ottenuta per ultima', () => {
    const { result } = renderHook(() => useCardFilters(CARDS));
    expect(result.current.filters).toEqual({ q: '', cls: '', rarity: '', source: '', sort: 'date', dir: 'desc' });
    // La carta senza data (4) finisce in fondo.
    expect(ids(result)).toEqual([2, 3, 1, 4]);
  });

  it('elenco mancante: nessun risultato', () => {
    const { result } = renderHook(() => useCardFilters(null));
    expect(result.current.result).toEqual([]);
  });

  it('cerca per nome senza distinguere maiuscole e ignorando gli spazi', () => {
    const { result } = renderHook(() => useCardFilters(CARDS));
    act(() => result.current.setFilter('q', '  ALF '));
    expect(ids(result)).toEqual([2]);
  });

  it('filtra per classe, rarita\' e fonte insieme', () => {
    const { result } = renderHook(() => useCardFilters(CARDS));
    act(() => result.current.setFilter('cls', 'The MVP'));
    expect(ids(result)).toEqual([3, 1]);
    act(() => result.current.setFilter('rarity', 'rare'));
    expect(ids(result)).toEqual([1]);
    act(() => result.current.setFilter('source', 'pokemon'));
    expect(ids(result)).toEqual([]);
  });

  it.each([
    ['rarity', 'desc', [2, 1, 4, 3]],
    ['rarity', 'asc', [3, 4, 1, 2]],
    ['stats', 'desc', [2, 3, 1, 4]],
    ['price', 'desc', [4, 1, 2, 3]],
    ['date', 'asc', [4, 1, 3, 2]],
    ['name', 'desc', [2, 1, 3, 4]],
    ['name', 'asc', [4, 3, 1, 2]]
  ])('ordine %s %s', (sort, dir, expected) => {
    const { result } = renderHook(() => useCardFilters(CARDS));
    act(() => {
      result.current.setFilter('sort', sort);
      result.current.setFilter('dir', dir);
    });
    expect(ids(result)).toEqual(expected);
  });

  it('a parita\' di criterio decide il nome', () => {
    const { result } = renderHook(() => useCardFilters(CARDS, undefined, { sort: 'rarity' }));
    // Bravo (1) e Delta (4) sono entrambe rare: prima Bravo.
    expect(ids(result)).toEqual([2, 1, 4, 3]);
  });

  it('ordine sconosciuto: si usa quello per data', () => {
    const { result } = renderHook(() => useCardFilters(CARDS, undefined, { sort: 'inventato' }));
    expect(ids(result)).toEqual([2, 3, 1, 4]);
  });

  it('getCard estrae la carta dall\'elemento (per esempio un\'offerta del mercato)', () => {
    const offers = CARDS.map((card) => ({ offerId: `o${card.id}`, card }));
    offers.push({ offerId: 'vuota', card: null });
    const { result } = renderHook(() => useCardFilters(offers, (o) => o.card, { rarity: 'rare' }));
    expect(result.current.result.map((o) => o.offerId)).toEqual(['o1', 'o4']);
  });

  it('reset torna ai valori iniziali passati dal chiamante', () => {
    const { result } = renderHook(() => useCardFilters(CARDS, undefined, { source: 'pokemon' }));
    expect(ids(result)).toEqual([2, 3]);
    act(() => {
      result.current.setFilter('source', '');
      result.current.setFilter('q', 'delta');
    });
    expect(ids(result)).toEqual([4]);
    act(() => result.current.reset());
    expect(result.current.filters.source).toBe('pokemon');
    expect(result.current.filters.q).toBe('');
    expect(ids(result)).toEqual([2, 3]);
  });

  it('non modifica l\'elenco ricevuto', () => {
    const items = [...CARDS];
    renderHook(() => useCardFilters(items, undefined, { sort: 'name' }));
    expect(items.map((c) => c.id)).toEqual([1, 2, 3, 4]);
  });
});
