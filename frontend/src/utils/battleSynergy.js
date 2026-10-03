/**
 * Bonus di squadra in battaglia: carte che hanno qualcosa in comune si danno forza a vicenda.
 *
 * - Stessa classe (carte VinylDex: The Showman, The MVP...): +6% in 2, +12% in 3.
 * - Stessa tipologia (tipo Pokemon, colore Magic/One Piece/Lorcana, razza Yu-Gi-Oh!, squadra NBA,
 *   club FC 27...: il campo `kind` del server): +5% in 2, +10% in 3.
 * - Stesso set: +4% in 2, +8% in 3.
 * - Stesso gioco: +5% se tutte e tre vengono dallo stesso gioco.
 * - Collezionisti: +5% se tutte e tre sono carte speciali (olografiche, ex, Full Art, leggendarie...).
 *
 * I bonus si sommano per carta, fino a un massimo di +25%, e valgono su tutte e quattro le
 * statistiche. Valgono anche per la squadra avversaria.
 */
import { cardFinish } from './cardUtils.js';

const STATS = ['fans', 'style', 'influence', 'energy'];
export const SYNERGY_CAP = 25;

/** Famiglia di gioco: le carte Pokemon giapponesi e promo fanno squadra con le altre Pokemon. */
function game(card) {
  const source = card.source || 'original';
  return source.startsWith('pokemon') ? 'pokemon' : source;
}

/** Gruppi di carte con lo stesso valore: { valore: [indici] }, solo i valori presenti almeno due volte. */
function groupsBy(team, key) {
  const groups = new Map();
  team.forEach((card, i) => {
    const value = key(card);
    if (!value) return;
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(i);
  });
  return [...groups.entries()].filter(([, members]) => members.length >= 2);
}

/**
 * Sinergie attive di una squadra (array di carte, quelle mancanti sono null).
 * @returns {{ bonuses: Array<{ key, label, icon, value, members }>, perCard: number[] }}
 *   perCard: bonus in percentuale per ogni posizione della squadra.
 */
export function teamSynergies(team) {
  const cards = team.map((c) => c || null);
  const present = cards.filter(Boolean);
  const bonuses = [];
  const add = (key, label, icon, value, members) => bonuses.push({ key, label, icon, value, members });
  const filled = cards.map((c, i) => (c ? i : -1)).filter((i) => i >= 0);
  const pick = (fn) => (card) => (card ? fn(card) : null);

  groupsBy(cards, pick((c) => c.artistClass)).forEach(([name, members]) => {
    add(`class-${name}`, `Stessa classe: ${name}`, 'ph-users-three', members.length >= 3 ? 12 : 6, members);
  });
  groupsBy(cards, pick((c) => c.kind)).forEach(([name, members]) => {
    add(`kind-${name}`, `Stessa tipologia: ${name}`, 'ph-shapes', members.length >= 3 ? 10 : 5, members);
  });
  groupsBy(cards, pick((c) => (c.setName || c.group ? `${game(c)}|${c.setName || c.group}` : null))).forEach(([key, members]) => {
    add(`set-${key}`, `Stesso set: ${key.split('|')[1]}`, 'ph-stack', members.length >= 3 ? 8 : 4, members);
  });
  if (present.length === 3 && new Set(present.map(game)).size === 1) {
    add('game', 'Tutte dello stesso gioco', 'ph-cards', 5, filled);
  }
  if (present.length === 3 && present.every((c) => cardFinish(c))) {
    add('special', 'Squadra di carte speciali', 'ph-sparkle', 5, filled);
  }

  const perCard = cards.map((_, i) => Math.min(SYNERGY_CAP,
    bonuses.filter((b) => b.members.includes(i)).reduce((sum, b) => sum + b.value, 0)));
  return { bonuses, perCard };
}

/** La squadra con le statistiche aumentate dai bonus (e il bonus di ogni carta in `synergy`). */
export function applySynergies(team) {
  const { perCard } = teamSynergies(team);
  return team.map((card, i) => {
    if (!card || !perCard[i]) return card;
    const stats = { ...card.stats };
    STATS.forEach((s) => { stats[s] = Math.round((stats[s] || 0) * (1 + perCard[i] / 100)); });
    return { ...card, stats, synergy: perCard[i] };
  });
}
