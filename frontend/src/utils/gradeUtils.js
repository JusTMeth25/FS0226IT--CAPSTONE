import { formatCoins, formatMarketPrice } from './cardUtils.js';

/** Voti del perito: nome sul cofanetto (come le agenzie vere) e quanto cambia il valore. */
const GRADES = {
  10: { label: 'GEM MINT', text: 'Gemma perfetta', multiplier: 2.0 },
  9: { label: 'MINT', text: 'Quasi perfetta', multiplier: 1.6 },
  8: { label: 'NM-MT', text: 'Ottima', multiplier: 1.35 },
  7: { label: 'NEAR MINT', text: 'Molto buona', multiplier: 1.15 },
  6: { label: 'EX-MT', text: 'Buona', multiplier: 1.0 },
  5: { label: 'EXCELLENT', text: 'Discreta', multiplier: 0.9 }
};
const LOW = { label: 'POOR', text: 'Rovinata', multiplier: 0.8 };

export function gradeInfo(grade) {
  return GRADES[grade] || LOW;
}

/** Colore del voto: oro per 9-10, argento per 7-8, rame sotto. */
export function gradeTone(grade) {
  if (grade >= 9) return 'gold';
  if (grade >= 7) return 'silver';
  return 'bronze';
}

/** Valore stimato della copia gradata (prezzo di mercato per il moltiplicatore del voto). */
export function gradedValue(card) {
  const k = gradeInfo(card.grade).multiplier;
  if (card.coinPrice > 0) return formatCoins(Math.round(card.coinPrice * k));
  if (card.marketPrice > 0) return formatMarketPrice(card.marketPrice * k);
  return null;
}
