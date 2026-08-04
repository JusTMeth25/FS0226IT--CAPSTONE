const { persistImportedCards } = require('./importCommon');

const SOURCE = 'lorcana';

const DEMO_CARDS = [
  { externalId: 'demo-mickey', name: 'Mickey Mouse (demo)', setName: 'Demo Set', number: '1', rarity: 'common', imgUrl: '', description: 'Carta demo (API Lorcana non raggiungibile).' },
  { externalId: 'demo-elsa', name: 'Elsa (demo)', setName: 'Demo Set', number: '2', rarity: 'legendary', imgUrl: '', description: 'Carta demo (API Lorcana non raggiungibile).' }
];

function mapRarity(raw) {
  const r = (raw || '').toLowerCase();
  if (r === 'enchanted' || r === 'iconic' || r === 'legendary') return 'legendary';
  if (r === 'epic' || r === 'super rare') return 'epic';
  if (r === 'rare') return 'rare';
  if (r === 'uncommon') return 'uncommon';
  return 'common';
}

function normalize(card) {
  return {
    externalId: card.Unique_ID,
    code: `lorcana-${card.Unique_ID}`,
    name: card.Name,
    setName: card.Set_Name || null,
    setCode: card.Set_ID || null,
    number: card.Card_Num != null ? String(card.Card_Num) : null,
    rarity: mapRarity(card.Rarity),
    imgUrl: card.Image || '',
    description: card.Flavor_Text || card.Body_Text || null,
    metadata: { color: card.Color || null, type: card.Type || null, franchise: card.Franchise || null }
  };
}

/**
 * L'API espone un unico endpoint "bulk" con tutte le carte (~2500): selezioniamo qui un blocco
 * casuale di `limit` carte, così click ripetuti dal pannello admin importano carte diverse.
 */
async function importLorcanaCards(opts = {}) {
  const limit = Math.min(opts.limit || 100, 250);

  try {
    const res = await fetch('https://api.lorcana-api.com/bulk/cards', {
      headers: { 'User-Agent': 'VinylDex/1.0', Accept: 'application/json' },
      signal: AbortSignal.timeout(20000)
    });
    if (!res.ok) throw new Error(`lorcana_api_${res.status}`);
    const all = await res.json();
    const start = Math.floor(Math.random() * Math.max(1, all.length - limit));
    const slice = all.slice(start, start + limit);
    const normalized = slice.map(normalize);
    const imported = await persistImportedCards(SOURCE, normalized);
    return { source: SOURCE, imported, usedFallback: false, totalAvailable: all.length };
  } catch (err) {
    try {
      const imported = await persistImportedCards(SOURCE, DEMO_CARDS.map((c) => ({ ...c, code: `lorcana-${c.externalId}`, metadata: { demo: true } })), err.message);
      return { source: SOURCE, imported, usedFallback: true, error: err.message };
    } catch (dbErr) {
      return { source: SOURCE, imported: 0, usedFallback: true, error: err.message, dbError: dbErr.message };
    }
  }
}

module.exports = { importLorcanaCards };
