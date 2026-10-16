import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApiResource } from '../hooks/useApiResource.js';
import { tradeApi } from '../services/tradeApi.js';
import LoadingSpinner from '../components/common/LoadingSpinner.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import CardOwnership from '../components/trade/CardOwnership.jsx';
import TradeComposer from '../components/trade/TradeComposer.jsx';
import { useOwnedCounts } from '../hooks/useOwnedCounts.js';
import PhantomTitle from '../components/phantom/PhantomTitle.jsx';
import DealBanner from '../components/trade/DealBanner.jsx';
import { newDeal } from '../components/trade/newDeal.js';
import '../styles/pages/social-phantom.css';
import '../styles/pages/social-market.css';

/** Messaggi per i codici d'errore degli scambi. */
const TRADE_ERRORS = {
  trade_limit: "Hai gia' concluso 5 scambi nell'ultima mezz'ora: riprova fra poco.",
  trade_limit_other: "L'altro giocatore ha gia' concluso 5 scambi nell'ultima mezz'ora: riprova fra poco.",
  insufficient_quantity_or_gold: "Non hai piu' le carte o i gold richiesti.",
  trade_not_pending: "Questo scambio non e' piu' in attesa."
};

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
    return (
      <EmptyState
        icon="ph-arrows-left-right"
        title={direction === 'incoming' ? 'Nessuna proposta' : 'Nessun invio'}
        description={direction === 'incoming'
          ? 'Nessuno ti ha ancora proposto uno scambio. Fai tu la prima mossa: scrivi uno username qui sopra.'
          : 'Non hai proposte in corso. Scegli un giocatore qui sopra e metti insieme la tua offerta.'}
      />
    );
  }
  return (
    <div className="trade-list">
      {trades.map((trade) => (
        <div className={`trade-item glass-panel${statusOf(trade) === 'pending' ? '' : ' is-closed'}`} key={trade.id}>
          <p className="st-who">
            {direction === 'incoming'
              ? <><small>Da</small>{trade.fromUser?.username}</>
              : <><small>A</small>{trade.toUser?.username}</>}
          </p>
          <dl className="st-sides">
            <div className="st-side"><dt>{direction === 'incoming' ? 'Ti offre' : 'Offri'}</dt><dd><TradeCards items={trade.offeredCards} gold={trade.offeredGold} owned={owned} /></dd></div>
            <div className="st-side"><dt>{direction === 'incoming' ? 'Ti chiede' : 'Chiedi'}</dt><dd><TradeCards items={trade.requestedCards} gold={trade.requestedGold} owned={owned} /></dd></div>
          </dl>
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
  const [tab, setTab] = useState('incoming');
  const [actionError, setActionError] = useState(null);
  const [deal, setDeal] = useState(null);
  const clearDeal = useCallback(() => setDeal(null), []);
  // Dall'hotel si arriva con ?to=nome: il destinatario e' gia' compilato.
  const [searchParams] = useSearchParams();
  const incoming = useApiResource(() => tradeApi.getIncoming(), []);
  const outgoing = useApiResource(() => tradeApi.getOutgoing(), []);

  async function act(fn, trade, reload, onDone) {
    setActionError(null);
    try {
      await fn(trade.id);
      onDone?.();
      reload();
    } catch (err) {
      setActionError(TRADE_ERRORS[err.code] || err.message);
    }
  }

  return (
    <section className="trades-page sp-page">
      <header className="sp-head">
        <PhantomTitle as="h2" text="Scambi" />
        <p className="sp-sub">Scambia carte (ed eventualmente gold) con altri giocatori.</p>
      </header>
      <DealBanner deal={deal} onDone={clearDeal} />

      <div className="glass-panel st-compose">
        <h3 className="panel-title"><i className="ph-fill ph-plus-circle" /> Proponi uno scambio</h3>
        <TradeComposer initialTo={searchParams.get('to') || ''} onSent={() => { outgoing.reload(); }} />
      </div>

      {actionError && <div className="auth-message auth-message-error">{actionError}</div>}

      <div className="sp-tabs st-tabs" role="group" aria-label="Elenco degli scambi">
        {[['incoming', 'Ricevuti', incoming], ['outgoing', 'Inviati', outgoing]].map(([key, label, res]) => {
          const waiting = (res.data?.trades || []).filter((t) => statusOf(t) === 'pending').length;
          return (
            <button key={key} type="button" className={`sp-tab${tab === key ? ' is-active' : ''}`} aria-pressed={tab === key} onClick={() => setTab(key)}>
              {label}
              {waiting > 0 && <span className="sp-tab-count" aria-label={`${waiting} in attesa`}>{waiting}</span>}
            </button>
          );
        })}
      </div>

      {tab === 'incoming' ? (
        <TradeList
          trades={incoming.data?.trades || []}
          loading={incoming.loading}
          error={incoming.error}
          onReload={incoming.reload}
          direction="incoming"
          onAccept={(t) => act(tradeApi.accept, t, incoming.reload, () => setDeal(newDeal('Scambio concluso!', `Affare chiuso con ${t.fromUser?.username || "l'altro giocatore"}: le carte sono già nella tua collezione.`)))}
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
