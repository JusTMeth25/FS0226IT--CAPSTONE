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

/**
 * @param {{ limit?: number, query?: string, page?: number }} [opts] - limit: max ~175 (dimensione
 * pagina Scryfall). `query` di default molto ampia (qualunque carta Magic reale dal 1993 ad oggi).
 * Se `page` non è specificato viene scelta una pagina casuale: Scryfall mette in cache le risposte
 * per query+pagina, quindi variare la pagina (non l'ordine) è ciò che dà risultati diversi ad ogni
 * click ripetuto dal pannello admin, invece di riscrivere sempre le stesse carte.
 */
async function importScryfallCards(opts = {}) {
  const limit = Math.min(opts.limit || 100, 175);
  const query = opts.query || 'year>=1993';
  const page = opts.page || Math.floor(Math.random() * 180) + 1;

  try {
    // Scryfall rifiuta le richieste con uno User-Agent generico da libreria HTTP:
    // richiede un User-Agent personalizzato che identifichi l'applicazione chiamante.
    const res = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&page=${page}`, {
      headers: { 'User-Agent': 'VinylLegends/1.0', Accept: 'application/json' },
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) throw new Error(`scryfall_api_${res.status}`);
    const body = await res.json();
    const normalized = (body.data || []).slice(0, limit).map(normalize);
    const imported = await persistImportedCards(SOURCE, normalized);
    return { source: SOURCE, imported, usedFallback: false, page, totalAvailable: body.total_cards };
  } catch (err) {
    const imported = await persistImportedCards(SOURCE, DEMO_CARDS.map((c) => ({ ...c, code: `scryfall-${c.externalId}`, metadata: { demo: true } })), err.message);
    return { source: SOURCE, imported, usedFallback: true, error: err.message };
  }
}

module.exports = { importScryfallCards };
