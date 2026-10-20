import { useEffect, useMemo, useState } from 'react';
import { useGame } from '../../hooks/useGame.js';
import { useCardFilters } from '../../hooks/useCardFilters.js';
import { useOwnedCounts } from '../../hooks/useOwnedCounts.js';
import { collectionApi } from '../../services/collectionApi.js';
import { tradeApi } from '../../services/tradeApi.js';
import { dedupeCollection } from '../../utils/collectionUtils.js';
import { formatMarketPrice, getRarityColor, getRarityName, getSourceLabel, resolveCardImage } from '../../utils/cardUtils.js';
import CardFilterBar from '../card/CardFilterBar.jsx';

const PAGE = 60;
const ERRORS = {
  recipient_not_found: 'Giocatore non trovato: controlla lo username.',
  cannot_trade_with_yourself: 'Non puoi scambiare con te stesso.',
  recipient_busy: 'Il giocatore è impegnato in una sfida, in un torneo o in un minigioco: riprova fra poco.'
};

/**
 * Una colonna dello scambio: le carte di un giocatore con ricerca e filtri (nome, classe, rarita',
 * gioco, ordine), da toccare per metterle nell'offerta o nella richiesta.
 */
function CardChooser({ cards, picked, myCounts, theirs, onAdd, empty }) {
  const filter = useCardFilters(cards, undefined, { sort: 'rarity' });
  const [shown, setShown] = useState(PAGE);
  const list = filter.result.slice(0, shown);
  return (
    <div className="trade-chooser">
      <CardFilterBar compact items={cards} {...filter} count={filter.result.length} />
      <ul className="trade-grid">
        {cards.length > 0 && filter.result.length === 0 && <li className="trade-empty">Nessuna carta con questi filtri.</li>}
        {cards.length === 0 && <li className="trade-empty">{empty}</li>}
        {list.map((card) => {
          const inDeal = picked.get(card.id) || 0;
          const left = (card.quantity ?? 1) - inDeal;
          const mine = myCounts.get(card.id) || 0;
          return (
            <li key={card.id}>
              <button type="button" className={`trade-thumb${inDeal ? ' picked' : ''}`} style={{ '--rarity-color': getRarityColor(card.rarity) }}
                onClick={() => onAdd(card)} disabled={left <= 0} title={`${card.name} · ${getRarityName(card.rarity)} · ${getSourceLabel(card.source)}`}>
                <img src={resolveCardImage(card)} alt="" loading="lazy" />
                <span className="trade-thumb-name">{card.name}</span>
                <span className="trade-thumb-meta">
                  ×{card.quantity ?? 1}
                  {theirs && <b className={mine ? 'have' : 'new'}>{mine ? `ne hai ${mine}` : 'nuova!'}</b>}
                </span>
                {inDeal > 0 && <span className="trade-thumb-badge">{inDeal}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {filter.result.length > shown && (
        <button type="button" className="btn btn-secondary btn-small trade-more" onClick={() => setShown((n) => n + PAGE)}>
          Mostra altre ({filter.result.length - shown})
        </button>
      )}
    </div>
  );
}

/** Carte scelte da un lato dello scambio, con le copie e il valore di mercato totale. */
function DealSide({ title, items, gold, onGold, onChange, maxGold }) {
  const value = items.reduce((sum, { card, quantity }) => sum + (card.marketPrice || 0) * quantity, 0);
  return (
    <div className="trade-side">
      <h4>{title}</h4>
      {items.length === 0 ? <p className="trade-empty">Tocca le carte qui sotto per aggiungerle.</p> : (
        <ul className="trade-picked">
          {items.map(({ card, quantity }) => (
            <li key={card.id}>
              <img src={resolveCardImage(card)} alt="" />
              <span className="trade-picked-name">{card.name}</span>
              <span className="trade-qty">
                <button type="button" onClick={() => onChange(card, quantity - 1)} aria-label="Una copia in meno">−</button>
                <b>{quantity}</b>
                <button type="button" onClick={() => onChange(card, quantity + 1)} disabled={quantity >= (card.quantity ?? 1)} aria-label="Una copia in piu'">+</button>
              </span>
              <button type="button" className="trade-remove" onClick={() => onChange(card, 0)} aria-label={`Togli ${card.name}`}><i className="ph ph-x" /></button>
            </li>
          ))}
        </ul>
      )}
      <label className="trade-gold">
        <i className="ph-fill ph-coin" /> Gold
        <input className="ai-input" type="number" min="0" max={maxGold} value={gold} onChange={(e) => onGold(Math.max(0, Number(e.target.value) || 0))} />
      </label>
      <p className="trade-value">Valore di mercato: <b>{formatMarketPrice(value) || '—'}</b>{gold > 0 ? ` + ${gold} gold` : ''}</p>
    </div>
  );
}

/**
 * Proposta di scambio: a sinistra le tue carte, a destra quelle dell'altro giocatore, entrambe con
 * ricerca e filtri. Si possono mettere piu' carte (e piu' copie) per lato, piu' i gold.
 */
export default function TradeComposer({ initialTo = '', onSent }) {
  const game = useGame();
  const myCounts = useOwnedCounts();
  const mine = useMemo(() => dedupeCollection(game.collection).filter((c) => (c.quantity ?? 1) > 0), [game.collection]);
  const [to, setTo] = useState(initialTo);
  const [partner, setPartner] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [offer, setOffer] = useState(new Map());
  const [ask, setAsk] = useState(new Map());
  const [offerGold, setOfferGold] = useState(0);
  const [askGold, setAskGold] = useState(0);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(null);

  const load = async (handle) => {
    const name = (handle ?? to).trim();
    if (!name) return;
    setLoading(true);
    setError(null);
    setAsk(new Map());
    try {
      setPartner(await collectionApi.tradable(name));
    } catch (err) {
      setPartner(null);
      setError(ERRORS[err.code] || err.message);
    } finally {
      setLoading(false);
    }
  };

  // Dall'hotel si arriva con il destinatario gia' scelto: le sue carte si caricano subito.
  useEffect(() => {
    if (!initialTo) return undefined;
    let cancelled = false;
    collectionApi.tradable(initialTo)
      .then((res) => { if (!cancelled) setPartner(res); })
      .catch((err) => { if (!cancelled) setError(ERRORS[err.code] || err.message); });
    return () => { cancelled = true; };
  }, [initialTo]);

  const change = (setter) => (card, quantity) => setter((cur) => {
    const next = new Map(cur);
    if (quantity <= 0) next.delete(card.id);
    else next.set(card.id, { card, quantity: Math.min(quantity, card.quantity ?? 1) });
    return next;
  });
  const add = (setter, map) => (card) => change(setter)(card, (map.get(card.id)?.quantity || 0) + 1);
  const counts = (map) => new Map([...map.values()].map(({ card, quantity }) => [card.id, quantity]));

  const send = async () => {
    if (!partner) return;
    setSending(true);
    setError(null);
    try {
      await tradeApi.createTrade({
        toUserId: partner.user.username,
        offeredCards: [...offer.values()].map(({ card, quantity }) => ({ cardId: card.id, quantity })),
        offeredGold: offerGold,
        requestedCards: [...ask.values()].map(({ card, quantity }) => ({ cardId: card.id, quantity })),
        requestedGold: askGold
      });
      setSent(partner.user.username);
      setOffer(new Map());
      setAsk(new Map());
      setOfferGold(0);
      setAskGold(0);
      onSent?.();
    } catch (err) {
      setError(ERRORS[err.code] || err.message);
    } finally {
      setSending(false);
    }
  };

  const ready = partner && (offer.size > 0 || offerGold > 0) && (ask.size > 0 || askGold > 0 || offer.size > 0);

  return (
    <div className="trade-composer">
      <form className="trade-to" onSubmit={(e) => { e.preventDefault(); load(); }}>
        <label className="filter-label" htmlFor="trade-to">Con chi scambi</label>
        <div className="trade-to-row">
          <input id="trade-to" className="ai-input" value={to} onChange={(e) => setTo(e.target.value)} placeholder="username del giocatore" />
          <button type="submit" className="btn btn-secondary" disabled={!to.trim() || loading}>{loading ? 'Carico…' : 'Vedi le sue carte'}</button>
        </div>
      </form>
      {error && <div className="auth-message auth-message-error">{error}</div>}
      {sent && <div className="auth-message auth-message-success">Proposta inviata a {sent}! La trovi fra gli scambi inviati.</div>}

      <div className="trade-deal">
        <DealSide title="Tu offri" items={[...offer.values()]} gold={offerGold} onGold={setOfferGold} maxGold={game.gold} onChange={change(setOffer)} />
        <div className="trade-arrows" aria-hidden="true"><i className="ph-fill ph-arrows-left-right" /></div>
        <DealSide title={partner ? `Chiedi a ${partner.user.username}` : 'Chiedi'} items={[...ask.values()]} gold={askGold} onGold={setAskGold} onChange={change(setAsk)} />
      </div>
      <button type="button" className="btn btn-primary trade-send" onClick={send} disabled={!ready || sending}>
        <i className="ph-fill ph-paper-plane-tilt" /> {sending ? 'Invio…' : 'Invia proposta'}
      </button>

      <div className="trade-columns">
        <section>
          <h4 className="trade-col-title"><i className="ph-fill ph-cards" /> Le tue carte</h4>
          <CardChooser cards={mine} picked={counts(offer)} myCounts={myCounts} onAdd={add(setOffer, offer)} empty="Non possiedi ancora carte." />
        </section>
        <section>
          <h4 className="trade-col-title"><i className="ph-fill ph-user" /> {partner ? `Le carte di ${partner.user.username}` : 'Le sue carte'}</h4>
          {partner
            ? <CardChooser key={partner.user.id} cards={partner.cards} picked={counts(ask)} myCounts={myCounts} theirs onAdd={add(setAsk, ask)} empty="Questo giocatore non ha carte." />
            : <p className="trade-empty">Scrivi lo username e premi "Vedi le sue carte" per cercare fra le sue carte.</p>}
        </section>
      </div>
    </div>
  );
}
