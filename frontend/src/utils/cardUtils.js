import { BASE_URL } from '../services/apiClient.js';
/**
 * Utilità pure per la rappresentazione di una carta (rarità, stelle, punteggio).
 * Le carte sono semplici oggetti dati (non classi), coerenti col DTO restituito dal backend.
 */

export const RARITIES = {
  common: { id: 1, name: 'Comune', stars: 1, color: '#9CA3AF' },
  uncommon: { id: 2, name: 'Non Comune', stars: 2, color: '#4CAF50' },
  rare: { id: 3, name: 'Rara', stars: 3, color: '#2196F3' },
  epic: { id: 4, name: 'Epica', stars: 4, color: '#8B5CF6' },
  legendary: { id: 5, name: 'Leggendaria', stars: 5, color: '#FFD700' }
};

// Icone gemma SVG dedicate per rarità (frontend/public/*.svg), già colorate internamente
// (gradiente proprio per tier): niente più icone font generiche colorate via CSS.
const RARITY_ICONS = { common: '/common.svg', uncommon: '/uncommon.svg', rare: '/rare.svg', epic: '/epic.svg', legendary: '/legendary.svg' };

// Etichette leggibili per la provenienza di una carta (originali VinylDex + import da API esterne).
export const SOURCE_LABELS = {
  original: 'VinylDex',
  pokemon: 'Pokémon TCG',
  scryfall: 'Magic (Scryfall)',
  yugioh: 'Yu-Gi-Oh!',
  onepiece: 'One Piece TCG',
  digimon: 'Digimon Card Game',
  lorcana: 'Disney Lorcana',
  riftbound: 'Riftbound (LoL TCG)',
  nikke: 'NIKKE (Union Arena)',
  cyberpunk: 'Cyberpunk TCG',
  hololive: 'hololive OFFICIAL CARD GAME',
  unionarena: 'Union Arena (anime)',
  shadowverse: 'Shadowverse: Evolve',
  wixoss: 'WIXOSS',
  grandarchive: 'Grand Archive',
  weiss: 'Weiss Schwarz',
  vanguard: 'Cardfight!! Vanguard',
  gundam: 'Gundam Card Game',
  dragonball: 'Dragon Ball Super CCG',
  fc27: 'EA FC 27 Ultimate Team',
  pokemonjp: 'Pokémon (Giappone)',
  pokemonpromo: 'Pokémon promo e speciali',
  nba: 'NBA'
};

export function getSourceLabel(source) {
  return SOURCE_LABELS[source] || source;
}

// Prezzo di mercato reale (USD) usato per calibrare la rarità delle carte importate da fonti con
// dati di prezzo affidabili (Pokémon, Magic, Yu-Gi-Oh!, One Piece, Dragon Ball, Digimon, NIKKE). Le carte
// originali VinylDex e quelle da fonti senza dati di prezzo (Lorcana/Gundam/Riftbound) non ce l'hanno.
const marketPriceFormatter = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
export function formatMarketPrice(marketPrice) {
  if (!(marketPrice > 0)) return null;
  return marketPriceFormatter.format(marketPrice);
}

export function getRarityData(rarity) {
  return RARITIES[rarity] || RARITIES.common;
}

export function getRarityColor(rarity) {
  return getRarityData(rarity).color;
}

export function getRarityName(rarity) {
  return getRarityData(rarity).name;
}

export function getStars(rarity) {
  return getRarityData(rarity).stars;
}

export function getRarityIcon(rarity) {
  return RARITY_ICONS[rarity] || RARITY_ICONS.common;
}

export function getRarityCSSClass(rarity) {
  return `card-rarity-${rarity}`;
}

export function getTotalScore(card) {
  const s = card.stats || {};
  return (s.fans || 0) + (s.style || 0) + (s.influence || 0) + (s.energy || 0);
}

export function placeholderImage(card) {
  const color = getRarityColor(card.rarity).replace('#', '');
  const initial = (card.name || '?').charAt(0).toUpperCase();
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 280'%3E%3Crect width='200' height='280' fill='%23111B3D'/%3E%3Ccircle cx='100' cy='100' r='60' fill='%23${color}' opacity='0.3'/%3E%3Ctext x='100' y='115' text-anchor='middle' fill='%23${color}' font-size='48' font-weight='bold' font-family='sans-serif'%3E${initial}%3C/text%3E%3C/svg%3E`;
}

export function resolveCardImage(card) {
  // Carte EA FC 27: la carta in stile Ultimate Team la disegna il backend (con la foto, se c'e').
  if (card.source === 'fc27' && !card.img) return fcCardImage(card);
  // Carte NBA: disegnate dal backend (NbaCardArtController) con la foto del giocatore.
  if (card.source === 'nba' && !card.img) return `${BASE_URL}/cards/${encodeURIComponent(card.id)}/nba-card.svg?v=1`;
  return card.img || placeholderImage(card);
}

/** URL della carta EA FC 27 disegnata dal backend (FcCardArtController). */
export function fcCardImage(card) {
  // ?v= cambia quando cambia il disegno: il browser tiene le carte in cache per un giorno.
  return `${BASE_URL}/cards/${encodeURIComponent(card.id)}/fc-card.svg?v=2`;
}

const coinFormatter = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 });

/** Prezzo in crediti di Ultimate Team delle carte EA FC 27, per esempio "1.750.000 crediti". */
export function formatCoins(coinPrice) {
  if (!(coinPrice > 0)) return null;
  return `${coinFormatter.format(coinPrice)} crediti`;
}

/**
 * Prezzo da mostrare per una carta: in crediti per le carte EA FC 27 (con l'equivalente in dollari
 * usato dal resto del gioco), altrimenti il prezzo di mercato in dollari.
 */
export function formatCardPrice(card) {
  const coins = formatCoins(card?.coinPrice);
  const usd = formatMarketPrice(card?.marketPrice);
  if (coins) return usd ? `${coins} (≈ ${usd})` : coins;
  return usd;
}

export const RARITY_ORDER = { legendary: 5, epic: 4, rare: 3, uncommon: 2, common: 1 };

/** Rarita' minima perche' una carta valga un'evidenziazione: sotto non c'e' niente da festeggiare. */
export const BEST_CARD_MIN_RARITY = RARITY_ORDER.rare;

/**
 * Indice della carta piu' rara di un elenco, oppure -1 se nessuna raggiunge la soglia.
 * A parita' vince la prima: e' quella che l'utente ha visto per prima e a cui associa
 * il colpo di fortuna.
 */
export function findBestCardIndex(cards) {
  let index = -1;
  let bestWeight = -1;

  (cards || []).forEach((card, i) => {
    const weight = RARITY_ORDER[card.rarity] || 0;
    if (weight > bestWeight) {
      bestWeight = weight;
      index = i;
    }
  });

  return bestWeight >= BEST_CARD_MIN_RARITY ? index : -1;
}
