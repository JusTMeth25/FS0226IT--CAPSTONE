import { describe, expect, it } from 'vitest';
import { dedupeCollection, getCollectionValue } from './collectionUtils.js';

describe('collectionUtils: dedupeCollection', () => {
  it('collezione vuota o mancante: elenco vuoto', () => {
    expect(dedupeCollection([])).toEqual([]);
    expect(dedupeCollection(null)).toEqual([]);
    expect(dedupeCollection(undefined)).toEqual([]);
  });

  it('forma del server (con quantity): solo ordinata dalla piu\' recente, senza toccare l\'originale', () => {
    const server = [
      { id: 'a', quantity: 2, obtainedAt: '2026-01-01' },
      { id: 'b', quantity: 1, obtainedAt: '2026-03-01' }
    ];
    const result = dedupeCollection(server);
    expect(result.map((c) => c.id)).toEqual(['b', 'a']);
    expect(result[1].quantity).toBe(2);
    expect(server[0].id).toBe('a');
  });

  it('forma dell\'ospite (una voce per copia): conta le copie e tiene la piu\' recente', () => {
    const guest = [
      { id: 'a', obtainedAt: '2026-01-01' },
      { id: 'b', obtainedAt: '2026-02-01' },
      { id: 'a', obtainedAt: '2026-05-01' },
      { id: 'a', obtainedAt: '2026-04-01' }
    ];
    const result = dedupeCollection(guest);
    expect(result).toEqual([
      { id: 'a', obtainedAt: '2026-05-01', quantity: 3 },
      { id: 'b', obtainedAt: '2026-02-01', quantity: 1 }
    ]);
  });

  it('carte senza data finiscono in fondo', () => {
    const result = dedupeCollection([{ id: 'x' }, { id: 'y', obtainedAt: '2026-01-01' }]);
    expect(result.map((c) => c.id)).toEqual(['y', 'x']);
  });
});

describe('collectionUtils: getCollectionValue', () => {
  it('somma prezzo per copie e conta a parte le carte senza prezzo', () => {
    const collection = [
      { id: 'a', quantity: 2, marketPrice: 10 },
      { id: 'b', quantity: 1, marketPrice: 2.5 },
      { id: 'c', quantity: 4 },
      { id: 'd', quantity: 1, marketPrice: 0 }
    ];
    expect(getCollectionValue(collection)).toEqual({ total: 22.5, unpricedCount: 2 });
  });

  it('collezione dell\'ospite: le copie doppie contano nel valore', () => {
    const guest = [{ id: 'a', marketPrice: 3 }, { id: 'a', marketPrice: 3 }];
    expect(getCollectionValue(guest)).toEqual({ total: 6, unpricedCount: 0 });
  });

  it('collezione vuota: valore zero', () => {
    expect(getCollectionValue([])).toEqual({ total: 0, unpricedCount: 0 });
  });
});
