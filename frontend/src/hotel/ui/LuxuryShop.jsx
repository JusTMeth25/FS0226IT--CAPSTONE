import { useEffect, useMemo, useState } from 'react';
import { authApi } from '../../services/authApi.js';
import { hotelApi } from '../../services/hotelApi.js';
import { formatLook, parseLook } from '../sprites/avatar.js';
import AvatarPreview from './AvatarPreview.jsx';
import LuxuryArt from './LuxuryArt.jsx';
import { tailorAdvice } from './tailor.js';
import GuitarTester from './GuitarTester.jsx';

/** Negozi del quartiere: nome, icona e se c'e' il sarto che consiglia. */
const LUXURY_SHOPS = {
  atelier: { title: 'Atelier di sartoria', icon: 'ph-coat-hanger', tailor: true },
  orologi: { title: 'Gioielleria: orologi e gioielli', icon: 'ph-watch', tailor: true },
  skate: { title: 'Skate shop', icon: 'ph-person-simple-snowboard' },
  bici: { title: 'Negozio di bici', icon: 'ph-bicycle' },
  auto: { title: 'Concessionaria di auto sportive', icon: 'ph-car-profile' },
  chitarre: { title: 'Rock Store: chitarre e bassi', icon: 'ph-guitar' },
  rock: { title: 'Rock Store: abbigliamento rock', icon: 'ph-lightning' }
};

/**
 * Negozio del quartiere: le merci esposte (capi, orologi o veicoli) con il prezzo in gold, la
 * prova su di se' e l'acquisto. Quello che si compra finisce nel guardaroba e si indossa subito.
 * Nell'atelier e in gioielleria il sarto consiglia un abbinamento.
 */
export default function LuxuryShop({ shop, look, gold, onBought, onWear, onClose }) {
  const info = LUXURY_SHOPS[shop] || LUXURY_SHOPS.atelier;
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [trying, setTrying] = useState(null);
  const [advice, setAdvice] = useState(null);
  const [testing, setTesting] = useState(null);
  const [tab, setTab] = useState('shop');
  const [market, setMarket] = useState(null);
  const [selling, setSelling] = useState(null);
  const [notice, setNotice] = useState(null);

  // Usato: annunci dei giocatori per i pezzi di questo negozio.
  useEffect(() => {
    if (tab !== 'used') return undefined;
    let cancelled = false;
    hotelApi.luxuryMarket(shop).then((res) => { if (!cancelled) setMarket(res.listings || []); }).catch(() => { if (!cancelled) setMarket([]); });
    return () => { cancelled = true; };
  }, [tab, shop]);
  // Crediti dei modelli 3D delle auto (Sketchfab, CC Attribution).
  const [credits, setCredits] = useState({});
  useEffect(() => {
    if (shop !== 'auto') return undefined;
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}models/cars/credits.json`).then((r) => r.json())
      .then((data) => { if (!cancelled) setCredits(data); }).catch(() => {});
    return () => { cancelled = true; };
  }, [shop]);
  const parts = useMemo(() => parseLook(look), [look]);

  useEffect(() => {
    let cancelled = false;
    hotelApi.wardrobe().then((res) => { if (!cancelled) setData(res); }).catch(() => { if (!cancelled) setError('Negozio chiuso, riprova.'); });
    return () => { cancelled = true; };
  }, []);

  const items = (data?.items || []).filter((item) => item.shop === shop);
  const owned = new Set(data?.owned || []);
  const serials = data?.serials || {};
  const itemByKey = Object.fromEntries((data?.items || []).map((item) => [item.key, item]));
  const worn = (item) => parts[item.part] === item.index;

  async function run(action, done) {
    setBusy('market');
    setError(null);
    try {
      const res = await action();
      done?.(res);
    } catch (err) {
      const messages = {
        insufficient_gold: 'Non hai abbastanza gold.', item_worn: 'Prima toglilo di dosso: poi puoi venderlo.',
        already_owned: 'Ce l\'hai gia\'.', invalid_price: 'Prezzo non valido.', already_showcased: 'Quest\'auto e\' gia\' nella tua borsa dei mobili.'
      };
      setError(messages[err?.message] || 'Operazione non riuscita. Riprova.');
    } finally {
      setBusy(null);
    }
  }

  const refresh = () => hotelApi.wardrobe().then(setData).catch(() => {});
  const sell = (item, price) => run(() => hotelApi.sellLuxury(item.key, price), (res) => {
    setMarket(res.listings);
    setSelling(null);
    refresh();
    setNotice(`${item.name} e' in vendita all'usato per ${price} gold.`);
  });
  const buyUsed = (listing) => run(() => hotelApi.buyListing(listing.id), (res) => {
    setData(res);
    setMarket((m) => (m || []).filter((l) => l.id !== listing.id));
    onBought?.(itemByKey[listing.item]);
  });
  const withdraw = (listing) => run(() => hotelApi.withdrawListing(listing.id), (res) => {
    setMarket(res.listings);
    refresh();
  });
  const showcase = (item) => run(() => hotelApi.showcaseCar(item.key), () => {
    setNotice(`La pedana con ${item.brand} ${item.name} e' nella tua borsa dei mobili: mettila nella tua stanza!`);
  });
  const preview = trying || look;

  async function buy(item) {
    setBusy(item.key);
    setError(null);
    try {
      const res = await hotelApi.buyLuxury(item.key);
      setData(res);
      onBought?.(item);
    } catch (err) {
      setError(err?.message === 'insufficient_gold' || err?.status === 402 ? 'Non hai abbastanza gold.' : 'Acquisto non riuscito. Riprova.');
    } finally {
      setBusy(null);
    }
  }

  async function wear(nextLook) {
    setBusy('wear');
    setError(null);
    try {
      await authApi.updateLook(nextLook);
      setTrying(null);
      onWear?.(nextLook);
    } catch {
      setError('Non sono riuscito a cambiarti. Riprova.');
    } finally {
      setBusy(null);
    }
  }

  const withItem = (item, on = true) => formatLook({ ...parts, [item.part]: on ? item.index : 0 });

  function askTailor() {
    setAdvice(tailorAdvice(parts, owned, data?.items || []));
  }

  return (
    <div className="hotel-panel hotel-luxury" role="dialog" aria-label={info.title}>
      <header className="hotel-panel-header">
        <h3><i className={`ph-fill ${info.icon}`} /> {info.title}</h3>
        <span className="hotel-gold"><i className="ph-fill ph-coin" /> {gold}</span>
        <button type="button" className="hotel-panel-close" onClick={onClose} aria-label="Chiudi"><i className="ph ph-x" /></button>
      </header>

      <div className="lux-body">
        <div className="lux-mirror">
          <AvatarPreview look={preview} scale={2} walking />
          <small>{trying ? 'In prova' : 'Come sei adesso'}</small>
          {trying && <button type="button" className="btn btn-secondary btn-small" onClick={() => setTrying(null)}>Togli la prova</button>}
          {info.tailor && (
            <button type="button" className="btn btn-primary btn-small" onClick={askTailor} disabled={!data}>
              <i className="ph-fill ph-scissors" /> {shop === 'atelier' ? 'Chiedi al sarto' : 'Chiedi un consiglio'}
            </button>
          )}
        </div>

        <div className="lux-list">
          <div className="lux-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'shop'} className={tab === 'shop' ? 'active' : ''} onClick={() => setTab('shop')}>
              <i className="ph-fill ph-storefront" /> Negozio
            </button>
            <button type="button" role="tab" aria-selected={tab === 'used'} className={tab === 'used' ? 'active' : ''} onClick={() => setTab('used')}>
              <i className="ph-fill ph-recycle" /> Usato
            </button>
          </div>
          {notice && <p className="hotel-panel-hint" role="status">{notice}</p>}
          {tab === 'used' && (
            <>
              {market === null && <p className="hotel-panel-hint">Carico gli annunci…</p>}
              {market?.length === 0 && <p className="hotel-panel-hint">Nessuno vende niente, per ora. Vendi tu qualcosa dalla scheda Negozio!</p>}
              {(market || []).map((listing) => {
                const item = itemByKey[listing.item];
                if (!item) return null;
                return (
                  <article key={listing.id} className="lux-item">
                    <div className="lux-item-art"><LuxuryArt part={item.part} index={item.index} look={item.part === 'o' ? withItem(item) : null} /></div>
                    <div className="lux-item-info">
                      <small>{item.brand}</small>
                      <strong>{item.name}{listing.serial ? <span className="lux-serial">#{listing.serial}/{data?.limitedCopies || 10}</span> : null}</strong>
                      <p>Venduto da {listing.mine ? 'te' : listing.seller} · nuovo costa {item.price} gold</p>
                    </div>
                    <div className="lux-item-actions">
                      <span className="lux-price"><i className="ph-fill ph-coin" /> {listing.price}</span>
                      {listing.mine ? (
                        <button type="button" className="btn btn-secondary btn-small" disabled={busy === 'market'} onClick={() => withdraw(listing)}>Ritira</button>
                      ) : (
                        <button type="button" className="btn btn-primary btn-small" disabled={busy === 'market' || owned.has(item.key) || gold < listing.price} onClick={() => buyUsed(listing)}>
                          {owned.has(item.key) ? 'Ce l\'hai' : 'Compra'}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </>
          )}
          {tab === 'shop' && !data && !error && <p className="hotel-panel-hint">Il commesso apre le vetrine…</p>}
          {tab === 'shop' && advice && (
            <div className="lux-advice">
              <strong><i className="ph-fill ph-scissors" /> {shop === 'atelier' ? 'Il sarto dice:' : 'Il commesso dice:'}</strong>
              <p>{advice.text}</p>
              <div className="lux-advice-actions">
                <button type="button" className="btn btn-secondary btn-small" onClick={() => setTrying(advice.look)}>Provalo</button>
                {advice.missing.length === 0 && advice.look !== look && (
                  <button type="button" className="btn btn-primary btn-small" disabled={busy === 'wear'} onClick={() => wear(advice.look)}>Indossa tutto</button>
                )}
              </div>
            </div>
          )}
          {tab === 'shop' && items.map((item) => {
            const mine = owned.has(item.key);
            const isWorn = worn(item);
            return (
              <article key={item.key} className={`lux-item${mine ? ' owned' : ''}${isWorn ? ' worn' : ''}`}>
                <div className="lux-item-art">
                  <LuxuryArt part={item.part} index={item.index} look={item.part === 'o' ? withItem(item) : null} />
                </div>
                <div className="lux-item-info">
                  <small>{item.brand}</small>
                  <strong>{item.name}{serials[item.key] ? <span className="lux-serial" title="Edizione limitata vinta all'asta">#{serials[item.key]}/{data.limitedCopies}</span> : null}</strong>
                  <p>{item.description}</p>
                  {item.part === 'r' && <span className="lux-speed"><i className="ph-fill ph-gauge" /> {item.speed}x piu&apos; veloce all&apos;aperto</span>}
                  {credits[item.key] && (
                    <a className="lux-credit" href={credits[item.key].url} target="_blank" rel="noreferrer">
                      Modello 3D &quot;{credits[item.key].name}&quot; di {credits[item.key].author} ({credits[item.key].license})
                    </a>
                  )}
                </div>
                <div className="lux-item-actions">
                  {!mine && <span className="lux-price"><i className="ph-fill ph-coin" /> {item.price}</span>}
                  {item.part === 'g' && (
                    <button type="button" className="btn btn-secondary btn-small" onClick={() => setTesting(item)}>
                      <i className="ph-fill ph-speaker-high" /> Suona
                    </button>
                  )}
                  {item.part !== 'r' && (
                    <button type="button" className="btn btn-secondary btn-small" onClick={() => setTrying(withItem(item))}>Prova</button>
                  )}
                  {!mine && (
                    <button type="button" className="btn btn-primary btn-small" disabled={busy === item.key || gold < item.price} onClick={() => buy(item)}>
                      {busy === item.key ? '…' : 'Compra'}
                    </button>
                  )}
                  {mine && !isWorn && (
                    <button type="button" className="btn btn-primary btn-small" disabled={busy === 'wear'} onClick={() => wear(withItem(item))}>
                      {item.part === 'r' ? 'Guida' : item.part === 'g' ? 'A tracolla' : 'Indossa'}
                    </button>
                  )}
                  {mine && item.part === 'r' && /^r[5-9]$/.test(item.key) && (
                    <button type="button" className="btn btn-secondary btn-small" disabled={busy === 'market'} onClick={() => showcase(item)}>
                      <i className="ph-fill ph-garage" /> In casa
                    </button>
                  )}
                  {mine && !isWorn && (
                    selling === item.key ? (
                      <form className="lux-sell" onSubmit={(e) => { e.preventDefault(); sell(item, Number(new FormData(e.currentTarget).get('price'))); }}>
                        <input name="price" type="number" min={Math.max(10, Math.floor(item.price / 10))} max={item.price * 5} defaultValue={Math.round(item.price * 0.7)} aria-label="Prezzo in gold" />
                        <button type="submit" className="btn btn-primary btn-small" disabled={busy === 'market'}>Metti in vendita</button>
                      </form>
                    ) : (
                      <button type="button" className="btn btn-secondary btn-small" onClick={() => setSelling(item.key)}>
                        <i className="ph-fill ph-tag" /> Vendi
                      </button>
                    )
                  )}
                  {mine && isWorn && (
                    <button type="button" className="btn btn-secondary btn-small" disabled={busy === 'wear'} onClick={() => wear(withItem(item, false))}>
                      {item.part === 'r' ? 'Scendi' : item.part === 'g' ? 'Posa' : 'Togli'}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
      {testing && <GuitarTester index={testing.index} name={`${testing.brand} ${testing.name}`} onClose={() => setTesting(null)} />}
      {error && <p className="hotel-panel-error">{error}</p>}
      <p className="hotel-panel-hint">
        {shop === 'auto' || shop === 'bici' || shop === 'skate'
          ? 'I veicoli si guidano nel quartiere e nelle stanze all\'aperto. Si cambiano anche dal guardaroba.'
          : 'Quello che compri finisce nel guardaroba: lo indossi e lo togli quando vuoi.'}
      </p>
    </div>
  );
}
