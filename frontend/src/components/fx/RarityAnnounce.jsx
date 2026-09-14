import { getRarityColor, getRarityName, RARITY_ORDER } from '../../utils/cardUtils.js';

/** Sotto questa soglia l'annuncio non compare: gridare "COMUNE" toglierebbe peso alle volte che conta. */
const MIN_RARITY = RARITY_ORDER.rare;

/**
 * Etichetta della rarita' che piomba sulla carta appena rivelata.
 *
 * Compare solo da rara in su. Non aggiunge informazione — la rarita' si legge gia' dalla
 * gemma e dalle stelle — ma da' il tempo drammatico: il colpo di scena arriva prima che
 * l'occhio finisca di leggere la carta.
 */
export default function RarityAnnounce({ rarity }) {
  if ((RARITY_ORDER[rarity] || 0) < MIN_RARITY) return null;

  return (
    <div
      className={`rarity-announce rarity-announce-${rarity}`}
      style={{ '--rarity-color': getRarityColor(rarity) }}
      aria-hidden="true"
    >
      {getRarityName(rarity)}
    </div>
  );
}
