import { useState } from 'react';
import { PACKS } from '../../data/packs.js';
import { PACK_GRADIENT, PACK_ICON, PACK_IMAGE } from '../../components/pack/packArt.js';
import CardBuyback from './CardBuyback.jsx';

/**
 * Banco dell'edicola. Prima scheda: si comprano i pacchetti con i gold, allo stesso prezzo della
 * pagina Pacchetti; non si aprono qui, finiscono nella borsa. Seconda scheda: l'edicolante
 * ricompra le carte che hanno un prezzo di mercato (la stessa vendita del negozio).
 */
export default function Newsstand({ gold, owned, buying, onBuy, onOpenBag, onCardSold, onClose }) {
  const [tab, setTab] = useState('buy');
  // Il pacchetto del weekend si vende solo sabato e domenica (il server lo controlla comunque).
  const [weekendOpen] = useState(() => [0, 6].includes(new Date().getDay()));
  return (
    <div className="hotel-panel hotel-newsstand" role="dialog" aria-label="Edicola">
      <header className="hotel-panel-header">
        <h3><i className="ph-fill ph-newspaper" /> Edicola</h3>
        <span className="hotel-gold"><i className="ph-fill ph-coin" /> {gold}</span>
        <button type="button" className="hotel-panel-close" onClick={onClose} aria-label="Chiudi"><i className="ph ph-x" /></button>
      </header>
      <div className="hotel-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'buy'} className={`hotel-tab${tab === 'buy' ? ' active' : ''}`} onClick={() => setTab('buy')}>
          <i className="ph-fill ph-cards" /> Compra pacchetti
        </button>
        <button type="button" role="tab" aria-selected={tab === 'sell'} className={`hotel-tab hotel-tab-sell${tab === 'sell' ? ' active' : ''}`} onClick={() => setTab('sell')}>
          <i className="ph-fill ph-hand-coins" /> Vendi carte
        </button>
      </div>

      {tab === 'sell' && <CardBuyback onSold={onCardSold} />}

      {tab === 'buy' && (
        <>
          <p className="hotel-panel-hint">I pacchetti comprati vanno nella borsa: aprili da li&apos; quando vuoi.</p>
          <ul className="hotel-pack-grid">
            {PACKS.filter((pack) => !pack.weekend || weekendOpen).map((pack) => {
              const count = owned[pack.id] || 0;
              return (
                <li key={pack.id} className="hotel-pack-card">
                  <div className="hotel-pack-art" style={{ background: PACK_IMAGE[pack.id] ? undefined : PACK_GRADIENT[pack.id] }}>
                    {PACK_IMAGE[pack.id]
                      ? <img src={PACK_IMAGE[pack.id]} alt="" />
                      : <i className={`ph-fill ${PACK_ICON[pack.id] || 'ph-gift'}`} />}
                    {count > 0 && <b className="hotel-pack-owned" title="Nella tua borsa">×{count}</b>}
                  </div>
                  <strong>{pack.name}</strong>
                  <small>{pack.cardCount} carte · {pack.description.split('.')[0]}</small>
                  <button type="button" className="btn btn-gold btn-small" disabled={!!buying || gold < pack.price}
                    onClick={() => onBuy(pack.id)}>
                    <i className="ph-fill ph-coin" /> {buying === pack.id ? 'Compro…' : pack.price}
                  </button>
                </li>
              );
            })}
          </ul>
          <button type="button" className="btn btn-secondary btn-small hotel-newsstand-bag" onClick={onOpenBag}>
            <i className="ph-fill ph-package" /> Apri la borsa
          </button>
        </>
      )}
    </div>
  );
}
