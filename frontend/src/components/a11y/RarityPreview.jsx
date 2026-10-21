import { useAccessibility } from '../../hooks/useAccessibility.js';
import { RARITIES, getRarityColor, getRarityIcon, getRarityName } from '../../utils/cardUtils.js';

/**
 * Anteprima delle rarita' con i colori attivi (normali o della modalita' daltonismo scelta):
 * per ognuna icona, nome e campione di colore. Stili in styles/a11y-cvd.css.
 */
export default function RarityPreview() {
  // Letta solo per rirenderizzare quando cambia la modalita' daltonismo.
  const { cvd } = useAccessibility();

  return (
    <ul className="a11y-rarity-preview" data-cvd-mode={cvd || 'none'} aria-label="Anteprima dei colori delle rarita'">
      {Object.keys(RARITIES).map((rarity) => {
        const color = getRarityColor(rarity);
        return (
          <li key={rarity} className="a11y-rarity-preview-item" style={{ '--preview-color': color }}>
            <img className="a11y-rarity-preview-icon" src={getRarityIcon(rarity)} alt="" aria-hidden="true" />
            <span className="a11y-rarity-preview-name">{getRarityName(rarity)}</span>
            <span className="a11y-rarity-preview-swatch" aria-hidden="true" />
            <code className="a11y-rarity-preview-hex">{color.toUpperCase()}</code>
          </li>
        );
      })}
    </ul>
  );
}
