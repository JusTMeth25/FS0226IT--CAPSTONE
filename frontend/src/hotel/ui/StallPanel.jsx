import { useCallback, useEffect, useState } from 'react';
import { hotelApi } from '../../services/hotelApi.js';
import { collectionApi } from '../../services/collectionApi.js';
import { useCardFilters } from '../../hooks/useCardFilters.js';
import CardFilterBar from '../../components/card/CardFilterBar.jsx';
import { formatCardPrice, getRarityColor, resolveCardImage } from '../../utils/cardUtils.js';

const ERRORS = {
  stall_full: 'Il banchetto è pieno.',
  stall_price: 'Prezzo fra 1 e 100.000 gold.',
  card_not_owned: 'Non hai altre copie di questa carta da mettere in vendita.',
  stall_card_gone: 'Il venditore non ha più questa carta.',
  stall_own_item: 'È il tuo banchetto!',
  insufficient_gold: 'Non hai abbastanza gold.'
};

/**
 * Banchetto delle carte in una stanza: il proprietario ci mette fino a sei carte con un prezzo in
 * gold, chi passa le compra (anche se il venditore non c'è).
 */
export default function StallPanel({ itemId, me, gold, onBought, onViewCard, onClose }) {
  const [data, setData] = useState(null);
  const [notice, setNotice] = useState(null);
  const [owned, setOwned] = useState(null);
  const [pick, setPick] = useState(null);
  const [price, setPrice] = useState('');

  const load = useCallback(() => {
    hotelApi.stall(itemId).then(setData).catch(() => setNotice('Banchetto non raggiungibile.'));
  }, [itemId]);
  useEffect(() => { load(); }, [load]);

  const mine = data && data.ownerId === me?.id;
  useEffect(() => {
    if (!mine || owned) return;
    collectionApi.getCollection({ owned: 'true' }).then((res) => setOwned(res.collection || [])).catch(() => setOwned([]));
  }, [mine, owned]);

  const filter = useCardFilters(owned);
  const choices = filter.result.slice(0, 120);

  const run = (promise, ok) => promise.then((res) => { setData(res); if (ok) setNotice(ok); })
    .catch((err) => setNotice(ERRORS[err?.code] || (err?.status === 402 ? ERRORS.insufficient_gold : 'Non riuscito, riprova.')));

  return (
    <div className="hotel-panel hotel-stall" role="dialog" aria-label="Banchetto delle carte">
      <header className="hotel-panel-header">
        <h3><i className="ph-fill ph-storefront" /> Banchetto</h3>
        <button type="button" className="hotel-panel-close" onClick={onClose} aria-label="Chiudi"><i className="ph ph-x" /></button>
      </header>
      <div className="hotel-stall-body">
        {notice && <p className="hotel-panel-hint" role="status">{notice}</p>}
        {!data && <p className="hotel-panel-hint">Carico il banchetto…</p>}
        {data && data.items.length === 0 && <p className="hotel-panel-hint">{mine ? 'Il tuo banchetto è vuoto: metti in vendita qualche carta.' : 'Niente in vendita, per ora.'}</p>}
        <ul className="stall-items">
          {data?.items.map((it) => (
            <li key={it.id} style={{ '--rarity-color': getRarityColor(it.card?.rarity) }}>
              <button type="button" className="stall-card" onClick={() => it.card && onViewCard?.(it.card)} title={it.card?.name}>
                {it.card && <img src={resolveCardImage(it.card)} alt={it.card.name} loading="lazy" />}
              </button>
              <strong>{it.card?.name}</strong>
              <small>{it.card ? formatCardPrice(it.card) : ''}</small>
              {mine ? (
                <button type="button" className="btn btn-secondary btn-small" onClick={() => run(hotelApi.stallRemove(it.id), 'Carta tolta dal banchetto.')}>Togli</button>
              ) : (
                <button type="button" className="btn btn-gold btn-small" disabled={gold < it.price}
                  onClick={() => run(hotelApi.stallBuy(it.id).then((res) => { onBought?.(); return res; }), `Comprata: ${it.card?.name}!`)}>
                  <i className="ph-fill ph-coin" /> {it.price}
                </button>
              )}
            </li>
          ))}
        </ul>

        {mine && data && data.items.length < data.slots && (
          <form className="stall-add" onSubmit={(e) => {
            e.preventDefault();
            if (pick && Number(price) > 0) run(hotelApi.stallAdd(itemId, pick.id, Number(price)), `${pick.name} in vendita!`).then(() => { setPick(null); setPrice(''); });
          }}>
            <h4 className="events-sub">Metti in vendita</h4>
            <CardFilterBar compact items={owned} {...filter} count={filter.result.length} />
            <div className="stall-picker">
              {!owned && <small>Carico la collezione…</small>}
              {choices.map((c) => (
                <button key={c.id} type="button" className={`stall-pick${pick?.id === c.id ? ' picked' : ''}`} onClick={() => setPick(c)}
                  style={{ '--rarity-color': getRarityColor(c.rarity) }} title={`${c.name} (×${c.quantity})`} aria-pressed={pick?.id === c.id}>
                  <img src={resolveCardImage(c)} alt={c.name} loading="lazy" />
                </button>
              ))}
            </div>
            <div className="stall-price">
              <input type="number" min="1" max="100000" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Prezzo in gold" aria-label="Prezzo in gold" />
              <button type="submit" className="btn btn-primary btn-small" disabled={!pick || !(Number(price) > 0)}>Metti in vendita</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
