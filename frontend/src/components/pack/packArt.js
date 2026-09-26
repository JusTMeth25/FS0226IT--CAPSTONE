/**
 * Aspetto dei pacchetti, condiviso fra la pagina Pacchetti e l'hotel (edicola e borsa).
 */
export const PACK_ICON = { 'pack-base': 'ph-gift', 'pack-deluxe': 'ph-diamond', 'pack-premium': 'ph-crown', 'pack-ultimate': 'ph-soccer-ball' };

export const PACK_GRADIENT = {
  'pack-base': 'linear-gradient(135deg, var(--neon-purple), var(--neon-magenta))',
  'pack-deluxe': 'linear-gradient(135deg, var(--neon-blue), var(--neon-cyan))',
  'pack-premium': 'linear-gradient(135deg, #FFD700, #FFA500)',
  'pack-ultimate': 'linear-gradient(135deg, #15803d, #052e1a)'
};

// Artwork dedicata per pacchetto (se assente si usa icona + gradient come fallback).
export const PACK_IMAGE = {
  'pack-base': '/assets/img/BasePack.png',
  'pack-deluxe': '/assets/img/DeluxePack.png',
  'pack-premium': '/assets/img/PremiumPack.png',
  'pack-ultimate': '/assets/img/UltimatePack.svg'
};

// Intensità dell'effetto tilt/holo sui pacchetti, mappata su una rarità equivalente per tier.
export const PACK_TILT_RARITY = { 'pack-base': 'rare', 'pack-deluxe': 'epic', 'pack-premium': 'legendary', 'pack-ultimate': 'epic' };
