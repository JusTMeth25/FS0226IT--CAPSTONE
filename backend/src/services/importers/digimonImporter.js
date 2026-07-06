const { persistImportedCards } = require('./importCommon');

const SOURCE = 'digimon';

const DEMO_CARDS = [
  { externalId: 'demo-agumon', name: 'Agumon (demo)', setName: 'Demo Set', number: '1', rarity: 'common', imgUrl: '', description: 'Carta demo (API DigimonCard.io non raggiungibile).' },
  { externalId: 'demo-omnimon', name: 'Omnimon (demo)', setName: 'Demo Set', number: '2', rarity: 'legendary', imgUrl: '', description: 'Carta demo (API DigimonCard.io non raggiungibile).' }
];

function mapRarity(raw) {
  const r = (raw || '').toLowerCase();
  if (r === 'sec' || r === 'ur') return 'legendary';
  if (r === 'sr') return 'epic';
  if (r === 'r') return 'rare';
  if (r === 'u') return 'uncommon';
  return 'common';
}

function normalize(card) {
  return {
    externalId: card.id,
    code: `digimon-${card.id}`,
    name: card.name,
    setName: Array.isArray(card.set_name) ? card.set_name[0] : (card.set_name || null),
    setCode: card.id?.split('-')?.[0] || null,
    number: card.id || null,
    rarity: mapRarity(card.rarity),
    imgUrl: `https://images.digimoncard.io/images/cards/${card.id}.jpg`,
    description: card.main_effect || card.source_effect || null,
    metadata: { color: card.color || null, type: card.type || null, dp: card.dp || null, playCost: card.play_cost || null }
  };
}

/**
 * L'API DigimonCard.io non pagina un endpoint "tutte le carte": usiamo /search.php con la serie
 * base per ottenere l'intero pool (~9000 righe, ma solo ~4300 id univoci: la stessa carta compare
 * più volte per varianti tcgplayer identiche) e selezioniamo qui un blocco casuale, deduplicato per
 * id, così click ripetuti dal pannello admin importano carte diverse senza sprecare `limit`.
 */
async function importDigimonCards(opts = {}) {
  const limit = Math.min(opts.limit || 100, 200);

  try {
    const res = await fetch('https://digimoncard.io/api-public/search.php?series=Digimon%20Card%20Game&sort=name&sortdirection=asc', {
      headers: { 'User-Agent': 'VinylDex/1.0', Accept: 'application/json' },
      signal: AbortSignal.timeout(20000)
    });
    if (!res.ok) throw new Error(`digimoncard_api_${res.status}`);
    const all = await res.json();
    const uniqueById = Array.from(new Map(all.map((c) => [c.id, c])).values());
    const start = Math.floor(Math.random() * Math.max(1, uniqueById.length - limit));
    const slice = uniqueById.slice(start, start + limit);
    const normalized = slice.map(normalize);
    const imported = await persistImportedCards(SOURCE, normalized);
    return { source: SOURCE, imported, usedFallback: false, totalAvailable: uniqueById.length };
  } catch (err) {
    const imported = await persistImportedCards(SOURCE, DEMO_CARDS.map((c) => ({ ...c, code: `digimon-${c.externalId}`, metadata: { demo: true } })), err.message);
    return { source: SOURCE, imported, usedFallback: true, error: err.message };
  }
}

module.exports = { importDigimonCards };
