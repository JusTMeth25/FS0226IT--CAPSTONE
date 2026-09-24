import { useMemo } from 'react';
import { formatMarketPrice } from '../../utils/cardUtils.js';

/**
 * Valore di mercato delle carte appena trovate, sotto il verdetto del riepilogo.
 *
 * Somma i prezzi reali delle carte importate (Pokemon, Magic, Yu-Gi-Oh!, ...). Le originali
 * VinylDex e le fonti senza dati di prezzo non contribuiscono e vengono contate a parte,
 * come nell'indicatore della collezione.
 */
export default function PackValue({ cards }) {
  const { total, top, unpriced } = useMemo(() => {
    let sum = 0;
    let best = null;
    let missing = 0;
    (cards || []).forEach((card) => {
      if (card.marketPrice > 0) {
        sum += card.marketPrice;
        if (!best || card.marketPrice > best.marketPrice) best = card;
      } else {
        missing += 1;
      }
    });
    return { total: sum, top: best, unpriced: missing };
  }, [cards]);

  if (!cards?.length) return null;

  return (
    <div className="pack-value" role="status">
      <span className="pack-value-icon"><i className="ph-fill ph-coins" /></span>
      <span className="pack-value-text">
        <span className="pack-value-label">Valore delle carte trovate</span>
        <strong className="pack-value-amount">{total > 0 ? formatMarketPrice(total) : '—'}</strong>
        {top && cards.filter((c) => c.marketPrice > 0).length > 1 && (
          <span className="pack-value-detail">La piu&apos; preziosa: {top.name} ({formatMarketPrice(top.marketPrice)})</span>
        )}
        {unpriced > 0 && (
          <span className="pack-value-detail">
            {unpriced === cards.length
              ? 'Queste carte non hanno un prezzo di mercato.'
              : `${unpriced} ${unpriced === 1 ? 'carta' : 'carte'} senza prezzo di mercato non ${unpriced === 1 ? 'e\' inclusa' : 'sono incluse'}.`}
          </span>
        )}
      </span>
    </div>
  );
}
