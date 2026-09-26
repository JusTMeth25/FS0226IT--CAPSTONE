import { useEffect, useState } from 'react';
import { apiClient } from '../../services/apiClient.js';

const W = 480;
const H = 150;
const PAD = 28;

function Chart({ points, color, format, label }) {
  if (points.length === 0) return <p className="price-history-empty">{label}: ancora nessun dato.</p>;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || Math.max(1, max * 0.1);
  const x = (i) => PAD + (points.length === 1 ? (W - PAD * 2) / 2 : (i / (points.length - 1)) * (W - PAD * 2));
  const y = (v) => H - PAD - ((v - (min - span * 0.1)) / (span * 1.2)) * (H - PAD * 2);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)},${H - PAD} L${x(0).toFixed(1)},${H - PAD} Z`;
  const last = points[points.length - 1];
  const first = points[0];
  const trend = last.value - first.value;
  return (
    <figure className="price-chart">
      <figcaption>
        <span>{label}</span>
        <b style={{ color }}>{format(last.value)}</b>
        {points.length > 1 && (
          <small className={trend >= 0 ? 'up' : 'down'}>
            <i className={`ph-bold ${trend >= 0 ? 'ph-trend-up' : 'ph-trend-down'}`} /> {trend >= 0 ? '+' : ''}{format(trend)}
          </small>
        )}
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: da ${format(first.value)} a ${format(last.value)}`}>
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="rgba(255,255,255,.15)" />
        <path d={area} fill={color} opacity=".12" />
        <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
        {points.map((p, i) => <circle key={`${p.label}-${i}`} cx={x(i)} cy={y(p.value)} r={points.length > 40 ? 1.5 : 3} fill={color}><title>{`${p.label}: ${format(p.value)}`}</title></circle>)}
        <text x={PAD} y={H - 8} fill="rgba(255,255,255,.6)" fontSize="11">{first.label}</text>
        <text x={W - PAD} y={H - 8} fill="rgba(255,255,255,.6)" fontSize="11" textAnchor="end">{last.label}</text>
      </svg>
    </figure>
  );
}

const usd = (v) => `${v.toFixed(2)} USD`;
const gold = (v) => `${Math.round(v)} gold`;

/**
 * Andamento del prezzo di una carta: il valore di mercato giorno per giorno (salvato dal server
 * ogni giorno) e le vendite fra giocatori nel Mercato, in gold.
 */
export default function PriceHistory({ code }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let cancelled = false;
    apiClient.get(`/cards/${encodeURIComponent(code)}/price-history`).then((res) => { if (!cancelled) setData(res); }).catch(() => {});
    return () => { cancelled = true; };
  }, [code]);
  if (!data || (data.market.length === 0 && data.sales.length === 0)) return null;
  const market = data.market.map((p) => ({ value: Number(p.price), label: new Date(p.day).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) }));
  const sales = [...data.sales].reverse().map((p) => ({ value: Number(p.price), label: new Date(p.at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) }));
  return (
    <section className="price-history glass-panel">
      <h3><i className="ph-fill ph-chart-line-up" /> Andamento del prezzo</h3>
      {data.market.length > 0 && <Chart points={market} color="#fbbf24" format={usd} label="Valore di mercato" />}
      {data.sales.length > 0 && <Chart points={sales} color="#22d3ee" format={gold} label="Vendite nel Mercato" />}
      {data.market.length === 1 && <p className="price-history-empty">Il grafico si riempie un giorno alla volta.</p>}
    </section>
  );
}
