import { useEffect, useMemo, useRef, useState } from 'react';
import { authApi } from '../../services/authApi.js';
import { hotelApi } from '../../services/hotelApi.js';
import { WATCH_STYLES, formatLook, parseLook } from '../sprites/avatar.js';
import { drawVehiclePreview, whenVehicleReady } from '../sprites/vehicles.js';
import AvatarPreview from './AvatarPreview.jsx';
import { tailorAdvice } from './tailor.js';

/** Negozi del quartiere: nome, icona e se c'e' il sarto che consiglia. */
const LUXURY_SHOPS = {
  atelier: { title: 'Atelier di sartoria', icon: 'ph-coat-hanger', tailor: true },
  orologi: { title: 'Gioielleria: orologi e gioielli', icon: 'ph-watch', tailor: true },
  skate: { title: 'Skate shop', icon: 'ph-skateboard' },
  bici: { title: 'Negozio di bici', icon: 'ph-bicycle' },
  auto: { title: 'Concessionaria di auto sportive', icon: 'ph-car-profile' }
};

/** Veicolo in anteprima, girato di tre quarti: con il modello 3D appena e' pronto. */
function VehiclePreview({ ride }) {
  const ref = useRef(null);
  useEffect(() => {
    let alive = true;
    const draw = () => { if (alive && ref.current) drawVehiclePreview(ref.current, ride); };
    draw();
    whenVehicleReady(ride).then(draw);
    return () => { alive = false; };
  }, [ride]);
  return <canvas ref={ref} className="lux-vehicle" width={180} height={120} aria-hidden="true" />;
}

/** Quadrante dell'orologio ingrandito: rotondo, ottagonale ("Quercia Reale") o a botte (scheletrato). */
function WatchFace({ index }) {
  const w = WATCH_STYLES[index];
  if (!w) return null;
  const octagon = index === 5 || index === 6;
  let shape = <circle cx="40" cy="32" r="22" fill={w.steel} stroke={w.bezel} strokeWidth="5" />;
  if (octagon) shape = <polygon points="30,8 50,8 64,22 64,42 50,56 30,56 16,42 16,22" fill={w.steel} stroke={w.bezel} strokeWidth="5" />;
  if (w.skeleton) shape = <rect x="20" y="6" width="40" height="52" rx="14" fill={w.steel} stroke={w.bezel} strokeWidth="4" />;
  if (w.bezel2) {
    shape = (
      <>
        <path d="M18 32 A22 22 0 0 1 62 32 Z" fill={w.bezel} />
        <path d="M18 32 A22 22 0 0 0 62 32 Z" fill={w.bezel2} />
      </>
    );
  }
  return (
    <svg className="lux-watch" viewBox="0 0 80 64" aria-hidden="true">
      <rect x="31" y="0" width="18" height="64" rx="4" fill={w.strap} />
      {shape}
      <circle cx="40" cy="32" r="14" fill={w.dial} />
      {w.skeleton && [0, 1, 2].map((i) => <circle key={i} cx={34 + i * 6} cy={28 + (i % 2) * 8} r="3" fill="none" stroke="#d4a017" strokeWidth="1.5" />)}
      {index === 3 && [26, 30, 34, 38].map((y) => <line key={y} x1="30" x2="50" y1={y} y2={y} stroke="#3b5bb5" strokeWidth="1" />)}
      {octagon && [0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <circle key={i} cx={40 + Math.cos((i * Math.PI) / 4) * 18} cy={32 + Math.sin((i * Math.PI) / 4) * 18} r="1.4" fill="#f5f5f5" />
      ))}
      <line x1="40" y1="32" x2="40" y2="22" stroke="#f8fafc" strokeWidth="2" strokeLinecap="round" />
      <line x1="40" y1="32" x2="47" y2="35" stroke="#f8fafc" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Gioiello ingrandito: collana sul busto o coppia di orecchini. */
function JewelFace({ part, index }) {
  const n = { 1: ['#f8fafc', 'beads'], 2: ['#e0a82e', 'chain'], 3: ['#dbeafe', 'beads'], 4: ['#16a34a', 'pendant'], 5: ['#dc2626', 'beads'], 6: ['#e0a82e', 'medal'] };
  const e = { 1: ['#e0f2fe', 'dot'], 2: ['#e0a82e', 'hoop'], 3: ['#f8fafc', 'drop'], 4: ['#16a34a', 'drop'], 5: ['#dc2626', 'dot'], 6: ['#1d4ed8', 'dot'] };
  if (part === 'n') {
    const [color, kind] = n[index] || [];
    const gold = index === 2 || index === 4 || index === 6;
    return (
      <svg className="lux-watch" viewBox="0 0 80 64" aria-hidden="true">
        <path d="M14 6 Q40 58 66 6" fill="none" stroke={gold ? '#e0a82e' : '#e5e7eb'} strokeWidth={kind === 'chain' ? 5 : 2} />
        {kind === 'beads' && Array.from({ length: 11 }, (_, i) => {
          const t = i / 10;
          const x = 14 + t * 52;
          const y = 6 + 4 * 26 * t * (1 - t) * 1.0;
          return <circle key={i} cx={x} cy={y} r="3.4" fill={color} stroke="rgba(0,0,0,.25)" />;
        })}
        {kind === 'pendant' && <ellipse cx="40" cy="38" rx="5" ry="8" fill={color} stroke="#e0a82e" strokeWidth="1.5" />}
        {kind === 'medal' && <circle cx="40" cy="38" r="8" fill={color} stroke="#a16207" strokeWidth="2" />}
      </svg>
    );
  }
  const [color, shape] = e[index] || [];
  const one = (x) => {
    if (shape === 'hoop') return <circle key={x} cx={x} cy="34" r="12" fill="none" stroke={color} strokeWidth="4" />;
    if (shape === 'drop') return <g key={x}><line x1={x} y1="14" x2={x} y2="26" stroke="#e0a82e" strokeWidth="2" /><ellipse cx={x} cy="36" rx="7" ry="10" fill={color} /></g>;
    return <circle key={x} cx={x} cy="30" r="8" fill={color} stroke="#e5e7eb" strokeWidth="2" />;
  };
  return <svg className="lux-watch" viewBox="0 0 80 64" aria-hidden="true">{[22, 58].map(one)}</svg>;
}

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
          {!data && !error && <p className="hotel-panel-hint">Il commesso apre le vetrine…</p>}
          {advice && (
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
          {items.map((item) => {
            const mine = owned.has(item.key);
            const worn = parts[item.part] === item.index;
            return (
              <article key={item.key} className={`lux-item${mine ? ' owned' : ''}${worn ? ' worn' : ''}`}>
                <div className="lux-item-art">
                  {item.part === 'r' && <VehiclePreview ride={item.index} />}
                  {item.part === 'w' && <WatchFace index={item.index} />}
                  {(item.part === 'n' || item.part === 'e') && <JewelFace part={item.part} index={item.index} />}
                  {item.part === 'o' && <AvatarPreview look={withItem(item)} scale={1} />}
                </div>
                <div className="lux-item-info">
                  <small>{item.brand}</small>
                  <strong>{item.name}</strong>
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
                  {item.part !== 'r' && (
                    <button type="button" className="btn btn-secondary btn-small" onClick={() => setTrying(withItem(item))}>Prova</button>
                  )}
                  {!mine && (
                    <button type="button" className="btn btn-primary btn-small" disabled={busy === item.key || gold < item.price} onClick={() => buy(item)}>
                      {busy === item.key ? '…' : 'Compra'}
                    </button>
                  )}
                  {mine && !worn && (
                    <button type="button" className="btn btn-primary btn-small" disabled={busy === 'wear'} onClick={() => wear(withItem(item))}>
                      {item.part === 'r' ? 'Guida' : 'Indossa'}
                    </button>
                  )}
                  {mine && worn && (
                    <button type="button" className="btn btn-secondary btn-small" disabled={busy === 'wear'} onClick={() => wear(withItem(item, false))}>
                      {item.part === 'r' ? 'Scendi' : 'Togli'}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
      {error && <p className="hotel-panel-error">{error}</p>}
      <p className="hotel-panel-hint">
        {shop === 'auto' || shop === 'bici' || shop === 'skate'
          ? 'I veicoli si guidano nel quartiere e nelle stanze all\'aperto. Si cambiano anche dal guardaroba.'
          : 'Quello che compri finisce nel guardaroba: lo indossi e lo togli quando vuoi.'}
      </p>
    </div>
  );
}
