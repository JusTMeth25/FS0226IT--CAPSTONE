/**
 * Generazione carte pacchetto SEMPRE server-side. Il client non decide mai
 * drop-rate o carte vinte: questo modulo legge drop-rate/garanzie dal DB e
 * pesca le carte con randomness lato server.
 */

function weightedRandom(choices) {
  const total = choices.reduce((s, c) => s + c.weight, 0);
  if (total <= 0) return choices[Math.floor(Math.random() * choices.length)]?.item;
  let r = Math.random() * total;
  for (const c of choices) {
    r -= c.weight;
    if (r <= 0) return c.item;
  }
  return choices[choices.length - 1].item;
}

function randomItem(arr) {
  if (!arr.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {object} pack - include packDropRates, packGuarantees, event
 * @returns {Promise<object[]>} carte Prisma (con relazione artistClass) estratte
 */
async function generatePackCards(tx, pack) {
  const allCards = await tx.card.findMany({ where: { isActive: true }, include: { artistClass: true } });
  const byRarity = {};
  allCards.forEach((c) => {
    if (!byRarity[c.rarity]) byRarity[c.rarity] = [];
    byRarity[c.rarity].push(c);
  });

  const bonusMultiplier = pack.event?.isActive ? pack.event.bonusDropRateMultiplier : 1;
  const boostedRarities = new Set(['rare', 'epic', 'legendary']);

  const weightsRaw = {};
  pack.packDropRates.forEach((dr) => {
    weightsRaw[dr.rarity] = dr.weight * (boostedRarities.has(dr.rarity) ? bonusMultiplier : 1);
  });
  const totalWeight = Object.values(weightsRaw).reduce((s, w) => s + w, 0) || 1;
  const choices = Object.entries(weightsRaw).map(([rarity, weight]) => ({ item: rarity, weight: weight / totalWeight }));

  const result = [];
  const excludeIds = [];

  const guaranteeOrder = ['legendary', 'epic', 'rare'];
  const guaranteeMap = {};
  pack.packGuarantees.forEach((g) => { guaranteeMap[g.rarity] = g.count; });

  for (const rarity of guaranteeOrder) {
    const count = guaranteeMap[rarity] || 0;
    for (let i = 0; i < count && result.length < pack.cardCount; i++) {
      const pool = (byRarity[rarity] || []).filter((c) => !excludeIds.includes(c.id));
      const card = randomItem(pool);
      if (card) {
        result.push(card);
        excludeIds.push(card.id);
      }
    }
  }

  while (result.length < pack.cardCount) {
    const rarity = weightedRandom(choices);
    const pool = (byRarity[rarity] || []).filter((c) => !excludeIds.includes(c.id));
    let card = randomItem(pool);
    if (!card) {
      const anyPool = allCards.filter((c) => !excludeIds.includes(c.id));
      card = randomItem(anyPool);
    }
    if (!card) break; // pool esaurito
    result.push(card);
    excludeIds.push(card.id);
  }

  return result;
}

module.exports = { generatePackCards, weightedRandom, randomItem };
