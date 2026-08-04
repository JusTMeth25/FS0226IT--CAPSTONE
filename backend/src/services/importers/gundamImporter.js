const { persistImportedCards } = require('./importCommon');

const SOURCE = 'gundam';

const DEMO_CARDS = [
  { externalId: 'demo-rx78', name: 'RX-78-2 Gundam (demo)', setName: 'Demo Set', number: '1', rarity: 'legendary', imgUrl: '', description: 'Carta demo (API TCG Gundam non configurata o non raggiungibile).' },
  { externalId: 'demo-zaku', name: 'Zaku II (demo)', setName: 'Demo Set', number: '2', rarity: 'common', imgUrl: '', description: 'Carta demo (API TCG Gundam non configurata o non raggiungibile).' }
];

// L'API restituisce codici brevi (con spazi/suffissi "+"/"++" per le varianti foil, es. "LR   +"),
// non parole intere: "LR" (Legend Rare, il tier più alto) / "P" (promo) / "R" / "U" / "C".
function mapRarity(raw) {
  const r = (raw || '').trim().toUpperCase();
  if (r.startsWith('LR')) return 'legendary';
  if (r.startsWith('P')) return 'epic';
  if (r.startsWith('R')) return 'rare';
  if (r.startsWith('U')) return 'uncommon';
  return 'common';
}

function blank(v) {
  return v == null || v === '-' ? null : v;
}

function normalize(card) {
  return {
    externalId: card.id || card.code,
    code: `gundam-${card.id || card.code}`,
    name: card.name,
    setName: card.set?.name || null,
    setCode: card.set?.id || null,
    number: card.code || null,
    rarity: mapRarity(card.rarity),
    imgUrl: card.images?.large || card.images?.small || '',
    description: (card.effect || '').replace(/<br\s*\/?>/gi, '\n').trim() || null,
    metadata: { color: blank(card.color), cardType: blank(card.cardType), ap: blank(card.ap), hp: blank(card.hp) }
  };
}

/**
 * apitcg.com richiede una API key personale (registrazione su apitcg.com/platform, gratuita ma
 * non ottenibile in automatico): senza `APITCG_API_KEY` in .env si passa direttamente al fallback
 * demo, stesso comportamento delle altre fonti quando l'API esterna non è raggiungibile.
 */
async function importGundamCards(opts = {}) {
  const limit = Math.min(opts.limit || 100, 100);
  const apiKey = process.env.APITCG_API_KEY;

  try {
    if (!apiKey) throw new Error('apitcg_no_api_key');
    const headers = { 'x-api-key': apiKey, 'User-Agent': 'VinylDex/1.0', Accept: 'application/json' };

    const probe = await fetch(`https://apitcg.com/api/gundam/cards?limit=${limit}&page=1`, { headers, signal: AbortSignal.timeout(15000) });
    if (!probe.ok) throw new Error(`apitcg_gundam_${probe.status}`);
    const probeBody = await probe.json();
    const maxPage = Math.max(1, probeBody.totalPages || 1);
    const page = opts.page || Math.floor(Math.random() * maxPage) + 1;

    const res = page === 1 ? probe : await fetch(`https://apitcg.com/api/gundam/cards?limit=${limit}&page=${page}`, { headers, signal: AbortSignal.timeout(20000) });
    const body = page === 1 ? probeBody : await res.json();
    if (!res.ok) throw new Error(`apitcg_gundam_${res.status}`);
    const cards = body.data || body.cards || [];
    const normalized = cards.map(normalize);
    const imported = await persistImportedCards(SOURCE, normalized);
    return { source: SOURCE, imported, usedFallback: false, page, totalAvailable: body.total };
  } catch (err) {
    try {
      const imported = await persistImportedCards(SOURCE, DEMO_CARDS.map((c) => ({ ...c, code: `gundam-${c.externalId}`, metadata: { demo: true } })), err.message);
      return { source: SOURCE, imported, usedFallback: true, error: err.message };
    } catch (dbErr) {
      return { source: SOURCE, imported: 0, usedFallback: true, error: err.message, dbError: dbErr.message };
    }
  }
}

module.exports = { importGundamCards };
