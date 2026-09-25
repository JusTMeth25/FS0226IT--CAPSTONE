import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useGame } from '../hooks/useGame.js';
import { useApiResource } from '../hooks/useApiResource.js';
import { tradeApi } from '../services/tradeApi.js';
import { dedupeCollection } from '../utils/collectionUtils.js';
import LoadingSpinner from '../components/common/LoadingSpinner.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import CardOwnership from '../components/trade/CardOwnership.jsx';
import { useOwnedCounts } from '../hooks/useOwnedCounts.js';

function uniqueOwnedCards(collection) {
  return dedupeCollection(collection).map((c) => ({ ...c, owned: c.quantity }));
}

const STATUS_LABELS = { pending: 'In attesa', accepted: 'Accettato', rejected: 'Rifiutato', cancelled: 'Annullato' };

/**
 * Il backend scrive lo stato in maiuscolo (PENDING), il vecchio backend Node in minuscolo: si
 * confronta sempre in minuscolo. Con il confronto esatto i pulsanti Accetta e Rifiuta non
 * comparivano mai.
 */
const statusOf = (trade) => trade.status?.toLowerCase();

function TradeStatusBadge({ status }) {
  const key = status?.toLowerCase();
  return <span className={`trade-status-badge trade-status-${key}`}>{STATUS_LABELS[key] || status}</span>;
}

/** Carte di uno scambio, ognuna con quante copie ne hai e il prezzo di mercato. */
function TradeCards({ items, gold, owned }) {
  if (!items?.length && !gold) return <span>—</span>;
  return (
    <span className="trade-card-lines">
      {items?.map(({ card, quantity }) => (
        <span key={card.id} className="trade-card-line">
          <strong>{card.name}</strong>{quantity > 1 ? ` ×${quantity}` : ''}
          <CardOwnership card={card} owned={owned.get(card.id) || 0} />
        </span>
      ))}
      {gold > 0 && <span className="trade-card-line"><i className="ph-fill ph-coin" /> {gold} gold</span>}
    </span>
  );
}

function TradeList({ trades, loading, error, onReload, direction, onAccept, onReject, onCancel }) {
  const owned = useOwnedCounts();
  if (loading) return <LoadingSpinner label="Carico gli scambi…" />;
  if (error) {
    return (
      <EmptyState
        icon="ph-plug"
        title="Scambi non raggiungibili"
        description="Il servizio di scambio non è al momento disponibile. Riprova più tardi."
        action={<button className="btn btn-secondary" onClick={onReload}><i className="ph-fill ph-arrows-clockwise" /> Riprova</button>}
      />
    );
  }
  if (!trades.length) {
    return <EmptyState icon="ph-arrows-left-right" title="Nessuno scambio" description={`Non hai scambi ${direction === 'incoming' ? 'ricevuti' : 'inviati'} al momento.`} />;
  }
  return (
    <div className="trade-list">
      {trades.map((trade) => (
        <div className="trade-item glass-panel" key={trade.id}>
          <div className="listing-item-info">
            <span className="listing-item-name">
              {direction === 'incoming' ? `Da: ${trade.fromUser?.username}` : `A: ${trade.toUser?.username}`}
            </span>
            <span className="listing-item-meta trade-item-cards">
              <span className="trade-item-side">Offre: <TradeCards items={trade.offeredCards} gold={trade.offeredGold} owned={owned} /></span>
              <span className="trade-item-side">Richiede: <TradeCards items={trade.requestedCards} gold={trade.requestedGold} owned={owned} /></span>
            </span>
          </div>
          <TradeStatusBadge status={trade.status} />
          {statusOf(trade) === 'pending' && (
            <div className="listing-item-actions">
              {direction === 'incoming' ? (
                <>
                  <button className="btn btn-primary btn-small" onClick={() => onAccept(trade)}>Accetta</button>
                  <button className="btn btn-danger btn-small" onClick={() => onReject(trade)}>Rifiuta</button>
                </>
              ) : (
                <button className="btn btn-secondary btn-small" onClick={() => onCancel(trade)}>Annulla</button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function TradesPage() {
  const game = useGame();
  const [tab, setTab] = useState('incoming');
  const [actionError, setActionError] = useState(null);
  // Dall'hotel si arriva con ?to=nome: il destinatario e' gia' compilato.
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState(() => ({
    toUserId: searchParams.get('to') || '', offeredCardId: '', offeredGold: 0, requestedCardId: '', requestedGold: 0
  }));

  const incoming = useApiResource(() => tradeApi.getIncoming(), []);
  const outgoing = useApiResource(() => tradeApi.getOutgoing(), []);
  const ownedCards = uniqueOwnedCards(game.collection);

  async function act(fn, trade, reload) {
    setActionError(null);
    try {
      await fn(trade.id);
      reload();
    } catch (err) {
      setActionError(err.message);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.toUserId || !form.offeredCardId) return;
    setActionError(null);
    try {
      await tradeApi.createTrade({
        toUserId: form.toUserId,
        offeredCards: [{ cardId: form.offeredCardId, quantity: 1 }],
        offeredGold: Number(form.offeredGold) || 0,
        requestedCards: form.requestedCardId ? [{ cardId: form.requestedCardId, quantity: 1 }] : [],
        requestedGold: Number(form.requestedGold) || 0
      });
      setForm({ toUserId: '', offeredCardId: '', offeredGold: 0, requestedCardId: '', requestedGold: 0 });
      outgoing.reload();
    } catch (err) {
      setActionError(err.message);
    }
  }

  return (
    <section className="trades-page">
      <h2 className="section-title text-gradient"><i className="ph-fill ph-arrows-left-right" /> Scambi</h2>
      <p className="page-subtitle">Scambia carte (ed eventualmente gold) con altri giocatori.</p>

      <div className="glass-panel">
        <h3 className="panel-title"><i className="ph-fill ph-plus-circle" /> Proponi uno scambio</h3>
        {ownedCards.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Non possiedi ancora carte da scambiare.</p>
        ) : (
          <form className="admin-form-row" onSubmit={handleCreate}>
            <div className="filter-group">
              <label className="filter-label">Username destinatario</label>
              <input className="ai-input" value={form.toUserId} onChange={(e) => setForm((f) => ({ ...f, toUserId: e.target.value }))} placeholder="es. mario_rossi" />
            </div>
            <div className="filter-group">
              <label className="filter-label">La tua carta</label>
              <select className="filter-select" value={form.offeredCardId} onChange={(e) => setForm((f) => ({ ...f, offeredCardId: e.target.value }))}>
                <option value="">Seleziona…</option>
                {ownedCards.map((c) => <option key={c.id} value={c.id}>{c.name} (x{c.owned})</option>)}
              </select>
            </div>
            <div className="filter-group">
              <label className="filter-label">+ Gold offerti</label>
              <input className="ai-input" type="number" min="0" value={form.offeredGold} onChange={(e) => setForm((f) => ({ ...f, offeredGold: e.target.value }))} />
            </div>
            <div className="filter-group">
              <label className="filter-label">Gold richiesti</label>
              <input className="ai-input" type="number" min="0" value={form.requestedGold} onChange={(e) => setForm((f) => ({ ...f, requestedGold: e.target.value }))} />
            </div>
            <button type="submit" className="btn btn-primary">Invia proposta</button>
          </form>
        )}
      </div>

      {actionError && <div className="auth-message auth-message-error">{actionError}</div>}

      <div className="tabs-row">
        <button className={`btn ${tab === 'incoming' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('incoming')}>Ricevuti</button>
        <button className={`btn ${tab === 'outgoing' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('outgoing')}>Inviati</button>
      </div>

      {tab === 'incoming' ? (
        <TradeList
          trades={incoming.data?.trades || []}
          loading={incoming.loading}
          error={incoming.error}
          onReload={incoming.reload}
          direction="incoming"
          onAccept={(t) => act(tradeApi.accept, t, incoming.reload)}
          onReject={(t) => act(tradeApi.reject, t, incoming.reload)}
        />
      ) : (
        <TradeList
          trades={outgoing.data?.trades || []}
          loading={outgoing.loading}
          error={outgoing.error}
          onReload={outgoing.reload}
          direction="outgoing"
          onCancel={(t) => act(tradeApi.cancel, t, outgoing.reload)}
        />
      )}
    </section>
  );
}
