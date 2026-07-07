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

const RARITY_ICONS = { common: 'circle', uncommon: 'shield', rare: 'diamond', epic: 'fire', legendary: 'crown' };

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
  gundam: 'Gundam Card Game'
};

export function getSourceLabel(source) {
  return SOURCE_LABELS[source] || source;
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
  return RARITY_ICONS[rarity] || 'circle';
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
  return card.img || placeholderImage(card);
}

export const RARITY_ORDER = { legendary: 5, epic: 4, rare: 3, uncommon: 2, common: 1 };
