import { useMemo, useState } from 'react';
import { furniApi } from '../../services/furniApi.js';
import FurniPreview from './FurniPreview.jsx';
import CardBuyback from './CardBuyback.jsx';

const CATEGORY_LABELS = {
  sedute: 'Sedute',
  arredo: 'Arredo',
  luci: 'Luci',
  musica: 'Musica',
  caffe: 'Caffetteria',
  piscina: 'Piscina',
  giardino: 'Giardino',
  giochi: 'Giochi',
  spiaggia: 'Spiaggia',
  cinema: 'Cinema',
  palestra: 'Palestra',
  carte: 'Carte',
  pareti: 'Pareti'
};

/** Scheda del negozio che non e' una categoria di mobili: la vendita delle carte. */
const SELL_TAB = 'vendi';

/**
 * Negozio dei mobili, come il catalogo di Habbo. Si paga in gold; il mobile finisce
 * nell'inventario e si posiziona nella propria stanza. Nell'ultima scheda il negozio ricompra
 * le carte che hanno un prezzo di mercato.
 */
export default function Shop({ catalog, gold, onBought, onCardSold, onClose }) {
  const buyable = useMemo(() => catalog.filter((d) => d.buyable), [catalog]);
  const categories = useMemo(() => [...new Set(buyable.map((d) => d.category))], [buyable]);
  const [category, setCategory] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const active = category || categories[0];

  async function buy(def) {
    setBusy(def.type);
    setError(null);
    try {
      await furniApi.buy(def.type);
      onBought(def);
    } catch (err) {
      setError(err?.status === 402 || err?.message === 'insufficient_gold'
        ? 'Non hai abbastanza gold.'
        : 'Acquisto non riuscito. Riprova.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="hotel-panel hotel-shop" role="dialog" aria-label="Negozio mobili">
      <header className="hotel-panel-header">
        <h3><i className="ph-fill ph-storefront" /> Negozio</h3>
        <span className="hotel-gold"><i className="ph-fill ph-coin" /> {gold}</span>
        <button type="button" className="hotel-panel-close" onClick={onClose} aria-label="Chiudi"><i className="ph ph-x" /></button>
      </header>

      <div className="hotel-tabs" role="tablist">
        {/* Prima scheda: con tante categorie di mobili, in fondo finirebbe fuori vista. */}
        <button type="button" role="tab" aria-selected={active === SELL_TAB}
          className={`hotel-tab hotel-tab-sell${active === SELL_TAB ? ' active' : ''}`} onClick={() => setCategory(SELL_TAB)}>
          <i className="ph-fill ph-hand-coins" /> Vendi carte
        </button>
        {categories.map((c) => (
          <button key={c} type="button" role="tab" aria-selected={active === c}
            className={`hotel-tab${active === c ? ' active' : ''}`} onClick={() => setCategory(c)}>
            {CATEGORY_LABELS[c] || c}
          </button>
        ))}
      </div>

      {active === SELL_TAB && <CardBuyback onSold={onCardSold} />}

      {active !== SELL_TAB && error && <p className="hotel-panel-error">{error}</p>}
      {active !== SELL_TAB && (
      <ul className="hotel-furni-grid">
        {buyable.filter((d) => d.category === active).map((def) => (
          <li key={def.type} className="hotel-furni-card">
            <FurniPreview type={def.type} def={def} />
            <strong>{def.name}</strong>
            <small>{def.wall ? 'A parete' : `${def.width}×${def.length}`}{def.sitDir >= 0 ? ' · ci si siede' : ''}{def.cardDisplay ? ' · espone una carta' : ''}</small>
            <button type="button" className="btn btn-gold btn-small" disabled={busy === def.type || gold < def.price} onClick={() => buy(def)}>
              <i className="ph-fill ph-coin" /> {def.price}
            </button>
          </li>
        ))}
      </ul>
      )}
    </div>
  );
}
