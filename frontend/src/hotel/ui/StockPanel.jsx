import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../../services/apiClient.js';

/**
 * Borsa di Wall Street: listino dei titoli (un'azione per gioco di carte e l'indice VinylDex) con
 * il mini grafico dell'ultima ora, il grafico grande del titolo scelto (1 ora, 24 ore, 7 giorni),
 * compravendita coi gold (commissione 0,5%), portafoglio con guadagni e perdite e il nastro
 * degli scambi di giocatori e trader NPC. Le quotazioni seguono i prezzi veri delle carte.
 */

const RANGES = [['1h', '1 ora'], ['24h', '24 ore'], ['7d', '7 giorni']];
const ERRORS = {
  insufficient_gold: 'Non hai abbastanza gold.',
  stock_not_enough_shares: 'Non hai abbastanza azioni da vendere.',
  stock_bad_shares: 'Quantità non valida.',
  stock_closed: 'La borsa sta aprendo: riprova fra qualche secondo.'
};
const fmt = (n, digits = 2) => Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const sign = (n) => (n > 0 ? '+' : '');

function Spark({ points, up }) {
  if (!points || points.length < 2) return <svg className="stock-spark" viewBox="0 0 80 24" />;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const d = points.map((p, i) => `${(i / (points.length - 1)) * 80},${22 - ((p - min) / span) * 20}`).join(' ');
  return (
    <svg className="stock-spark" viewBox="0 0 80 24" aria-hidden="true">
      <polyline points={d} fill="none" stroke={up ? '#22c55e' : '#ef4444'} strokeWidth="1.6" />
    </svg>
  );
}

/** Grafico grande: area sotto la linea dei prezzi di chiusura, massimo e minimo, ultimo prezzo. */
function Chart({ history }) {
  const points = history?.points || [];
  if (points.length < 2) return <div className="stock-chart empty">Il grafico si riempie minuto dopo minuto…</div>;
  const W = 600;
  const H = 220;
  const closes = points.map((p) => p.close);
  const lows = points.map((p) => p.low);
  const highs = points.map((p) => p.high);
  const min = Math.min(...lows);
  const max = Math.max(...highs);
  const span = max - min || 1;
  const x = (i) => 40 + (i / (points.length - 1)) * (W - 50);
  const y = (v) => 14 + (1 - (v - min) / span) * (H - 34);
  const line = closes.map((c, i) => `${x(i)},${y(c)}`).join(' ');
  const up = closes[closes.length - 1] >= closes[0];
  const color = up ? '#22c55e' : '#ef4444';
  const ticks = [max, (max + min) / 2, min];
  const first = new Date(points[0].at);
  const last = new Date(points[points.length - 1].at);
  const label = (d) => (history.range === '7d' ? d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }) : d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }));
  return (
    <svg className="stock-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Grafico di ${history.symbol}`}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1="40" x2={W - 10} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.08)" />
          <text x="34" y={y(t) + 4} textAnchor="end" fontSize="10" fill="#9ca3af">{fmt(t)}</text>
        </g>
      ))}
      {history.range !== '1h' && points.map((p, i) => (
        <line key={p.at} x1={x(i)} x2={x(i)} y1={y(p.high)} y2={y(p.low)} stroke={p.close >= p.open ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)'} strokeWidth="2" />
      ))}
      <polygon points={`40,${H - 20} ${line} ${x(points.length - 1)},${H - 20}`} fill={up ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)'} />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2" />
      <circle cx={x(points.length - 1)} cy={y(closes[closes.length - 1])} r="4" fill={color} />
      <text x="40" y={H - 4} fontSize="10" fill="#9ca3af">{label(first)}</text>
      <text x={W - 10} y={H - 4} fontSize="10" fill="#9ca3af" textAnchor="end">{label(last)}</text>
    </svg>
  );
}

export default function StockPanel({ gold, onGold, onClose }) {
  const [data, setData] = useState(null);
  const [symbol, setSymbol] = useState('VDX');
  const [range, setRange] = useState('1h');
  const [history, setHistory] = useState(null);
  const [shares, setShares] = useState(10);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  // Listino e portafoglio ogni 3 secondi, grafico ogni 10 (o subito cambiando titolo o periodo).
  useEffect(() => {
    let cancelled = false;
    const load = () => apiClient.get('/stocks').then((res) => { if (!cancelled) setData(res); }).catch(() => {});
    load();
    const id = setInterval(load, 3000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);
  useEffect(() => {
    let cancelled = false;
    const load = () => apiClient.get(`/stocks/${symbol}/history?range=${range}`).then((res) => { if (!cancelled) setHistory({ ...res, range }); }).catch(() => {});
    load();
    const id = setInterval(load, range === '1h' ? 5000 : 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, [symbol, range]);

  const stock = data?.stocks?.find((s) => s.symbol === symbol);
  const held = data?.portfolio?.find((p) => p.symbol === symbol);
  const total = stock ? Math.round(stock.price * shares) : 0;
  const fee = Math.max(1, Math.round(total * (data?.fee || 0.005)));
  const portfolioValue = useMemo(() => (data?.portfolio || []).reduce((s, p) => s + p.value, 0), [data]);
  const portfolioPnl = useMemo(() => (data?.portfolio || []).reduce((s, p) => s + p.pnl, 0), [data]);

  async function trade(side) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await apiClient.post('/stocks/trade', { symbol, side, shares });
      setData(res);
      onGold?.(res.gold);
      const d = res.done;
      setMessage({ ok: true, text: `${side === 'buy' ? 'Comprate' : 'Vendute'} ${d.shares} ${d.symbol} a ${fmt(d.price)} · ${side === 'buy' ? 'spesi' : 'incassati'} ${side === 'buy' ? d.total + d.fee : d.total - d.fee} gold (commissione ${d.fee}).` });
    } catch (err) {
      setMessage({ ok: false, text: ERRORS[err.code] || err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="hotel-panel stock-panel" role="dialog" aria-label="Borsa di Wall Street">
      <header className="hotel-panel-header">
        <h3><i className="ph-fill ph-chart-line-up" /> Borsa di Wall Street</h3>
        <span className="stock-gold"><i className="ph-fill ph-coin" /> {fmt(gold, 0)}</span>
        <button type="button" className="hotel-panel-close" onClick={onClose} aria-label="Chiudi"><i className="ph ph-x" /></button>
      </header>
      {!data ? <p className="hotel-panel-hint">Apro la borsa…</p> : (
        <div className="stock-body">
          <ul className="stock-list">
            {data.stocks.map((s) => (
              <li key={s.symbol}>
                <button type="button" className={`stock-row${s.symbol === symbol ? ' active' : ''}`} onClick={() => setSymbol(s.symbol)}>
                  <span className="stock-sym"><b>{s.symbol}</b><small>{s.name}</small></span>
                  <Spark points={s.spark} up={s.change >= 0} />
                  <span className="stock-price"><b>{fmt(s.price)}</b><small className={s.change >= 0 ? 'up' : 'down'}>{sign(s.change)}{fmt(s.change)}%</small></span>
                </button>
              </li>
            ))}
          </ul>
          <div className="stock-detail">
            {stock && (
              <div className="stock-head">
                <div><b>{stock.symbol}</b> {stock.name}</div>
                <div className="stock-head-price">{fmt(stock.price)} <small className={stock.change >= 0 ? 'up' : 'down'}>{sign(stock.change)}{fmt(stock.change)}% in 24h</small></div>
              </div>
            )}
            <div className="stock-ranges" role="radiogroup" aria-label="Periodo">
              {RANGES.map(([key, label]) => (
                <button key={key} type="button" className={range === key ? 'active' : ''} aria-pressed={range === key} onClick={() => setRange(key)}>{label}</button>
              ))}
            </div>
            <Chart history={history?.symbol === symbol ? history : null} />
            <div className="stock-trade">
              <label>Azioni <input type="number" min="1" max="100000" value={shares} onChange={(e) => setShares(Math.max(1, Math.min(100000, Number(e.target.value) || 1)))} /></label>
              {[1, 10, 50, 100].map((n) => <button key={n} type="button" className="stock-qty" onClick={() => setShares(n)}>{n}</button>)}
              <span className="stock-cost">≈ {fmt(total, 0)} gold + {fee} commissione</span>
              <button type="button" className="btn btn-small stock-buy" disabled={busy || gold < total + fee} onClick={() => trade('buy')}>Compra</button>
              <button type="button" className="btn btn-small stock-sell" disabled={busy || !held || held.shares < shares} onClick={() => trade('sell')}>Vendi</button>
            </div>
            {held && <p className="stock-held">Hai {held.shares} {symbol}: valgono {fmt(held.value, 0)} gold, pagate {fmt(held.cost, 0)} · <b className={held.pnl >= 0 ? 'up' : 'down'}>{sign(held.pnl)}{fmt(held.pnl, 0)}</b></p>}
            {message && <div className={`auth-message auth-message-${message.ok ? 'success' : 'error'}`}>{message.text}</div>}
            <div className="stock-bottom">
              <div className="stock-portfolio">
                <h4>Il tuo portafoglio</h4>
                {data.portfolio?.length ? (
                  <>
                    <ul>{data.portfolio.map((p) => (
                      <li key={p.symbol}><button type="button" onClick={() => setSymbol(p.symbol)}>{p.symbol}</button> {p.shares} az. · {fmt(p.value, 0)} <b className={p.pnl >= 0 ? 'up' : 'down'}>{sign(p.pnl)}{fmt(p.pnl, 0)}</b></li>
                    ))}</ul>
                    <p>Totale {fmt(portfolioValue, 0)} gold · <b className={portfolioPnl >= 0 ? 'up' : 'down'}>{sign(portfolioPnl)}{fmt(portfolioPnl, 0)}</b></p>
                  </>
                ) : <p className="stock-empty">Nessuna azione: compra il primo titolo!</p>}
              </div>
              <div className="stock-feed">
                <h4>Nastro degli scambi</h4>
                <ul>{(data.feed || []).slice(0, 8).map((f) => (
                  <li key={`${f.at}-${f.who}-${f.symbol}`}><b>{f.who}</b> {f.side === 'buy' ? 'compra' : 'vende'} {f.shares} <span className={f.side === 'buy' ? 'up' : 'down'}>{f.symbol}</span> a {fmt(f.price)}</li>
                ))}</ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
