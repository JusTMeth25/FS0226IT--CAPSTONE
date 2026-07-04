import { useState } from 'react';
import { useApiResource } from '../hooks/useApiResource.js';
import { leaderboardApi } from '../services/leaderboardApi.js';
import LoadingSpinner from '../components/common/LoadingSpinner.jsx';
import EmptyState from '../components/common/EmptyState.jsx';

const TYPES = [
  { key: 'collection', label: 'Collezione' },
  { key: 'gold', label: 'Gold' },
  { key: 'battles', label: 'Battaglie vinte' }
];

export default function LeaderboardPage() {
  const [type, setType] = useState('collection');
  const { loading, error, data, reload } = useApiResource(() => leaderboardApi.getLeaderboard(type), [type]);
  const rows = data?.entries || [];

  return (
    <section className="leaderboard-page">
      <h2 className="section-title text-gradient"><i className="ph-fill ph-trophy" /> Classifica</h2>

      <div className="tabs-row">
        {TYPES.map((t) => (
          <button key={t.key} className={`btn ${type === t.key ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setType(t.key)}>{t.label}</button>
        ))}
      </div>

      {loading ? (
        <LoadingSpinner label="Carico la classifica…" />
      ) : error ? (
        <EmptyState
          icon="ph-plug"
          title="Classifica non raggiungibile"
          description="Il servizio classifica non è al momento disponibile. Riprova più tardi."
          action={<button className="btn btn-secondary" onClick={reload}><i className="ph-fill ph-arrows-clockwise" /> Riprova</button>}
        />
      ) : rows.length === 0 ? (
        <EmptyState icon="ph-trophy" title="Classifica vuota" description="Non ci sono ancora dati sufficienti per questa classifica." />
      ) : (
        <div className="glass-panel" key={type}>
          {rows.map((row, i) => (
            <div className="leaderboard-row" style={{ animationDelay: `${Math.min(i, 20) * 0.04}s` }} key={row.userId || i}>
              <span className={`leaderboard-rank ${i < 3 ? `rank-${i + 1}` : ''}`}>{i + 1}</span>
              <span className="leaderboard-name">{row.username}</span>
              <span className="leaderboard-value">{row.value}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
