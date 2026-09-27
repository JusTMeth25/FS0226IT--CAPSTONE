import { useCallback, useEffect, useState } from 'react';
import { hotelApi } from '../../services/hotelApi.js';
import LuxuryArt from './LuxuryArt.jsx';
import { formatCardPrice, getRarityColor, resolveCardImage } from '../../utils/cardUtils.js';

const ERRORS = {
  auction_closed: "L'asta e' chiusa.",
  auction_bid_low: "Offerta troppo bassa: rilancia di piu'.",
  auction_already_top: "Sei gia' tu il miglior offerente.",
  insufficient_gold: 'Non hai abbastanza gold.'
};

const RARITY = { rare: 'Rara', epic: 'Epica', legendary: 'Leggendaria' };

function countdown(endsAt, now) {
  const ms = Math.max(0, new Date(endsAt).getTime() - now);
  return `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;
}

/**
 * Asta dell'hotel: una carta alla volta, il banditore chiude quando scade il tempo. Le offerte
 * negli ultimi 30 secondi allungano l'asta. `live` cambia quando arriva un'offerta dal WebSocket.
 */
export default function AuctionTab({ me, gold, live, onChange, onViewCard }) {
  const [data, setData] = useState(null);
  const [amount, setAmount] = useState('');
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const reload = useCallback(() => {
    hotelApi.auction().then(setData).catch(() => setNotice('Asta non raggiungibile, riprova.'));
  }, []);
  useEffect(() => { reload(); }, [reload, live]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const lot = data?.lot;
  const bid = (value) => {
    setBusy(true);
    setNotice(null);
    hotelApi.bid(value).then((res) => {
      setData((d) => ({ ...d, lot: res }));
      setAmount('');
      setNotice(`Offerta di ${value} gold registrata!`);
      onChange?.();
    }).catch((err) => setNotice(ERRORS[err?.code] || (err?.status === 402 ? ERRORS.insufficient_gold : 'Offerta non riuscita.')))
      .finally(() => setBusy(false));
  };

  if (!data) return <p className="hotel-panel-hint">{notice || "Carico l'asta…"}</p>;
  const mine = lot && lot.bidderId === me?.id;
  const quick = lot ? [lot.minimumBid, lot.minimumBid + Math.max(10, Math.round(lot.minimumBid * 0.1))] : [];
  return (
    <div className="auction-tab">
      <p className="hotel-panel-hint"><i className="ph-fill ph-gavel" /> {data.auctioneer}: &laquo;Chi offre di piu&apos;?&raquo;</p>
      <p className="hotel-panel-hint">Anche gli NPC fanno offerte. Chi vince trova subito la carta nella sua collezione; se vince un NPC, la carta finisce nella sua vetrina degli scambi.</p>
      {notice && <p className="hotel-panel-hint" role="status">{notice}</p>}
      {lot ? (
        <section className="auction-lot" style={{ '--rarity': getRarityColor(lot.card?.rarity) }}>
          <button type="button" className="auction-card" onClick={() => lot.card && onViewCard?.(lot.card)} aria-label="Dettagli del lotto">
            {lot.card && <img src={resolveCardImage(lot.card)} alt={lot.card.name} />}
            {lot.luxury && <LuxuryArt part={lot.luxury.part} index={lot.luxury.index} look={lot.luxury.part === 'o' ? `s1.h1.hc0.sh0.p0.t0.f0.a0.b0.o${lot.luxury.index}.w0.r0` : null} />}
          </button>
          <div className="auction-info">
            <strong>{lot.card?.name || (lot.luxury && `${lot.luxury.brand} ${lot.luxury.name}`)}</strong>
            {lot.luxury ? (
              <span className="auction-limited"><i className="ph-fill ph-seal-check" /> Edizione limitata #{lot.luxury.serial}/{lot.luxury.copies} · in negozio {lot.luxury.price} gold</span>
            ) : (
              <span>{RARITY[lot.card?.rarity] || lot.card?.rarity}{lot.card ? ` · ${formatCardPrice(lot.card)}` : ''}</span>
            )}
            <div className="auction-price">
              <small>{lot.currentBid ? 'Offerta attuale' : "Base d'asta"}</small>
              <b><i className="ph-fill ph-coin" /> {lot.currentBid ?? lot.startBid}</b>
              {lot.bidderName && <small>di {mine ? 'te' : lot.bidderName} · {lot.bids} offerte</small>}
            </div>
            <div className="auction-clock">Chiude fra <b>{countdown(lot.endsAt, now)}</b></div>
            {mine ? (
              <p className="auction-mine">Sei in testa! I tuoi gold restano bloccati finche&apos; nessuno rilancia.</p>
            ) : (
              <>
                <div className="auction-quick">
                  {quick.map((v) => (
                    <button key={v} type="button" className="btn btn-gold btn-small" disabled={busy || gold < v} onClick={() => bid(v)}>
                      Offri {v}
                    </button>
                  ))}
                </div>
                <form className="auction-form" onSubmit={(e) => { e.preventDefault(); const v = parseInt(amount, 10); if (v > 0) bid(v); }}>
                  <input type="number" min={lot.minimumBid} value={amount} onChange={(e) => setAmount(e.target.value)}
                    placeholder={`Almeno ${lot.minimumBid}`} aria-label="Offerta in gold" />
                  <button type="submit" className="btn btn-primary btn-small" disabled={busy || !amount}>Offri</button>
                </form>
              </>
            )}
          </div>
        </section>
      ) : (
        <p className="hotel-panel-hint">
          Nessuna carta all&apos;asta adesso.
          {data.nextAt && ` La prossima fra ${countdown(data.nextAt, now)}.`}
        </p>
      )}
      {data.recent.length > 0 && (
        <>
          <h4 className="events-sub">Ultime aste</h4>
          <ul className="event-list">
            {data.recent.map((r) => (
              <li key={r.id}>
                {r.card && <img className="auction-thumb" src={resolveCardImage(r.card)} alt="" loading="lazy" />}
                <div>
                  <strong>{r.card?.name || (r.luxury && `${r.luxury.brand} ${r.luxury.name} #${r.luxury.serial}`)}</strong>
                  <span>{r.status === 'SOLD' ? `Vinta da ${r.bidderName} per ${r.currentBid} gold` : 'Nessuna offerta'}</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
