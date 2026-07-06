// Carte con un tilt "a molla" più pronunciato (ispirato a TiltedCard di React Bits):
// stessa meccanica di useCardTilt, solo con un'easing più elastica e un pop più marcato.
const SPRING_TILT_CARD_IDS = new Set(['rebel-001']);

export function getTiltVariant(card) {
  return card && SPRING_TILT_CARD_IDS.has(card.id) ? 'spring' : null;
}
