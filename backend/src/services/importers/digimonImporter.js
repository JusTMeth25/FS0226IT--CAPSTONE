const { persistImportedCards } = require('./importCommon');
const { rarityFromPrice } = require('./priceRarity');

const SOURCE = 'digimon';
const TCGCSV_CATEGORY_ID = 63; // Digimon Card Game su tcgcsv.com (mirror pubblico dei dati TCGPlayer)
const PRICE_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h: evita di rifare ~100 richieste a ogni import

// digimoncard.io non espone un prezzo di mercato diretto, ma include il tcgplayer_id di ogni
// carta: si costruisce una volta (e si mette in cache) una mappa productId -> prezzo leggendo
// tutti i gruppi (set) della categoria Digimon su tcgcsv.com.
let priceCache = { map: null, fetchedAt: 0 };

async function fetchWithRetry(url, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetch(url, { headers: { 'User-Agent': 'VinylDex/1.0', Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise((resolve) => setTimeout(resolve, 800));
    }
  }
  throw lastErr;
}

async function buildPriceMap() {
  const map = new Map();
  const groupsRes = await fetchWithRetry(`https://tcgcsv.com/tcgplayer/${TCGCSV_CATEGORY_ID}/groups`);
  if (!groupsRes.ok) throw new Error(`tcgcsv_groups_${groupsRes.status}`);
  const groupsBody = await groupsRes.json();
  const groups = (groupsBody.results || []).filter((g) => !g.isSupplemental);

  // Le richieste sono fatte in piccoli lotti concorrenti per non impiegare troppo tempo (~100
  // gruppi) né sovraccaricare tcgcsv.com con troppe richieste simultanee.
  const CONCURRENCY = 8;
  for (let i = 0; i < groups.length; i += CONCURRENCY) {
    const batch = groups.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (g) => {
      try {
        const res = await fetchWithRetry(`https://tcgcsv.com/tcgplayer/${TCGCSV_CATEGORY_ID}/${g.groupId}/prices`);
        if (!res.ok) return;
        const body = await res.json();
        (body.results || []).forEach((p) => {
          const val = p.marketPrice || p.midPrice;
          if (val > 0) map.set(p.productId, val);
        });
      } catch { /* un gruppo mancante non blocca gli altri: i prezzi sono un arricchimento best-effort */ }
    }));
  }
  return map;
}

async function getPriceMap() {
  const isStale = !priceCache.map || (Date.now() - priceCache.fetchedAt) > PRICE_CACHE_TTL_MS;
  if (isStale) {
    try {
      priceCache = { map: await buildPriceMap(), fetchedAt: Date.now() };
    } catch {
      // tcgcsv non raggiungibile: si ricade sul fallback per rarità, nessun crash dell'import.
      if (!priceCache.map) priceCache = { map: new Map(), fetchedAt: Date.now() };
    }
  }
  return priceCache.map;
}

// Fallback usato solo quando la carta non ha alcun prezzo di mercato disponibile
// (rarità dichiarata dalla fonte, non riflette necessariamente il valore reale).
function mapRarityFallback(raw) {
  const r = (raw || '').toLowerCase();
  if (r === 'sec' || r === 'ur') return 'legendary';
  if (r === 'sr') return 'epic';
  if (r === 'r') return 'rare';
  if (r === 'u') return 'uncommon';
  return 'common';
}

function normalize(card, priceMap) {
  const price = priceMap.get(card.tcgplayer_id) || null;
  return {
    externalId: card.id,
    code: `digimon-${card.id}`,
    name: card.name,
    setName: Array.isArray(card.set_name) ? card.set_name[0] : (card.set_name || null),
    setCode: card.id?.split('-')?.[0] || null,
    number: card.id || null,
    rarity: rarityFromPrice(SOURCE, price) || mapRarityFallback(card.rarity),
    imgUrl: `https://images.digimoncard.io/images/cards/${card.id}.jpg`,
    description: card.main_effect || card.source_effect || null,
    metadata: { color: card.color || null, type: card.type || null, dp: card.dp || null, playCost: card.play_cost || null, marketPrice: price }
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
    const priceMap = await getPriceMap();
    const normalized = slice.map((c) => normalize(c, priceMap));
    const imported = await persistImportedCards(SOURCE, normalized);
    return { source: SOURCE, imported, usedFallback: false, totalAvailable: uniqueById.length };
  } catch (err) {
    const imported = await persistImportedCards(SOURCE, DEMO_CARDS.map((c) => ({ ...c, code: `digimon-${c.externalId}`, metadata: { demo: true } })), err.message);
    return { source: SOURCE, imported, usedFallback: true, error: err.message };
  }
}

module.exports = { importDigimonCards };
