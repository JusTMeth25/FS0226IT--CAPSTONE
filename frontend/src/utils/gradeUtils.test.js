import { describe, expect, it } from 'vitest';
import { gradeInfo, gradeTone, gradedValue } from './gradeUtils.js';

const usd = (n) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);

describe('gradeUtils', () => {
  it.each([
    [10, 'GEM MINT', 2.0],
    [9, 'MINT', 1.6],
    [8, 'NM-MT', 1.35],
    [7, 'NEAR MINT', 1.15],
    [6, 'EX-MT', 1.0],
    [5, 'EXCELLENT', 0.9]
  ])('voto %i: %s, moltiplicatore %s', (grade, label, multiplier) => {
    expect(gradeInfo(grade)).toMatchObject({ label, multiplier });
  });

  it('voti bassi o sconosciuti valgono POOR', () => {
    expect(gradeInfo(3)).toEqual({ label: 'POOR', text: 'Rovinata', multiplier: 0.8 });
    expect(gradeInfo(undefined).label).toBe('POOR');
  });

  it('colore del voto: oro, argento, rame', () => {
    expect(gradeTone(10)).toBe('gold');
    expect(gradeTone(9)).toBe('gold');
    expect(gradeTone(8)).toBe('silver');
    expect(gradeTone(7)).toBe('silver');
    expect(gradeTone(6)).toBe('bronze');
    expect(gradeTone(1)).toBe('bronze');
  });

  it('valore gradato in dollari: prezzo per il moltiplicatore', () => {
    expect(gradedValue({ grade: 10, marketPrice: 10 })).toBe(usd(20));
    expect(gradedValue({ grade: 2, marketPrice: 10 })).toBe(usd(8));
  });

  it('la prima edizione vale una volta e mezza in piu\'', () => {
    expect(gradedValue({ grade: 10, marketPrice: 10, firstEdition: true })).toBe(usd(30));
  });

  it('carte FC 27: valore in crediti arrotondato, prima dei dollari', () => {
    expect(gradedValue({ grade: 9, coinPrice: 10000, marketPrice: 5 })).toBe('16.000 crediti');
    expect(gradedValue({ grade: 8, coinPrice: 333 })).toBe('450 crediti');
  });

  it('senza prezzo non c\'e\' valore', () => {
    expect(gradedValue({ grade: 10 })).toBeNull();
  });
});
