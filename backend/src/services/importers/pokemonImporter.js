const { persistImportedCards } = require('./importCommon');

const SOURCE = 'pokemon';

const DEMO_CARDS = [
  { externalId: 'demo-pikachu', name: 'Pikachu (demo)', setName: 'Demo Set', number: '1', rarity: 'common', imgUrl: '', description: 'Carta demo (API Pokémon TCG non raggiungibile).' },
  { externalId: 'demo-charizard', name: 'Charizard (demo)', setName: 'Demo Set', number: '2', rarity: 'legendary', imgUrl: '', description: 'Carta demo (API Pokémon TCG non raggiungibile).' }
];

function mapRarity(raw) {
  const r = (raw || '').toLowerCase();
  if (r.includes('secret') || r.includes('rainbow') || r.includes('hyper') || r.includes('special')) return 'legendary';
  if (r.includes('ultra') || r.includes('holo')) return 'epic';
  if (r.includes('rare')) return 'rare';
  if (r.includes('uncommon')) return 'uncommon';
  return 'common';
}

function normalize(card) {
  return {
    externalId: card.id,
    code: `pokemon-${card.id}`,
    name: card.name,
    setName: card.set?.name || null,
    setCode: card.set?.id || null,
    number: card.number || null,
    rarity: mapRarity(card.rarity),
    imgUrl: card.images?.large || card.images?.small || '',
    description: card.flavorText || (Array.isArray(card.rules) ? card.rules.join(' ') : null),
    metadata: { types: card.types || [], hp: card.hp || null, artist: card.artist || null }
  };
}

/**
 * @param {{ limit?: number, page?: number }} [opts] - limit: max 250 (limite dell'API per pagina).
 * Se `page` non è specificato viene scelta una pagina casuale tra le ~80 disponibili, così
 * click ripetuti dal pannello admin importano carte diverse invece di riscrivere sempre le stesse.
 */
async function importPokemonCards(opts = {}) {
  const limit = Math.min(opts.limit || 100, 250);
  const page = opts.page || Math.floor(Math.random() * 80) + 1;
  const headers = { 'User-Agent': 'VinylDex/1.0', Accept: 'application/json' };
  if (process.env.POKEMONTCG_API_KEY) headers['X-Api-Key'] = process.env.POKEMONTCG_API_KEY;

  try {
    const res = await fetch(`https://api.pokemontcg.io/v2/cards?pageSize=${limit}&page=${page}`, { headers, signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`pokemontcg_api_${res.status}`);
    const body = await res.json();
    const normalized = (body.data || []).map(normalize);
    const imported = await persistImportedCards(SOURCE, normalized);
    return { source: SOURCE, imported, usedFallback: false, page, totalAvailable: body.totalCount };
  } catch (err) {
    const imported = await persistImportedCards(SOURCE, DEMO_CARDS.map((c) => ({ ...c, code: `pokemon-${c.externalId}`, metadata: { demo: true } })), err.message);
    return { source: SOURCE, imported, usedFallback: true, error: err.message };
  }
}

module.exports = { importPokemonCards };
