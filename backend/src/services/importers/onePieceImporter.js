const { persistImportedCards } = require('./importCommon');
const { rarityFromPrice } = require('./priceRarity');

const SOURCE = 'onepiece';

const DEMO_CARDS = [
  { externalId: 'demo-luffy', name: 'Monkey D. Luffy (demo)', setName: 'Demo Set', number: '1', rarity: 'legendary', imgUrl: '', description: 'Carta demo (API OPTCG non raggiungibile).' },
  { externalId: 'demo-zoro', name: 'Roronoa Zoro (demo)', setName: 'Demo Set', number: '2', rarity: 'rare', imgUrl: '', description: 'Carta demo (API OPTCG non raggiungibile).' }
];

// Fallback usato solo quando la carta non ha alcun prezzo di mercato disponibile
// (rarità dichiarata dalla fonte, non riflette necessariamente il valore reale).
function mapRarityFallback(raw) {
  const r = (raw || '').toUpperCase();
  if (r === 'SEC') return 'legendary';
  if (r === 'SR' || r === 'TR') return 'epic';
  if (r === 'R' || r === 'L') return 'rare';
  if (r === 'UC') return 'uncommon';
  return 'common';
}

/** L'API restituisce anche le versioni "Parallel" con lo stesso card_set_id dell'originale:
 * il nome file immagine (es. OP01-001 vs OP01-001_p1) è l'unico identificatore davvero univoco. */
function externalIdFromImage(card) {
  const file = (card.card_image || '').split('/').pop() || card.card_set_id;
  return file.replace(/\.[a-z]+$/i, '') || card.card_set_id;
}

function normalize(card) {
  const externalId = externalIdFromImage(card);
  const price = card.market_price > 0 ? card.market_price : null;
  return {
    externalId,
    code: `onepiece-${externalId}`,
    name: card.card_name,
    setName: card.set_name || null,
    setCode: card.set_id || null,
    number: card.card_set_id || null,
    rarity: rarityFromPrice(SOURCE, price) || mapRarityFallback(card.rarity),
    imgUrl: card.card_image || '',
    description: card.card_text || null,
    metadata: { color: card.card_color || null, type: card.card_type || null, power: card.card_power || null, life: card.life || null, marketPrice: price }
  };
}

/**
 * L'API OPTCG non pagina: espone un unico endpoint con tutte le carte (~3500). Per coerenza con
 * gli altri importer (che invece impaginano lato server) selezioniamo qui un blocco casuale di
 * `limit` carte dal risultato completo, così click ripetuti importano carte diverse.
 */
async function importOnePieceCards(opts = {}) {
  const limit = Math.min(opts.limit || 100, 250);

  try {
    const res = await fetch('https://www.optcgapi.com/api/allSetCards/', {
      headers: { 'User-Agent': 'VinylDex/1.0', Accept: 'application/json' },
      signal: AbortSignal.timeout(20000)
    });
    if (!res.ok) throw new Error(`optcgapi_${res.status}`);
    const all = await res.json();
    const start = Math.floor(Math.random() * Math.max(1, all.length - limit));
    const slice = all.slice(start, start + limit);
    const normalized = slice.map(normalize);
    const imported = await persistImportedCards(SOURCE, normalized);
    return { source: SOURCE, imported, usedFallback: false, totalAvailable: all.length };
  } catch (err) {
    const imported = await persistImportedCards(SOURCE, DEMO_CARDS.map((c) => ({ ...c, code: `onepiece-${c.externalId}`, metadata: { demo: true } })), err.message);
    return { source: SOURCE, imported, usedFallback: true, error: err.message };
  }
}

module.exports = { importOnePieceCards };
