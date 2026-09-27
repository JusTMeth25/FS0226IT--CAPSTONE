import { useCallback, useEffect, useState } from 'react';
import { shopApi } from '../../services/shopApi.js';
import { useCardFilters } from '../../hooks/useCardFilters.js';
import CardFilterBar from '../../components/card/CardFilterBar.jsx';
import { formatCardPrice, getRarityColor, resolveCardImage } from '../../utils/cardUtils.js';

const ERRORS = {
  card_not_sellable: 'Quella copia non si vende: e\' esposta in vetrina o e\' la tua preferita.',
  card_not_buyable: 'Il negozio non compra questa carta.',
  card_not_owned: 'Non possiedi piu\' questa carta.'
};

/**
 * Il negozio ricompra le carte che hanno un prezzo di mercato e le paga in gold, senza limiti.
 * Le copie in vetrina e l'ultima copia delle preferite non si vendono.
 */
export default function CardBuyback({ onSold }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    try {
      setData(await shopApi.buybackQuotes());
    } catch {
      setError('Il negozio non risponde. Riprova tra poco.');
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- caricamento all'apertura della scheda
    load();
  }, [load]);

  const offerCard = (offer) => offer.card;
  const filter = useCardFilters(data?.cards, offerCard, { sort: 'price' });
  const cards = filter.result;

  async function sell(offer, quantity) {
    setBusy(offer.card.id);
    setError(null);
    try {
      const sale = await shopApi.sellCard(offer.card.id, quantity);
      await load();
      onSold(sale, offer.card, quantity);
    } catch (err) {
      setError(ERRORS[err?.payload?.error || err?.message] || 'Vendita non riuscita. Riprova.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="hotel-buyback">
      <p className="hotel-panel-hint">
        Si comprano le carte con un prezzo di mercato: vendi tutte quelle che vuoi.
      </p>
      <CardFilterBar compact items={data?.cards} getCard={offerCard} {...filter} count={cards.length} />
      {error && <p className="hotel-panel-error">{error}</p>}
      <ul className="hotel-buyback-list">
        {!data && !error && <li className="hotel-room-empty">Carico le offerte…</li>}
        {data && cards.length === 0 && <li className="hotel-room-empty">Nessuna carta con un prezzo di mercato da vendere.</li>}
        {cards.map((offer) => {
          const doubles = Math.min(offer.sellable, offer.quantity - 1);
          return (
            <li key={offer.card.id} className="hotel-buyback-row" style={{ '--rarity-color': getRarityColor(offer.card.rarity) }}>
              <img src={resolveCardImage(offer.card)} alt="" loading="lazy" />
              <span className="hotel-buyback-info">
                <strong>{offer.card.name}{offer.card.grade ? ` · VDX ${offer.card.grade}` : ''}</strong>
                <small>Ne hai {offer.quantity} · {formatCardPrice({ ...offer.card, marketPrice: offer.marketPrice })}</small>
                <small className="hotel-buyback-offer"><i className="ph-fill ph-coin" /> {offer.gold} gold a copia</small>
              </span>
              <span className="hotel-buyback-actions">
                <button type="button" className="btn btn-gold btn-small" disabled={busy === offer.card.id || offer.sellable < 1}
                  onClick={() => sell(offer, 1)} title={offer.sellable < 1 ? 'In vetrina o preferita: non si vende' : undefined}>
                  Vendi 1
                </button>
                {doubles > 1 && (
                  <button type="button" className="btn btn-secondary btn-small" disabled={busy === offer.card.id}
                    onClick={() => sell(offer, doubles)}>
                    Doppie ({doubles})
                  </button>
                )}
                {offer.sellable > 1 && offer.sellable !== doubles && (
                  <button type="button" className="btn btn-secondary btn-small" disabled={busy === offer.card.id}
                    onClick={() => sell(offer, offer.sellable)}>
                    Tutte ({offer.sellable})
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
