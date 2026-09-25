import { formatMarketPrice } from '../../utils/cardUtils.js';

/**
 * Riga sotto una carta proposta in uno scambio: quante copie ne possiedi e il prezzo di mercato,
 * se si conosce. Aiuta a capire al volo se lo scambio conviene.
 */
export default function CardOwnership({ card, owned, className = '' }) {
  const price = formatMarketPrice(card?.marketPrice);
  return (
    <span className={`card-ownership ${className}`}>
      <span className={owned > 0 ? 'card-ownership-have' : 'card-ownership-new'}>
        {owned > 0 ? `Ne hai ${owned}` : 'Non ce l\'hai'}
      </span>
      {price && <span className="card-ownership-price">{price}</span>}
    </span>
  );
}
