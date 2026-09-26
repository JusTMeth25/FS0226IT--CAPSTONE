/**
 * Aspetto dei pacchetti, condiviso fra la pagina Pacchetti e l'hotel (edicola e borsa).
 */

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
  ...gamePacks((source, [icon]) => icon)
};

export const PACK_GRADIENT = {
  'pack-base': 'linear-gradient(135deg, var(--neon-purple), var(--neon-magenta))',
  'pack-deluxe': 'linear-gradient(135deg, var(--neon-blue), var(--neon-cyan))',
  'pack-premium': 'linear-gradient(135deg, #FFD700, #FFA500)',
  'pack-ultimate': 'linear-gradient(135deg, #15803d, #052e1a)',
  ...gamePacks((source, [, light, dark]) => `linear-gradient(135deg, ${light}, ${dark})`)
};

// Artwork dedicata per pacchetto (se assente si usa icona + gradient come fallback).
export const PACK_IMAGE = {
  'pack-base': '/assets/img/BasePack.png',
  'pack-deluxe': '/assets/img/DeluxePack.png',
  'pack-premium': '/assets/img/PremiumPack.png',
  'pack-ultimate': '/assets/img/UltimatePack.svg',
  ...gamePacks((source) => `/assets/img/packs/${source}.svg`)
};

// Intensità dell'effetto tilt/holo sui pacchetti, mappata su una rarità equivalente per tier.
export const PACK_TILT_RARITY = {
  'pack-base': 'rare',
  'pack-deluxe': 'epic',
  'pack-premium': 'legendary',
  'pack-ultimate': 'epic',
  ...gamePacks(() => 'rare')
};
