const { persistImportedCards } = require('./importCommon');

const SOURCE = 'scryfall';

const DEMO_CARDS = [
  { externalId: 'demo-black-lotus', name: 'Black Lotus (demo)', setName: 'Demo Set', number: '1', rarity: 'legendary', imgUrl: '', description: 'Carta demo (API Scryfall non raggiungibile).' },
  { externalId: 'demo-llanowar-elves', name: 'Llanowar Elves (demo)', setName: 'Demo Set', number: '2', rarity: 'common', imgUrl: '', description: 'Carta demo (API Scryfall non raggiungibile).' }
];

function mapRarity(raw) {
  switch (raw) {
    case 'mythic': return 'legendary';
    case 'rare': return 'epic';
    case 'uncommon': return 'rare';
    default: return raw === 'common' ? 'common' : 'uncommon';
  }
}

function normalize(card) {
  const image = card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal || '';
  return {
    externalId: card.id,
    code: `scryfall-${card.id}`,
    name: card.name,
    setName: card.set_name || null,
    setCode: card.set || null,
    number: card.collector_number || null,
    rarity: mapRarity(card.rarity),
    imgUrl: image,
    description: card.oracle_text || card.flavor_text || null,
    metadata: { manaCost: card.mana_cost || null, typeLine: card.type_line || null, colors: card.colors || [] }
  };
}

/** @param {{ limit?: number, query?: string }} [opts] */
async function importScryfallCards(opts = {}) {
  const limit = opts.limit || 20;
  const query = opts.query || 't:creature';

  try {
    const res = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&order=edhrec`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`scryfall_api_${res.status}`);
    const body = await res.json();
    const normalized = (body.data || []).slice(0, limit).map(normalize);
    const imported = await persistImportedCards(SOURCE, normalized);
    return { source: SOURCE, imported, usedFallback: false };
  } catch (err) {
    const imported = await persistImportedCards(SOURCE, DEMO_CARDS.map((c) => ({ ...c, code: `scryfall-${c.externalId}`, metadata: { demo: true } })), err.message);
    return { source: SOURCE, imported, usedFallback: true, error: err.message };
  }
}

module.exports = { importScryfallCards };
