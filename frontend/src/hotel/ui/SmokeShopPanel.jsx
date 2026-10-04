import { formatAmount } from './casino/casinoUtils.js';

/**
 * Bancone della Tabaccheria, del Green Shop e la "vetrina" del tipo losco della discoteca.
 * Stesso catalogo del server (SmokeShop.java): prezzi in gold, tiri, effetto. Quello che si
 * compra finisce subito in mano; il pulsante "Fuma" della barra fa fare un tiro.
 */
const SMOKE_ITEMS = [
  { id: 'cigarette', shop: 'tabacchi', name: 'Sigaretta', price: 8, uses: 5, icon: 'ph-cigarette', text: 'Una bionda classica, cinque tiri.' },
  { id: 'cigar', shop: 'tabacchi', name: 'Sigaro cubano', price: 40, uses: 8, icon: 'ph-cigarette', text: 'Arrotolato a mano, da gustare con calma.' },
  { id: 'pipe', shop: 'tabacchi', name: 'Pipa', price: 25, uses: 7, icon: 'ph-pipe', text: 'Tabacco aromatico alla vaniglia, da vecchio lupo di mare.' },
  { id: 'joint', shop: 'green', name: 'Canna', price: 25, uses: 6, icon: 'ph-leaf', effect: 'chill', text: 'Erba light già rollata: rilassa e mette fame.' },
  { id: 'blunt', shop: 'green', name: 'Spinello XL', price: 50, uses: 10, icon: 'ph-leaf', effect: 'chill', text: 'Il formato da condividere (ma fuma solo chi lo tiene).' },
  { id: 'bong', shop: 'green', name: 'Bong', price: 60, uses: 4, icon: 'ph-flask', effect: 'chill', text: 'Vetro soffiato e bolle: pochi tiri, tanta nuvola.' },
  { id: 'pill', shop: 'dealer', name: 'Pasticca arcobaleno', price: 60, uses: 1, icon: 'ph-pill', effect: 'trip', text: 'Fa vedere tutto a colori e balli da solo. Non chiedere cosa c\'è dentro.' },
  { id: 'mushroom', shop: 'dealer', name: 'Funghetto magico', price: 45, uses: 1, icon: 'ph-sparkle', effect: 'trip', text: 'Il pavimento respira e i muri cambiano colore.' }
];

const SHOPS = {
  tabacchi: { title: 'Tabaccheria', icon: 'ph-cigarette', hint: 'Si fuma per finta: ogni tiro col pulsante "Fuma" della barra.' },
  green: { title: 'Green Shop', icon: 'ph-leaf', hint: 'Erba light al CBD: chi fuma resta rilassato in una nuvola verde per qualche minuto.' },
  dealer: { title: 'Il tipo losco', icon: 'ph-detective', hint: 'Roba "speciale" per la serata: fa vedere i colori e ballare. Occhio al buttafuori: se ti becca, sequestra tutto.' }
};

const EFFECTS = { chill: 'rilassa', trip: 'trip arcobaleno' };

export default function SmokeShopPanel({ shop, gold, busy, onBuy, onClose }) {
  const info = SHOPS[shop] || SHOPS.tabacchi;
  const items = SMOKE_ITEMS.filter((i) => i.shop === shop);
  return (
    <div className={`hotel-panel smoke-shop smoke-${shop}`} role="dialog" aria-label={info.title}>
      <header className="hotel-panel-header">
        <h3><i className={`ph-fill ${info.icon}`} /> {info.title}</h3>
        <button type="button" className="hotel-panel-close" onClick={onClose} aria-label="Chiudi"><i className="ph ph-x" /></button>
      </header>
      <p className="hotel-panel-hint">{info.hint}</p>
      <ul className="smoke-items">
        {items.map((item) => (
          <li key={item.id}>
            <span className="smoke-icon"><i className={`ph-fill ${item.icon}`} /></span>
            <span className="smoke-text">
              <b>{item.name}</b>
              <small>{item.text}</small>
              <small className="smoke-meta">
                {item.uses > 1 ? `${item.uses} tiri` : 'si ingoia'}{item.effect ? ` · effetto: ${EFFECTS[item.effect]}` : ''}
              </small>
            </span>
            <button type="button" className="btn btn-gold btn-small" disabled={busy || gold < item.price} onClick={() => onBuy(item.id)}>
              <i className="ph-fill ph-coin" /> {formatAmount(item.price)}
            </button>
          </li>
        ))}
      </ul>
      <p className="smoke-note">Tutto finto e solo nel gioco. Nella vita vera il fumo fa male davvero.</p>
    </div>
  );
}
