import { describe, expect, it } from 'vitest';
import { SYNERGY_CAP, applySynergies, teamSynergies } from './battleSynergy.js';

/** Carta VinylDex comune senza finitura: nessuna sinergia "per caso". */
const card = (extra = {}) => ({ name: 'Carta', rarity: 'common', stats: { fans: 100, style: 50, influence: 10, energy: 0 }, ...extra });

describe('battleSynergy: teamSynergies', () => {
  it('squadra senza niente in comune (fonti diverse): nessun bonus', () => {
    const team = [card({ source: 'pokemon' }), card({ source: 'scryfall' }), card({ source: 'yugioh' })];
    const { bonuses, perCard } = teamSynergies(team);
    expect(bonuses).toEqual([]);
    expect(perCard).toEqual([0, 0, 0]);
  });

  it('due carte della stessa classe: +6% solo a loro', () => {
    const team = [card({ artistClass: 'The MVP' }), card({ artistClass: 'The MVP' }), null];
    const { bonuses, perCard } = teamSynergies(team);
    expect(bonuses).toHaveLength(1);
    expect(bonuses[0]).toMatchObject({ key: 'class-The MVP', label: 'Stessa classe: The MVP', value: 6, members: [0, 1] });
    expect(perCard).toEqual([6, 6, 0]);
  });

  it('tre della stessa classe e dello stesso gioco: +12% e +5%', () => {
    const team = [card({ artistClass: 'The Showman' }), card({ artistClass: 'The Showman' }), card({ artistClass: 'The Showman' })];
    const { bonuses, perCard } = teamSynergies(team);
    expect(bonuses.map((b) => [b.key, b.value])).toEqual([['class-The Showman', 12], ['game', 5]]);
    expect(perCard).toEqual([17, 17, 17]);
  });

  it('stessa tipologia: +5% in due, +10% in tre', () => {
    const two = teamSynergies([card({ source: 'pokemon', kind: 'Fuoco' }), card({ source: 'scryfall', kind: 'Fuoco' }), card({ source: 'yugioh' })]);
    expect(two.perCard).toEqual([5, 5, 0]);
    const three = teamSynergies([card({ source: 'pokemon', kind: 'Acqua' }), card({ source: 'scryfall', kind: 'Acqua' }), card({ source: 'yugioh', kind: 'Acqua' })]);
    expect(three.bonuses[0]).toMatchObject({ key: 'kind-Acqua', value: 10 });
  });

  it('le carte Pokemon giapponesi e promo fanno squadra con le altre Pokemon (stesso set e stesso gioco)', () => {
    const team = [
      card({ source: 'pokemon', setName: 'Base' }),
      card({ source: 'pokemonjp', setName: 'Base' }),
      card({ source: 'pokemonpromo' })
    ];
    const { bonuses, perCard } = teamSynergies(team);
    expect(bonuses.find((b) => b.key === 'set-pokemon|Base')).toMatchObject({ label: 'Stesso set: Base', value: 4, members: [0, 1] });
    expect(bonuses.find((b) => b.key === 'game')).toBeTruthy();
    expect(perCard).toEqual([9, 9, 5]);
  });

  it('lo stesso nome di set in giochi diversi non conta', () => {
    const { bonuses } = teamSynergies([card({ source: 'pokemon', setName: 'Base' }), card({ source: 'scryfall', setName: 'Base' }), null]);
    expect(bonuses).toEqual([]);
  });

  it('tre carte speciali: bonus collezionisti', () => {
    const team = [card({ rarity: 'legendary' }), card({ rarity: 'epic' }), card({ finish: 'holo' })];
    const { bonuses } = teamSynergies(team);
    expect(bonuses.map((b) => b.key)).toEqual(['game', 'special']);
  });

  it('i bonus sommati non superano il massimo', () => {
    const same = { source: 'pokemon', artistClass: 'X', kind: 'Erba', setName: 'Giungla' };
    const { perCard } = teamSynergies([card(same), card(same), card(same)]);
    expect(SYNERGY_CAP).toBe(25);
    expect(perCard).toEqual([25, 25, 25]);
  });
});

describe('battleSynergy: applySynergies', () => {
  it('aumenta le quattro statistiche del bonus della carta e lo segna in synergy', () => {
    const team = [card({ artistClass: 'A' }), card({ artistClass: 'A' }), card({ artistClass: 'A' })];
    const [first] = applySynergies(team);
    expect(first.synergy).toBe(17);
    expect(first.stats).toEqual({ fans: 117, style: 59, influence: 12, energy: 0 });
    // La carta originale non viene modificata.
    expect(team[0].stats.fans).toBe(100);
  });

  it('carte senza bonus e posti vuoti restano come sono', () => {
    const lonely = card({ source: 'pokemon' });
    const result = applySynergies([lonely, null, card({ source: 'scryfall' })]);
    expect(result[0]).toBe(lonely);
    expect(result[1]).toBeNull();
  });
});
