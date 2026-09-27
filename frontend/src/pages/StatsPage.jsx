import { useApiResource } from '../hooks/useApiResource.js';
import { extrasApi } from '../services/extrasApi.js';
import { RARITIES, formatMarketPrice, getRarityColor, getSourceLabel } from '../utils/cardUtils.js';
import LoadingSpinner from '../components/common/LoadingSpinner.jsx';
import EmptyState from '../components/common/EmptyState.jsx';

const SOURCE_COLORS = {
  original: '#a855f7', pokemon: '#facc15', yugioh: '#b45309', scryfall: '#f97316', onepiece: '#ef4444',
  digimon: '#3b82f6', dragonball: '#fb923c', lorcana: '#8b5cf6', gundam: '#94a3b8', riftbound: '#14b8a6', nikke: '#e11d48', fc27: '#22c55e'
};

/** Valore della collezione negli ultimi 30 giorni: linea con l'area sotto. */
function ValueChart({ points }) {
  const w = 600;
  const h = 180;
  const pad = 8;
  const max = Math.max(1, ...points.map((p) => p.value));
  const x = (i) => pad + (i / Math.max(1, points.length - 1)) * (w - pad * 2);
  const y = (v) => h - pad - (v / max) * (h - pad * 2);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1)},${h - pad} L${x(0)},${h - pad} Z`;
  const last = points[points.length - 1];
  return (
    <svg className="stats-chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Valore della collezione: oggi ${formatMarketPrice(last?.value)}`}>
      <defs>
        <linearGradient id="statsArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a855f7" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => <line key={f} x1={pad} x2={w - pad} y1={y(max * f)} y2={y(max * f)} className="stats-grid" />)}
      <path d={area} fill="url(#statsArea)" />
      <path d={line} fill="none" stroke="#e879f9" strokeWidth="3" strokeLinejoin="round" />
      {last && <circle cx={x(points.length - 1)} cy={y(last.value)} r="5" fill="#fff" stroke="#e879f9" strokeWidth="3" />}
    </svg>
  );
}

/** Barre orizzontali con etichetta, valore e colore per voce. */
function Bars({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="stats-bars">
      {rows.map((r) => (
        <li key={r.key}>
          <span className="stats-bar-label">{r.label}</span>
          <span className="stats-bar-track"><span style={{ width: `${(r.value / max) * 100}%`, background: r.color }} /></span>
          <strong>{r.value}</strong>
        </li>
      ))}
    </ul>
  );
}

/** Statistiche della collezione: valore nel tempo, carte per gioco e rarita', pacchetti e fortuna. */
export default function StatsPage() {
  const { loading, data } = useApiResource(() => extrasApi.stats(), []);
  if (loading) return <LoadingSpinner />;
  if (!data) return <EmptyState icon="ph-chart-line" title="Statistiche non disponibili" description="Riprova tra poco." />;

  const luckDelta = data.luck != null && data.averageLuck ? Math.round(((data.luck - data.averageLuck) / data.averageLuck) * 100) : null;
  const numbers = [
    { icon: 'ph-cards', label: 'Carte diverse', value: data.uniqueCards },
    { icon: 'ph-copy', label: 'Copie totali', value: data.copies },
    { icon: 'ph-currency-dollar', label: 'Valore stimato', value: formatMarketPrice(data.value) || '—' },
    { icon: 'ph-gift', label: 'Pacchetti aperti', value: data.packsOpened },
    { icon: 'ph-crown', label: 'Leggendarie trovate', value: data.legendaryPulls },
    { icon: 'ph-calendar', label: 'Giorni da collezionista', value: data.daysCollecting }
  ];

  return (
    <section className="stats-page">
      <h2 className="section-title text-gradient"><i className="ph-fill ph-chart-line" /> Statistiche</h2>
      <ul className="stats-numbers">
        {numbers.map((n) => (
          <li key={n.label} className="glass-panel"><i className={`ph-fill ${n.icon}`} /><strong>{n.value}</strong><span>{n.label}</span></li>
        ))}
      </ul>

      <div className="glass-panel">
        <h3 className="panel-title"><i className="ph-fill ph-trend-up" /> Valore della collezione (30 giorni)</h3>
        <ValueChart points={data.timeline} />
        <p className="stats-note">Le carte contano dal giorno in cui sono arrivate, al prezzo di mercato di oggi.</p>
      </div>

      <div className="stats-columns">
        <div className="glass-panel">
          <h3 className="panel-title"><i className="ph-fill ph-stack" /> Carte per gioco</h3>
          <Bars rows={Object.entries(data.bySource).sort((a, b) => b[1] - a[1])
            .map(([key, value]) => ({ key, label: getSourceLabel(key), value, color: SOURCE_COLORS[key] || '#a855f7' }))} />
        </div>
        <div className="glass-panel">
          <h3 className="panel-title"><i className="ph-fill ph-diamond" /> Carte per rarità</h3>
          <Bars rows={Object.entries(data.byRarity).reverse()
            .map(([key, value]) => ({ key, label: RARITIES[key]?.name || key, value, color: getRarityColor(key) }))} />
        </div>
      </div>

      <div className="glass-panel stats-luck">
        <h3 className="panel-title"><i className="ph-fill ph-clover" /> Fortuna nei pacchetti</h3>
        {data.luck == null ? <p>Apri qualche pacchetto per misurare la tua fortuna.</p> : (
          <>
            <div className="stats-luck-row">
              <span>Tu <strong>{data.luck.toFixed(2)}</strong></span>
              <span>Media dei giocatori <strong>{data.averageLuck?.toFixed(2)}</strong></span>
            </div>
            <p className={luckDelta >= 0 ? 'stats-lucky' : 'stats-unlucky'}>
              {luckDelta >= 0 ? `Sei piu' fortunato della media del ${luckDelta}%` : `Sei sotto la media del ${-luckDelta}%: rifatti col prossimo pacchetto!`}
            </p>
            <p className="stats-note">Punti rarità medi delle carte trovate: 1 comune, 2 non comune, 3 rara, 4 epica, 5 leggendaria.</p>
          </>
        )}
      </div>
    </section>
  );
}
