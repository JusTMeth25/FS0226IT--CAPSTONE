import { useCallback, useEffect, useState } from 'react';
import { tradeApi } from '../../services/tradeApi.js';
import { useGame } from '../../hooks/useGame.js';
import { useAuth } from '../../hooks/useAuth.js';
import { getRarityColor, resolveCardImage } from '../../utils/cardUtils.js';
import { useOwnedCounts } from '../../hooks/useOwnedCounts.js';
import CardOwnership from '../../components/trade/CardOwnership.jsx';

const ERRORS = {
  insufficient_quantity_or_gold: 'Non hai piu\' le carte o i gold richiesti.',
  trade_not_pending: 'Questo scambio non e\' piu\' in attesa.',
  trade_limit: 'Hai gia\' concluso 5 scambi nell\'ultima mezz\'ora: riprova fra poco.',
  trade_limit_other: 'L\'altro giocatore ha gia\' concluso 5 scambi nell\'ultima mezz\'ora: riprova fra poco.'
};

/** Stato degli scambi: il backend lo scrive in maiuscolo (PENDING), qui si confronta senza badarci. */
const isPending = (trade) => trade.status?.toLowerCase() === 'pending';

function CardChips({ items, gold, owned, onViewCard }) {
  if (!items?.length && !gold) return <span className="trade-chip-empty">niente</span>;
  return (
    <span className="trade-chips">
      {items?.map(({ card, quantity }) => (
        <button key={card.id} type="button" className="trade-chip" style={{ '--rarity-color': getRarityColor(card.rarity) }}
          onClick={() => onViewCard(card)} title={`Guarda ${card.name}`}>
          <img src={resolveCardImage(card)} alt="" loading="lazy" />
          <span className="trade-chip-text">
            {card.name}{quantity > 1 ? ` ×${quantity}` : ''}
            <CardOwnership card={card} owned={owned.get(card.id) || 0} />
          </span>
        </button>
      ))}
      {gold > 0 && <span className="trade-chip trade-chip-gold"><i className="ph-fill ph-coin" /> {gold}</span>}
    </span>
  );
}

/**
 * Scambi senza uscire dall'hotel: quelli ricevuti si accettano o rifiutano qui, quelli inviati
 * si annullano. Si ricarica da solo quando arriva un evento di scambio (version).
 */
export default function TradesPanel({ version, onPendingChange, onClose, onViewCard }) {
  const { refreshCollection } = useGame();
  const owned = useOwnedCounts();
  const { refreshUser } = useAuth();
  const [tab, setTab] = useState('incoming');
  const [incoming, setIncoming] = useState(null);
  const [outgoing, setOutgoing] = useState(null);
  const [npcTrades, setNpcTrades] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const [inRes, outRes, npcRes] = await Promise.all([tradeApi.getIncoming(), tradeApi.getOutgoing(),
        tradeApi.getNpc().catch(() => ({ trades: [] }))]);
      setIncoming(inRes.trades || []);
      setOutgoing(outRes.trades || []);
      setNpcTrades(npcRes.trades || []);
      onPendingChange?.((inRes.trades || []).filter(isPending).length);
    } catch {
      setError('Scambi non raggiungibili. Riprova tra poco.');
    }
  }, [onPendingChange]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- caricamento dal server all'apertura e a ogni evento
    load();
  }, [load, version, tab]);

  async function act(fn, trade) {
    setBusy(trade.id);
    setError(null);
    try {
      await fn(trade.id);
      await Promise.all([load(), refreshCollection?.(), refreshUser()]);
    } catch (err) {
      setError(ERRORS[err?.message] || 'Operazione non riuscita. Riprova.');
    } finally {
      setBusy(null);
    }
  }

  const list = (tab === 'incoming' ? incoming : outgoing) || [];
  const pendingIn = (incoming || []).filter(isPending).length;

  return (
    <div className="hotel-panel hotel-trades" role="dialog" aria-label="Scambi">
      <header className="hotel-panel-header">
        <h3><i className="ph-fill ph-arrows-left-right" /> Scambi</h3>
        <button type="button" className="hotel-panel-close" onClick={onClose} aria-label="Chiudi"><i className="ph ph-x" /></button>
      </header>
      <div className="hotel-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'incoming'} className={`hotel-tab${tab === 'incoming' ? ' active' : ''}`} onClick={() => setTab('incoming')}>
          Ricevuti {pendingIn > 0 && <b className="hotel-tab-badge">{pendingIn}</b>}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'outgoing'} className={`hotel-tab${tab === 'outgoing' ? ' active' : ''}`} onClick={() => setTab('outgoing')}>
          Inviati
        </button>
        <button type="button" role="tab" aria-selected={tab === 'npc'} className={`hotel-tab${tab === 'npc' ? ' active' : ''}`} onClick={() => setTab('npc')}>
          Con gli NPC
        </button>
      </div>
      {error && <p className="hotel-panel-error">{error}</p>}
      {tab === 'npc' ? (
        <ul className="hotel-trade-list">
          {!npcTrades && !error && <li className="hotel-room-empty">Carico gli scambi…</li>}
          {npcTrades && npcTrades.length === 0 && (
            <li className="hotel-room-empty">Nessuno scambio con gli NPC. Clicca un ospite dell&apos;hotel e scegli &quot;Scambia carte&quot;.</li>
          )}
          {npcTrades?.map((trade) => (
            <li key={trade.id} className="hotel-trade">
              <div className="hotel-trade-head">
                <strong>Con {trade.npcName}</strong>
                <span className="hotel-trade-status status-accepted">
                  Concluso · {new Date(trade.createdAt).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="hotel-trade-row">
                <span className="hotel-trade-label">Hai ricevuto</span>
                <CardChips items={[{ card: trade.got, quantity: 1 }]} owned={owned} onViewCard={onViewCard} />
              </div>
              <div className="hotel-trade-row">
                <span className="hotel-trade-label">Hai dato</span>
                <CardChips items={[{ card: trade.gave, quantity: 1 }]} owned={owned} onViewCard={onViewCard} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
      <ul className="hotel-trade-list">
        {!incoming && !error && <li className="hotel-room-empty">Carico gli scambi…</li>}
        {incoming && list.length === 0 && (
          <li className="hotel-room-empty">
            {tab === 'incoming' ? 'Nessuno scambio ricevuto.' : 'Nessuno scambio inviato. Proponine uno dalla scheda di un giocatore.'}
          </li>
        )}
        {list.map((trade) => {
          const other = tab === 'incoming' ? trade.fromUser?.username : trade.toUser?.username;
          const pending = isPending(trade);
          return (
            <li key={trade.id} className={`hotel-trade${pending ? ' pending' : ''}`}>
              <div className="hotel-trade-head">
                <strong>{tab === 'incoming' ? `Da ${other}` : `A ${other}`}</strong>
                <span className={`hotel-trade-status status-${trade.status?.toLowerCase()}`}>{
                  { pending: 'In attesa', accepted: 'Accettato', rejected: 'Rifiutato', cancelled: 'Annullato' }[trade.status?.toLowerCase()] || trade.status
                }</span>
              </div>
              <div className="hotel-trade-row">
                <span className="hotel-trade-label">{tab === 'incoming' ? 'Ricevi' : 'Offri'}</span>
                <CardChips items={trade.offeredCards} gold={trade.offeredGold} owned={owned} onViewCard={onViewCard} />
              </div>
              <div className="hotel-trade-row">
                <span className="hotel-trade-label">{tab === 'incoming' ? 'Dai' : 'Chiedi'}</span>
                <CardChips items={trade.requestedCards} gold={trade.requestedGold} owned={owned} onViewCard={onViewCard} />
              </div>
              {pending && (
                <div className="hotel-trade-actions">
                  {tab === 'incoming' ? (
                    <>
                      <button type="button" className="btn btn-secondary btn-small" disabled={busy === trade.id} onClick={() => act(tradeApi.reject, trade)}>
                        <i className="ph ph-x" /> Rifiuta
                      </button>
                      <button type="button" className="btn btn-primary btn-small" disabled={busy === trade.id} onClick={() => act(tradeApi.accept, trade)}>
                        <i className="ph-fill ph-check" /> Accetta
                      </button>
                    </>
                  ) : (
                    <button type="button" className="btn btn-secondary btn-small" disabled={busy === trade.id} onClick={() => act(tradeApi.cancel, trade)}>
                      Annulla
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      )}
    </div>
  );
}
