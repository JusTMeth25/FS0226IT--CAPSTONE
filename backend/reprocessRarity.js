// Ricalcola la rarità delle carte già importate (Pokemon, Scryfall/Magic, Yu-Gi-Oh!, One Piece,
// Dragon Ball, Digimon) in base al prezzo di mercato reale, con la stessa logica/soglie usate
// dagli importer per le nuove carte (vedi src/services/importers/priceRarity.js). Lorcana, Gundam
// e Riftbound restano esclusi: non esiste per loro una fonte di prezzo incrociabile affidabile,
// quindi mantengono la rarità ufficiale nativa già assegnata in fase di import.
//
// Uso: node reprocessRarity.js [source1,source2,...]  (default: tutte e 6 le fonti supportate)
const prisma = require('./src/prismaClient');
const { rarityFromPrice } = require('./src/services/importers/priceRarity');

const HEADERS = { 'User-Agent': 'VinylDex/1.0', Accept: 'application/json' };

async function fetchWithRetry(url, opts = {}, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15000), ...opts });
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 800));
    }
  }
  throw lastErr;
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** Costruisce productId -> prezzo di mercato per un'intera categoria tcgcsv.com (tutti i gruppi). */
async function buildTcgcsvPriceMap(categoryId) {
  const map = new Map();
  const groupsRes = await fetchWithRetry(`https://tcgcsv.com/tcgplayer/${categoryId}/groups`);
  if (!groupsRes.ok) throw new Error(`tcgcsv_groups_${groupsRes.status}`);
  const groups = (await groupsRes.json()).results || [];
  await mapLimit(groups, 8, async (g) => {
    try {
      const res = await fetchWithRetry(`https://tcgcsv.com/tcgplayer/${categoryId}/${g.groupId}/prices`);
      if (!res.ok) return;
      const body = await res.json();
      (body.results || []).forEach((p) => {
        const val = p.marketPrice || p.midPrice;
        if (val > 0) map.set(p.productId, val);
      });
    } catch { /* un gruppo mancante non blocca gli altri */ }
  });
  return map;
}

async function loadActiveCards(source) {
  const cards = await prisma.card.findMany({ where: { source } });
  return cards.filter((c) => !c.metadata?.demo);
}

async function applyUpdate(card, price, source) {
  const newRarity = rarityFromPrice(source, price);
  if (!newRarity) return { updated: false };
  const metadata = { ...(card.metadata || {}), marketPrice: price };
  const changed = newRarity !== card.rarity;
  await prisma.card.update({ where: { id: card.id }, data: { rarity: newRarity, metadata } });
  return { updated: true, changed, from: card.rarity, to: newRarity };
}

async function reprocessPokemon() {
  const source = 'pokemon';
  const cards = await loadActiveCards(source);
  const headers = { ...HEADERS };
  if (process.env.POKEMONTCG_API_KEY) headers['X-Api-Key'] = process.env.POKEMONTCG_API_KEY;
  let updated = 0, changed = 0, noPrice = 0;
  await mapLimit(cards, 5, async (card) => {
    try {
      const res = await fetchWithRetry(`https://api.pokemontcg.io/v2/cards/${card.externalId}`, { headers });
      if (!res.ok) { noPrice++; return; }
      const body = await res.json();
      const variants = body.data?.tcgplayer?.prices;
      let price = 0;
      if (variants) Object.keys(variants).forEach((k) => { price = Math.max(price, variants[k]?.market ?? variants[k]?.mid ?? 0); });
      if (!(price > 0)) { noPrice++; return; }
      const r = await applyUpdate(card, price, source);
      if (r.updated) updated++;
      if (r.changed) changed++;
    } catch { noPrice++; }
  });
  return { source, total: cards.length, updated, changed, noPrice };
}

// Scryfall applica rate limiting aggressivo (429) su richieste concorrenti o troppo ravvicinate:
// a differenza degli altri fetch, qui si procede in serie con una piccola pausa tra le richieste
// e si riprova sui 429 con backoff crescente invece di trattarli come "nessun prezzo".
async function fetchScryfallCard(id, attempts = 5) {
  for (let i = 0; i < attempts; i++) {
    const res = await fetchWithRetry(`https://api.scryfall.com/cards/${id}`);
    if (res.status === 429) { await new Promise((r) => setTimeout(r, 500 * (i + 1))); continue; }
    return res;
  }
  return null;
}

async function reprocessScryfall() {
  const source = 'scryfall';
  const cards = await loadActiveCards(source);
  let updated = 0, changed = 0, noPrice = 0;
  for (const card of cards) {
    try {
      const res = await fetchScryfallCard(card.externalId);
      if (!res || !res.ok) { noPrice++; continue; }
      const body = await res.json();
      const price = parseFloat(body.prices?.usd) || parseFloat(body.prices?.usd_foil) || 0;
      if (!(price > 0)) { noPrice++; continue; }
      const r = await applyUpdate(card, price, source);
      if (r.updated) updated++;
      if (r.changed) changed++;
    } catch { noPrice++; }
    await new Promise((r) => setTimeout(r, 100));
  }
  return { source, total: cards.length, updated, changed, noPrice };
}

async function reprocessYugioh() {
  const source = 'yugioh';
  const cards = await loadActiveCards(source);
  const byId = new Map(cards.map((c) => [c.externalId, c]));
  const ids = cards.map((c) => c.externalId);
  let updated = 0, changed = 0, noPrice = 0;
  const CHUNK = 20;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    try {
      const res = await fetchWithRetry(`https://db.ygoprodeck.com/api/v7/cardinfo.php?id=${chunk.join(',')}`);
      if (!res.ok) { noPrice += chunk.length; continue; }
      const body = await res.json();
      const byCardId = new Map((body.data || []).map((c) => [String(c.id), c]));
      for (const extId of chunk) {
        const card = byId.get(extId);
        const apiCard = byCardId.get(extId);
        const prices = apiCard?.card_prices?.[0];
        const price = parseFloat(prices?.tcgplayer_price) || parseFloat(prices?.cardmarket_price) || 0;
        if (!(price > 0)) { noPrice++; continue; }
        const r = await applyUpdate(card, price, source);
        if (r.updated) updated++;
        if (r.changed) changed++;
      }
    } catch { noPrice += chunk.length; }
  }
  return { source, total: cards.length, updated, changed, noPrice };
}

async function reprocessOnePiece() {
  const source = 'onepiece';
  const cards = await loadActiveCards(source);
  let updated = 0, changed = 0, noPrice = 0;
  try {
    const res = await fetchWithRetry('https://www.optcgapi.com/api/allSetCards/', {}, 3);
    const all = await res.json();
    const priceByFilename = new Map();
    all.forEach((c) => {
      const file = (c.card_image || '').split('/').pop()?.replace(/\.[a-z]+$/i, '');
      if (file && c.market_price > 0) priceByFilename.set(file, c.market_price);
    });
    for (const card of cards) {
      const price = priceByFilename.get(card.externalId) || 0;
      if (!(price > 0)) { noPrice++; continue; }
      const r = await applyUpdate(card, price, source);
      if (r.updated) updated++;
      if (r.changed) changed++;
    }
  } catch (err) {
    return { source, total: cards.length, updated, changed, noPrice: cards.length, error: err.message };
  }
  return { source, total: cards.length, updated, changed, noPrice };
}

async function reprocessDragonBall() {
  const source = 'dragonball';
  const cards = await loadActiveCards(source);
  let updated = 0, changed = 0, noPrice = 0;
  try {
    const priceMap = await buildTcgcsvPriceMap(27);
    for (const card of cards) {
      const price = priceMap.get(Number(card.externalId)) || 0;
      if (!(price > 0)) { noPrice++; continue; }
      const r = await applyUpdate(card, price, source);
      if (r.updated) updated++;
      if (r.changed) changed++;
    }
  } catch (err) {
    return { source, total: cards.length, updated, changed, noPrice: cards.length, error: err.message };
  }
  return { source, total: cards.length, updated, changed, noPrice };
}

async function reprocessDigimon() {
  const source = 'digimon';
  const cards = await loadActiveCards(source);
  let updated = 0, changed = 0, noPrice = 0;
  try {
    const res = await fetchWithRetry('https://digimoncard.io/api-public/search.php?series=Digimon%20Card%20Game&sort=name&sortdirection=asc', {}, 3);
    const all = await res.json();
    const tcgplayerIdByCardId = new Map(all.map((c) => [c.id, c.tcgplayer_id]));
    const priceMap = await buildTcgcsvPriceMap(63);
    for (const card of cards) {
      const productId = tcgplayerIdByCardId.get(card.externalId);
      const price = (productId && priceMap.get(productId)) || 0;
      if (!(price > 0)) { noPrice++; continue; }
      const r = await applyUpdate(card, price, source);
      if (r.updated) updated++;
      if (r.changed) changed++;
    }
  } catch (err) {
    return { source, total: cards.length, updated, changed, noPrice: cards.length, error: err.message };
  }
  return { source, total: cards.length, updated, changed, noPrice };
}

const REPROCESSORS = {
  pokemon: reprocessPokemon,
  scryfall: reprocessScryfall,
  yugioh: reprocessYugioh,
  onepiece: reprocessOnePiece,
  dragonball: reprocessDragonBall,
  digimon: reprocessDigimon
};

async function main() {
  const requested = process.argv[2] ? process.argv[2].split(',') : Object.keys(REPROCESSORS);
  for (const source of requested) {
    const fn = REPROCESSORS[source];
    if (!fn) { console.log(`fonte sconosciuta: ${source}`); continue; }
    console.log(`\n--- ${source} ---`);
    const result = await fn();
    console.log(result);
  }
  await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
