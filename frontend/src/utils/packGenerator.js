/**
 * Generatore locale di apertura pacchetti (fallback quando il backend non è disponibile).
 * NOTA: la fonte di verità per gold/drop-rate/carte vinte è sempre il server (Fase 2);
 * questa logica esiste solo per continuità offline/demo lato client.
 */
import { CARDS } from '../data/cards.js';
import { weightedRandom, randomItem } from './random.js';

export function normalizeDropRates(dropRates) {
  const entries = Object.entries(dropRates || {});
  const sum = entries.reduce((s, [, v]) => s + (Number(v) || 0), 0);
  if (sum <= 0) return { common: 1 };
  const normalized = {};
  entries.forEach(([k, v]) => { normalized[k] = (Number(v) || 0) / sum; });
  return normalized;
}

export function pickRarity(dropRates) {
  const normalized = normalizeDropRates(dropRates);
  const choices = Object.entries(normalized).map(([rarity, weight]) => ({ item: rarity, weight }));
  return weightedRandom(choices);
}

function pickCardByRarity(rarity, excludeIds, pool) {
  const filtered = pool.filter((c) => c.rarity === rarity && !excludeIds.includes(c.id));
  if (!filtered.length) return null;
  return { ...randomItem(filtered) };
}

export function generatePackCards(pack, pool = CARDS) {
  const normalized = normalizeDropRates(pack.dropRates);
  const result = [];
  const exclude = [];

  const guaranteeOrder = ['legendary', 'epic', 'rare'];
  for (const key of guaranteeOrder) {
    const count = Math.max(0, parseInt(pack.guarantees?.[key] || 0, 10));
    for (let i = 0; i < count && result.length < pack.cardCount; i++) {
      const c = pickCardByRarity(key, exclude, pool);
      if (c) {
        result.push({ ...c, obtainedAt: Date.now() });
        exclude.push(c.id);
      }
    }
  }

  while (result.length < pack.cardCount) {
    const rarity = pickRarity(normalized);
    const c = pickCardByRarity(rarity, exclude, pool);
    if (c) {
      result.push({ ...c, obtainedAt: Date.now() });
      exclude.push(c.id);
      continue;
    }
    const anyCard = randomItem(pool.filter((a) => !exclude.includes(a.id)));
    if (!anyCard) break;
    result.push({ ...anyCard, obtainedAt: Date.now() });
    exclude.push(anyCard.id);
  }

  return result;
}
