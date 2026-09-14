import { getRarityColor } from '../../utils/cardUtils.js';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';

/**
 * Palcoscenico dietro alla carta rivelata.
 *
 * L'intensita' cresce con la rarita': una comune riceve un alone appena accennato, una
 * leggendaria raggi rotanti, lampo e scossa. E' la messinscena a dire quanto vale la carta
 * prima ancora di leggerla.
 *
 * Gli strati stanno dietro al contenuto e non lo intercettano mai: la carta resta cliccabile
 * per passare alla successiva.
 */
const TIERS = {
  common: { rays: false, flash: false, shake: false, glow: 0.18 },
  uncommon: { rays: false, flash: false, shake: false, glow: 0.26 },
  rare: { rays: true, flash: false, shake: false, glow: 0.38 },
  epic: { rays: true, flash: true, shake: false, glow: 0.52 },
  legendary: { rays: true, flash: true, shake: true, glow: 0.7 }
};

export default function RevealStage({ rarity, children }) {
  const reduced = useReducedMotion();
  const tier = TIERS[rarity] || TIERS.common;
  const color = getRarityColor(rarity);

  // Con "riduci animazioni" resta solo l'alone statico: e' l'informazione (quanto e' rara
  // questa carta), non la coreografia.
  const classes = [
    'reveal-stage',
    `reveal-stage-${rarity}`,
    !reduced && tier.shake ? 'reveal-stage-shake' : ''
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} style={{ '--rarity-color': color, '--glow-strength': tier.glow }}>
      {!reduced && tier.rays && <span className="reveal-stage-rays" aria-hidden="true" />}
      <span className="reveal-stage-glow" aria-hidden="true" />
      {!reduced && tier.flash && <span className="reveal-stage-flash" aria-hidden="true" />}
      <div className="reveal-stage-content">{children}</div>
    </div>
  );
}
