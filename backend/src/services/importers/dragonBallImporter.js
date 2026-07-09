const { persistImportedCards } = require('./importCommon');

const SOURCE = 'dragonball';
const CATEGORY_ID = 27; // Dragon Ball Super CCG su tcgcsv.com (mirror pubblico dei dati TCGPlayer)

const DEMO_CARDS = [
  { externalId: 'demo-goku', name: 'Son Goku (demo)', setName: 'Demo Set', number: '1', rarity: 'legendary', imgUrl: '', description: 'Carta demo (TCGPlayer non raggiungibile).' },
  { externalId: 'demo-vegeta', name: 'Vegeta (demo)', setName: 'Demo Set', number: '2', rarity: 'rare', imgUrl: '', description: 'Carta demo (TCGPlayer non raggiungibile).' }
];

// Rarità reali osservate su tcgcsv.com: Common/Uncommon/Rare/Super Rare/Secret Rare/
// Special Rare/Special Leader Rare/God Rare/Concept Rare/None (carte senza indicazione, es. leader).
function mapRarity(raw) {
  const r = (raw || '').toLowerCase();
  if (r.includes('secret') || r.includes('special') || r.includes('god') || r.includes('concept')) return 'legendary';
  if (r.includes('super')) return 'epic';
  if (r === 'rare') return 'rare';
  if (r.includes('uncommon')) return 'uncommon';
  return 'common';
}

// tcgcsv.com droppa la connessione in modo intermittente (osservato empiricamente, non un vero
// blocco: gli stessi URL rispondono 200 al tentativo successivo) — un paio di retry con piccolo
// backoff rendono l'import affidabile senza dover ricorrere subito al fallback demo.
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

function getField(product, name) {
  const field = (product.extendedData || []).find((f) => f.name === name);
  return field ? field.value : null;
}

// tcgcsv.com restituisce di default la miniatura "_200w" (~200px, visibilmente sgranata a schermo
// intero). TCGPlayer serve anche "_400w" per lo stesso productId (verificato: 600w/800w/1000w e la
// versione senza suffisso rispondono 403, quindi 400w è la risoluzione massima realmente disponibile).
function upscaleImage(url) {
  return url ? url.replace(/_200w\.jpg$/i, '_400w.jpg') : url;
}

function normalize(product, setName) {
  return {
    externalId: String(product.productId),
    code: `dragonball-${product.productId}`,
    name: product.name,
    setName: setName || null,
    setCode: null,
    number: getField(product, 'Number'),
    rarity: mapRarity(getField(product, 'Rarity')),
    imgUrl: upscaleImage(product.imageUrl) || '',
    description: (getField(product, 'Description') || '').replace(/<br\s*\/?>/gi, '\n').replace(/\r\n/g, '\n').trim() || null,
    metadata: {
      color: getField(product, 'Color'),
      cardType: getField(product, 'CardType'),
      power: getField(product, 'Power'),
      energyCost: getField(product, 'EnergyColor Cost')
    }
  };
}

/**
 * tcgcsv.com non ha un endpoint "tutte le carte" con limit/page: bisogna prima elencare i set
 * (gruppi) della categoria, sceglierne uno a caso, poi leggerne le carte. I prodotti sigillati
 * (booster box/pack, display, starter deck) compaiono nello stesso gruppo delle singole: si
 * riconoscono perché hanno Rarity="None" (valore letterale, non campo assente) e nessun "Number".
 */
async function importDragonBallCards(opts = {}) {
  const limit = Math.min(opts.limit || 100, 200);

  try {
    const groupsRes = await fetchWithRetry(`https://tcgcsv.com/tcgplayer/${CATEGORY_ID}/groups`);
    if (!groupsRes.ok) throw new Error(`tcgcsv_groups_${groupsRes.status}`);
    const groupsBody = await groupsRes.json();
    // I set promozionali/oversize storici hanno spesso scan mancanti su TCGPlayer (verificato
    // empiricamente su "Oversized Cards": ~60% di immagini 403). Si escludono dalla selezione
    // casuale, restano solo i booster set numerati regolari con copertura immagini affidabile.
    const groups = (groupsBody.results || []).filter((g) => !g.isSupplemental && !/oversized|promotion|anniversary|pre-release/i.test(g.name));
    if (!groups.length) throw new Error('tcgcsv_no_groups');
    const group = opts.groupId
      ? groups.find((g) => g.groupId === opts.groupId) || groups[0]
      : groups[Math.floor(Math.random() * groups.length)];

    const productsRes = await fetchWithRetry(`https://tcgcsv.com/tcgplayer/${CATEGORY_ID}/${group.groupId}/products`);
    if (!productsRes.ok) throw new Error(`tcgcsv_products_${productsRes.status}`);
    const productsBody = await productsRes.json();
    const singles = (productsBody.results || []).filter((p) => {
      const rarity = getField(p, 'Rarity');
      return rarity && rarity !== 'None' && getField(p, 'Number');
    });
    const normalized = singles.slice(0, limit).map((p) => normalize(p, group.name));
    const imported = await persistImportedCards(SOURCE, normalized);
    return { source: SOURCE, imported, usedFallback: false, set: group.name, totalAvailable: singles.length };
  } catch (err) {
    const imported = await persistImportedCards(SOURCE, DEMO_CARDS.map((c) => ({ ...c, code: `dragonball-${c.externalId}`, metadata: { demo: true } })), err.message);
    return { source: SOURCE, imported, usedFallback: true, error: err.message };
  }
}

module.exports = { importDragonBallCards };
