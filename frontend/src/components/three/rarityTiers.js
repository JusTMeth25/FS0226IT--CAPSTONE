/**
 * Quanto "rumore" fa ogni rarita' nelle scene 3D. Stessa logica di RevealStage: la messinscena
 * cresce con il valore della carta, cosi' si capisce cosa e' uscito prima di leggerlo.
 *
 * - holo: intensita' del foil iridescente (stessa scala di RevealStage.TIERS.glow)
 * - confetti / sparks: particelle dell'esplosione del pacchetto
 * - rays: raggi rotanti dietro al pacchetto
 * - shake: scossa della camera all'apertura
 * - aura: pulviscolo intorno alla carta nel dettaglio
 */
export const RARITY_TIERS = {
  common: { holo: 0.18, confetti: 160, sparks: 60, rays: false, shake: 0, aura: 18 },
  uncommon: { holo: 0.26, confetti: 220, sparks: 90, rays: false, shake: 0, aura: 26 },
  rare: { holo: 0.38, confetti: 320, sparks: 140, rays: true, shake: 0.02, aura: 40 },
  epic: { holo: 0.52, confetti: 480, sparks: 220, rays: true, shake: 0.05, aura: 60 },
  legendary: { holo: 0.7, confetti: 700, sparks: 360, rays: true, shake: 0.1, aura: 90 }
};

export function getTier(rarity) {
  return RARITY_TIERS[rarity] || RARITY_TIERS.common;
}
