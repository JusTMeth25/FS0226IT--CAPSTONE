/**
 * Aspetto dei pacchetti, condiviso fra la pagina Pacchetti e l'hotel (edicola e borsa).
 */
import { CARD_BACKS } from '../../utils/cardBacks.js';

/** Pacchetti di un solo gioco (V16): icona e colori (chiaro, scuro) del gioco. */
const GAME_PACKS = {
  pokemon: ['ph-lightning', '#ffcb05', '#2a4d9b'],
  yugioh: ['ph-eye', '#b388ff', '#1a0b2e'],
  scryfall: ['ph-magic-wand', '#f0a35e', '#3b1f12'],
  onepiece: ['ph-anchor', '#ff6b6b', '#1d3557'],
  dragonball: ['ph-star-four', '#ffb703', '#9d0208'],
  digimon: ['ph-cpu', '#4fc3f7', '#0d2b5c'],
  lorcana: ['ph-sparkle', '#e9c46a', '#2b1d5c'],
  riftbound: ['ph-sword', '#5eead4', '#0b2530'],
  nikke: ['ph-crosshair', '#fb7185', '#1b1f2a'],
  cyberpunk: ['ph-circuitry', '#fcee0a', '#0b0b12'],
  hololive: ['ph-microphone-stage', '#7dd3fc', '#0c4a6e'],
  unionarena: ['ph-fire', '#fb923c', '#1c1917'],
  shadowverse: ['ph-moon-stars', '#c4b5fd', '#1e1b4b'],
  wixoss: ['ph-flower-lotus', '#f9a8d4', '#3b0764'],
  grandarchive: ['ph-book-bookmark', '#5eead4', '#134e4a'],
  weiss: ['ph-yin-yang', '#f5f5f5', '#111111'],
  vanguard: ['ph-shield-chevron', '#93c5fd', '#172554'],
  nba: ['ph-basketball', '#fca5a5', '#0b1e3f'],
  gundam: ['ph-robot', '#93c5fd', '#7f1d1d'],
  original: ['ph-vinyl-record', '#e879f9', '#2e0b3a']
};

function gamePacks(pick) {
  return Object.fromEntries(Object.entries(GAME_PACKS).map(([source, art]) => [`pack-${source}`, pick(source, art)]));
}

export const PACK_ICON = {
  'pack-base': 'ph-gift',
  'pack-deluxe': 'ph-diamond',
  'pack-premium': 'ph-crown',
  'pack-ultimate': 'ph-soccer-ball',
  'pack-weekend': 'ph-calendar-star',
  ...gamePacks((source, [icon]) => icon)
};

export const PACK_GRADIENT = {
  'pack-base': 'linear-gradient(135deg, var(--neon-purple), var(--neon-magenta))',
  'pack-deluxe': 'linear-gradient(135deg, var(--neon-blue), var(--neon-cyan))',
  'pack-premium': 'linear-gradient(135deg, #FFD700, #FFA500)',
  'pack-ultimate': 'linear-gradient(135deg, #15803d, #052e1a)',
  'pack-weekend': 'linear-gradient(135deg, #f43f5e, #f59e0b 60%, #7c3aed)',
  ...gamePacks((source, [, light, dark]) => `linear-gradient(135deg, ${light}, ${dark})`)
};

// Artwork dedicata per pacchetto (se assente si usa icona + gradient come fallback).
export const PACK_IMAGE = {
  'pack-base': '/assets/img/BasePack.webp',
  'pack-deluxe': '/assets/img/DeluxePack.webp',
  'pack-premium': '/assets/img/PremiumPack.webp',
  // Il pacchetto del weekend: la grafica del Deluxe nei colori del tramonto, con il suo titolo.
  'pack-weekend': '/assets/img/WeekendPack.webp',
  // I pacchetti di un solo gioco hanno come grafica il dorso delle carte di quel gioco
  // (VinylDex Originali non ha un dorso in file: resta la grafica disegnata).
  'pack-ultimate': CARD_BACKS.fc27,
  ...gamePacks((source) => CARD_BACKS[source] || `/assets/img/packs/${source}.svg`)
};

// Intensità dell'effetto tilt/holo sui pacchetti, mappata su una rarità equivalente per tier.
export const PACK_TILT_RARITY = {
  'pack-base': 'rare',
  'pack-deluxe': 'epic',
  'pack-premium': 'legendary',
  'pack-weekend': 'epic',
  'pack-ultimate': 'epic',
  ...gamePacks(() => 'rare')
};
