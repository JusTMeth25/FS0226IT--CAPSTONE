import { useEffect, useMemo, useState } from 'react';
import { useGame } from '../../hooks/useGame.js';
import { useCardFilters } from '../../hooks/useCardFilters.js';
import { getRarityColor, getRarityName, resolveCardImage } from '../../utils/cardUtils.js';
import { dedupeCollection } from '../../utils/collectionUtils.js';
import { useOwnedCounts } from '../../hooks/useOwnedCounts.js';
import CardOwnership from '../../components/trade/CardOwnership.jsx';
import CardFilterBar from '../../components/card/CardFilterBar.jsx';

/** Stessa formula del server (NpcDeals.value): serve solo per dire in anticipo se l'offerta e' equa. */
const RARITY_VALUE = { common: 10, uncommon: 25, rare: 60, epic: 150, legendary: 400 };
function cardValue(card) {
  const price = Number(card?.marketPrice || 0);
  return (RARITY_VALUE[card?.rarity] || 10) + (price > 0 ? Math.round(Math.min(price, 200) * 2) : 0);
}

function TradeCard({ card, label, owned, selected, onClick }) {
  const content = (
    <>
      <img src={resolveCardImage(card)} alt={card.name} loading="lazy" />
      <span className="hotel-trade-card-name">{card.name}</span>
      <span className="hotel-trade-card-rarity">{getRarityName(card.rarity)}</span>
      {owned !== undefined && <CardOwnership card={card} owned={owned} />}
      {label && <span className="hotel-trade-card-label">{label}</span>}
    </>
  );
  const style = { '--rarity-color': getRarityColor(card.rarity) };
  return onClick ? (
    <button type="button" className={`hotel-trade-card${selected ? ' selected' : ''}`} style={style} onClick={onClick} title={card.name}>
      {content}
    </button>
  ) : <div className="hotel-trade-card" style={style}>{content}</div>;
}

/**
 * Proposta di scambio fatta da un NPC: una sua carta (che non hai) per una tua, di solito una
 * doppia. Scade dopo qualche secondo, come le sfide.
 */
export function NpcTradeOffer({ offer, send, onClose }) {
  const owned = useOwnedCounts();
  const [left, setLeft] = useState(Math.round(offer.expiresIn / 1000));
  useEffect(() => {
    const timer = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, []);
  const reply = (accept) => {
    send({ type: 'npc_trade_reply', offerId: offer.offerId, accept });
    onClose();
  };

  return (
    <div className="hotel-panel hotel-npc-trade-offer" role="dialog" aria-label={`Proposta di scambio di ${offer.npc.username}`}>
      <header className="hotel-panel-header">
        <h3><i className="ph-fill ph-arrows-left-right" /> {offer.npc.username} ti propone uno scambio</h3>
        <span className="hotel-npc-trade-timer">{left}s</span>
      </header>
      <div className="hotel-npc-trade-pair">
        <TradeCard card={offer.give} label="Ti da'" owned={owned.get(offer.give.id) || 0} />
        <i className="ph-fill ph-arrows-left-right hotel-npc-trade-arrow" />
        <TradeCard card={offer.want} label="Vuole" owned={owned.get(offer.want.id) || 0} />
      </div>
      <p className="hotel-panel-hint">Una tua carta in cambio di una che non hai ancora.</p>
      <footer className="hotel-panel-footer">
        <button type="button" className="btn btn-secondary btn-small" onClick={() => reply(false)}>No, grazie</button>
        <button type="button" className="btn btn-primary btn-small" onClick={() => reply(true)} disabled={left === 0}>
          <i className="ph-fill ph-handshake" /> Accetta
        </button>
      </footer>
    </div>
  );
}

/**
 * Scambio proposto da te: scegli una carta della vetrina dell'NPC e una delle tue da dare in
 * cambio. L'NPC accetta se ci guadagna almeno quanto ci rimette (con un piccolo margine).
 */
export function NpcTradePanel({ npc, showcase, send, onClose }) {
  const { collection } = useGame();
  const owned = useOwnedCounts();
  const [want, setWant] = useState(null);
  const [give, setGive] = useState(null);

  useEffect(() => {
    send({ type: 'npc_showcase', npcId: npc.id });
  }, [npc.id, send]);

  // Le tue carte con gli stessi filtri della Collezione (nome, classe, rarita', fonte, ordine).
  const yours = useMemo(() => dedupeCollection(collection).filter((c) => (c.quantity ?? 1) > 0), [collection]);
  const filter = useCardFilters(yours, undefined, { sort: 'rarity' });
  const mine = filter.result.slice(0, 120);

  // Il valore delle carte dell'NPC arriva dal server insieme alla vetrina.
  const fair = want && give ? cardValue(give) >= want.value * 0.9 : null;
  const cards = showcase?.npcId === npc.id ? showcase.cards : null;

  return (
    <div className="hotel-panel hotel-npc-trade" role="dialog" aria-label={`Scambio con ${npc.username}`}>
      <header className="hotel-panel-header">
        <h3><i className="ph-fill ph-arrows-left-right" /> Scambio con {npc.username}</h3>
        <button type="button" className="hotel-panel-close" onClick={onClose} aria-label="Chiudi"><i className="ph ph-x" /></button>
      </header>
      <div className="hotel-npc-trade-body">
        <section>
          <span className="hotel-npc-menu-title">La vetrina di {npc.username}{showcase?.tradesLeft != null && ` · scambi rimasti (30 min): ${showcase.tradesLeft}`}</span>
          <div className="hotel-trade-row">
            {!cards && <span className="hotel-room-empty">Carico la vetrina…</span>}
            {cards?.map(({ card, value }) => (
              <TradeCard key={card.id} card={card} owned={owned.get(card.id) || 0}
                selected={want?.card.id === card.id} onClick={() => setWant({ card, value })} />
            ))}
          </div>
        </section>
        <section>
          <span className="hotel-npc-menu-title">Cosa gli dai in cambio</span>
          <CardFilterBar compact items={yours} {...filter} count={filter.result.length} />
          <div className="hotel-trade-row hotel-trade-mine">
            {mine.length === 0 && <span className="hotel-room-empty">Nessuna carta.</span>}
            {mine.map((card) => (
              <TradeCard key={card.id} card={card} owned={card.quantity ?? 1}
                selected={give?.id === card.id} onClick={() => setGive(card)} />
            ))}
          </div>
        </section>
      </div>
      <footer className="hotel-panel-footer">
        {fair !== null && (
          <span className={`hotel-trade-fair ${fair ? 'ok' : 'ko'}`}>
            {fair ? 'Offerta equa: dovrebbe accettare' : 'Troppo poco: offri una carta piu\' rara'}
          </span>
        )}
        <button type="button" className="btn btn-primary btn-small" disabled={!want || !give}
          onClick={() => send({ type: 'npc_trade_propose', npcId: npc.id, give: give.id, want: want.card.id })}>
          <i className="ph-fill ph-handshake" /> Proponi
        </button>
      </footer>
    </div>
  );
}
