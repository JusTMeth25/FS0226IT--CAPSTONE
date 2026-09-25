/**
 * Aspetto dei pacchetti, condiviso fra la pagina Pacchetti e l'hotel (edicola e borsa).
 */
export const PACK_ICON = { 'pack-base': 'ph-gift', 'pack-deluxe': 'ph-diamond', 'pack-premium': 'ph-crown' };

export const PACK_GRADIENT = {
  'pack-base': 'linear-gradient(135deg, var(--neon-purple), var(--neon-magenta))',
  'pack-deluxe': 'linear-gradient(135deg, var(--neon-blue), var(--neon-cyan))',
  'pack-premium': 'linear-gradient(135deg, #FFD700, #FFA500)'
};

// Artwork dedicata per pacchetto (se assente si usa icona + gradient come fallback).
export const PACK_IMAGE = {
  'pack-base': '/assets/img/BasePack.png',
  'pack-deluxe': '/assets/img/DeluxePack.png',
  'pack-premium': '/assets/img/PremiumPack.png'
};

// Intensità dell'effetto tilt/holo sui pacchetti, mappata su una rarità equivalente per tier.
export const PACK_TILT_RARITY = { 'pack-base': 'rare', 'pack-deluxe': 'epic', 'pack-premium': 'legendary' };
