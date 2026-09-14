import { useMemo } from 'react';
import { findBestCardIndex, getRarityColor, getRarityName } from '../../utils/cardUtils.js';

/**
 * Verdetto di fine apertura: qual e' stata la carta migliore del pacchetto.
 *
 * Chiude l'arco narrativo che il riepilogo lasciava aperto. Dopo cinque o dieci carte
 * viste una alla volta serve una riga che dica com'e' andata, altrimenti la sequenza
 * finisce su una griglia muta.
 *
 * A parita' di rarita' vince la prima estratta, che e' quella che l'utente ha visto per
 * prima e a cui associa il colpo di fortuna.
 */
export default function PackVerdict({ cards }) {
  const best = useMemo(() => {
    const index = findBestCardIndex(cards);
    return index >= 0 ? cards[index] : null;
  }, [cards]);

  if (!best) return null;

  const color = getRarityColor(best.rarity);

  return (
    <div className="pack-verdict" style={{ '--rarity-color': color }}>
      <span className="pack-verdict-icon"><i className="ph-fill ph-crown-simple" /></span>
      <span className="pack-verdict-text">
        <span className="pack-verdict-label">Miglior pull</span>
        <strong className="pack-verdict-name">{best.name}</strong>
      </span>
      <span className="pack-verdict-rarity">{getRarityName(best.rarity)}</span>
    </div>
  );
}
