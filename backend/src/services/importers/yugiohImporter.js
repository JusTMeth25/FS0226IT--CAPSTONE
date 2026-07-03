const { persistImportedCards } = require('./importCommon');

const SOURCE = 'yugioh';

const DEMO_CARDS = [
  { externalId: 'demo-dark-magician', name: 'Dark Magician (demo)', setName: 'Demo Set', number: '1', rarity: 'legendary', imgUrl: '', description: 'Carta demo (API YGOPRODeck non raggiungibile).' },
  { externalId: 'demo-kuriboh', name: 'Kuriboh (demo)', setName: 'Demo Set', number: '2', rarity: 'common', imgUrl: '', description: 'Carta demo (API YGOPRODeck non raggiungibile).' }
];

function mapRarity(raw) {
  const r = (raw || '').toLowerCase();
  if (r.includes('secret') || r.includes('ultimate') || r.includes('ghost') || r.includes('collector') || r.includes('starlight') || r.includes('quarter century')) return 'legendary';
  if (r.includes('ultra')) return 'epic';
  if (r.includes('super')) return 'rare';
  if (r.includes('rare')) return 'uncommon';
  return 'common';
}

function normalize(card) {
  const set = card.card_sets?.[0];
  return {
    externalId: String(card.id),
    code: `yugioh-${card.id}`,
    name: card.name,
    setName: set?.set_name || null,
    setCode: set?.set_code || null,
    number: null,
    rarity: mapRarity(set?.set_rarity),
    imgUrl: card.card_images?.[0]?.image_url || '',
    description: card.desc || null,
    metadata: { type: card.type || null, atk: card.atk ?? null, def: card.def ?? null }
  };
}

/**
 * @param {{ limit?: number, offset?: number }} [opts] - Se `offset` non è specificato viene scelto
 * un punto casuale nel database (~14000 carte), così click ripetuti dal pannello admin importano
 * carte diverse invece di riscrivere sempre le stesse prime N.
 */
async function importYugiohCards(opts = {}) {
  const limit = Math.min(opts.limit || 100, 200);
  const offset = opts.offset ?? Math.floor(Math.random() * 14000);

  try {
    const res = await fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?num=${limit}&offset=${offset}`, {
      headers: { 'User-Agent': 'VinylLegends/1.0', Accept: 'application/json' },
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) throw new Error(`ygoprodeck_api_${res.status}`);
    const body = await res.json();
    const normalized = (body.data || []).map(normalize);
    const imported = await persistImportedCards(SOURCE, normalized);
    return { source: SOURCE, imported, usedFallback: false, offset, totalAvailable: body.meta?.total_rows };
  } catch (err) {
    const imported = await persistImportedCards(SOURCE, DEMO_CARDS.map((c) => ({ ...c, code: `yugioh-${c.externalId}`, metadata: { demo: true } })), err.message);
    return { source: SOURCE, imported, usedFallback: true, error: err.message };
  }
}

module.exports = { importYugiohCards };
