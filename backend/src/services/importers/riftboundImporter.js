const { persistImportedCards } = require('./importCommon');

const SOURCE = 'riftbound';

const DEMO_CARDS = [
  { externalId: 'demo-ahri', name: 'Ahri (demo)', setName: 'Demo Set', number: '1', rarity: 'legendary', imgUrl: '', description: 'Carta demo (API Riftcodex non raggiungibile).' },
  { externalId: 'demo-poro', name: 'Poro (demo)', setName: 'Demo Set', number: '2', rarity: 'common', imgUrl: '', description: 'Carta demo (API Riftcodex non raggiungibile).' }
];

function mapRarity(raw) {
  const r = (raw || '').toLowerCase();
  if (r === 'showcase' || r === 'overnumbered') return 'legendary';
  if (r === 'epic') return 'epic';
  if (r === 'rare') return 'rare';
  if (r === 'uncommon') return 'uncommon';
  return 'common';
}

function normalize(card) {
  return {
    externalId: card.id,
    code: `riftbound-${card.id}`,
    name: card.name,
    setName: card.set?.label || null,
    setCode: card.set?.set_id || null,
    number: card.collector_number != null ? String(card.collector_number) : null,
    rarity: mapRarity(card.classification?.rarity),
    imgUrl: card.media?.image_url || '',
    description: card.text?.plain || card.text?.flavour || null,
    metadata: { type: card.classification?.type || null, domain: card.classification?.domain || [], ...card.attributes }
  };
}

/**
 * L'API pagina realmente lato server ma ignora il parametro `limit`: la dimensione pagina è
 * sempre fissa (campo `size`, 50) e il numero di pagine reali è nel campo `pages` della risposta.
 * Si sceglie qui una pagina casuale tra quelle realmente disponibili, poi si taglia il risultato
 * a `limit` carte per restare coerenti con le altre fonti.
 */
async function importRiftboundCards(opts = {}) {
  const limit = Math.min(opts.limit || 100, 200);

  try {
    const probe = await fetch(`https://api.riftcodex.com/cards?page=1`, { signal: AbortSignal.timeout(15000) });
    if (!probe.ok) throw new Error(`riftcodex_api_${probe.status}`);
    const probeBody = await probe.json();
    const total = probeBody.total || 1000;
    const maxPage = Math.max(1, probeBody.pages || 1);
    const page = opts.page || Math.floor(Math.random() * maxPage) + 1;

    const res = await fetch(`https://api.riftcodex.com/cards?page=${page}`, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`riftcodex_api_${res.status}`);
    const body = await res.json();
    const normalized = (body.items || []).slice(0, limit).map(normalize);
    const imported = await persistImportedCards(SOURCE, normalized);
    return { source: SOURCE, imported, usedFallback: false, page, totalAvailable: total };
  } catch (err) {
    try {
      const imported = await persistImportedCards(SOURCE, DEMO_CARDS.map((c) => ({ ...c, code: `riftbound-${c.externalId}`, metadata: { demo: true } })), err.message);
      return { source: SOURCE, imported, usedFallback: true, error: err.message };
    } catch (dbErr) {
      return { source: SOURCE, imported: 0, usedFallback: true, error: err.message, dbError: dbErr.message };
    }
  }
}

module.exports = { importRiftboundCards };
