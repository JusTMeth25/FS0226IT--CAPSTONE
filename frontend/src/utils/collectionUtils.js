/**
 * Normalizza la collezione in un elenco di carte UNICHE con `quantity`.
 *
 * Gestisce due forme diverse a seconda della fonte dati:
 * - "server" (utente autenticato, da GET /api/collection): già deduplicata,
 *   una entry per carta con `quantity` reale.
 * - "ospite" (localStorage): una entry per COPIA posseduta, senza `quantity`.
 */
export function dedupeCollection(collection) {
  if (!collection || !collection.length) return [];

  if ('quantity' in collection[0]) {
    return [...collection].sort((a, b) => new Date(b.obtainedAt || 0) - new Date(a.obtainedAt || 0));
  }

  const counts = new Map();
  collection.forEach((c) => counts.set(c.id, (counts.get(c.id) || 0) + 1));

  const seen = new Set();
  return [...collection]
    .sort((a, b) => new Date(b.obtainedAt || 0) - new Date(a.obtainedAt || 0))
    .filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    })
    .map((c) => ({ ...c, quantity: counts.get(c.id) || 1 }));
}

/**
 * Valore di mercato indicativo della collezione: prezzo di ogni carta per le copie possedute.
 *
 * Il prezzo esiste solo per le carte importate da fonti con dati di mercato (Pokémon, Magic,
 * Yu-Gi-Oh!, ...): le originali VinylDex e le fonti senza prezzi non contribuiscono, e vengono
 * contate a parte per poterlo dire all'utente.
 */
export function getCollectionValue(collection) {
  let total = 0;
  let unpricedCount = 0;

  dedupeCollection(collection).forEach((card) => {
    if (card.marketPrice > 0) total += card.marketPrice * (card.quantity || 1);
    else unpricedCount += 1;
  });

  return { total, unpricedCount };
}
