import { useState } from 'react';
import { useApiResource } from '../hooks/useApiResource.js';
import { useAuth } from '../hooks/useAuth.js';
import { leaderboardApi } from '../services/leaderboardApi.js';
import { apiClient } from '../services/apiClient.js';
import { SOURCE_LABELS, getSourceLabel } from '../utils/cardUtils.js';
import LoadingSpinner from '../components/common/LoadingSpinner.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import AnimatedNumber from '../components/fx/AnimatedNumber.jsx';

const TYPES = [
  { key: 'collection', label: 'Collezione' },
  { key: 'gold', label: 'Gold' },
  { key: 'battles', label: 'Battaglie vinte' },
  { key: 'games', label: 'Per gioco' }
];

/** Classifica di un gioco: carte diverse, completamento e premio del lunedi' al primo. */
function GameLeaderboard() {
  const { isAuthenticated } = useAuth();
  const [source, setSource] = useState('pokemon');
  const { loading, data } = useApiResource(
    () => (isAuthenticated ? apiClient.get(`/leaderboard/games?source=${source}`) : Promise.resolve(null)),
    [source, isAuthenticated]
  );
  if (!isAuthenticated) return <EmptyState icon="ph-lock" title="Accedi per vedere le classifiche per gioco" />;
  const rows = data?.entries || [];
  const next = data ? new Date(data.nextPrizeAt).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }) : '';
  return (
    <>
      <div className="game-leaderboard-head glass-panel">
        <label className="filter-group">
          <span className="filter-label">Gioco</span>
          <select className="filter-select" value={source} onChange={(e) => setSource(e.target.value)}>
            {Object.keys(SOURCE_LABELS).map((key) => <option key={key} value={key}>{getSourceLabel(key)}</option>)}
          </select>
        </label>
        {data && (
          <p className="game-leaderboard-prize">
            <i className="ph-fill ph-trophy" /> Il primo di {next} vince <strong>{data.prize} gold</strong>.
            {data.winners?.length > 0 && <> Ultimo vincitore: <strong>{data.winners[0].username}</strong> ({data.winners[0].cards} carte).</>}
          </p>
        )}
      </div>
      {loading ? <LoadingSpinner label="Carico la classifica…" /> : rows.length === 0 ? (
        <EmptyState icon="ph-trophy" title="Nessuno in classifica" description="Nessun giocatore ha ancora carte di questo gioco." />
      ) : (
        <div className="glass-panel" key={source}>
          {rows.map((row, i) => (
            <div className="leaderboard-row" style={{ animationDelay: `${Math.min(i, 20) * 0.04}s` }} key={row.id}>
              <span className={`leaderboard-rank ${i < 3 ? `rank-${i + 1}` : ''}`}>{i + 1}</span>
              <span className="leaderboard-name">{row.username}</span>
              <span className="leaderboard-percent" title={`${row.cards} di ${data.total} carte`}>{row.percent}%</span>
              <span className="leaderboard-value"><AnimatedNumber value={row.cards} /></span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default function LeaderboardPage() {
  const [type, setType] = useState('collection');
  const { loading, error, data, reload } = useApiResource(
    () => (type === 'games' ? Promise.resolve(null) : leaderboardApi.getLeaderboard(type)), [type]
  );
  const rows = data?.entries || [];

  return (
    <section className="leaderboard-page">
      <h2 className="section-title text-gradient"><i className="ph-fill ph-trophy" /> Classifica</h2>

      <div className="tabs-row">
        {TYPES.map((t) => (
          <button key={t.key} className={`btn ${type === t.key ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setType(t.key)}>{t.label}</button>
        ))}
      </div>

      {type === 'games' ? <GameLeaderboard /> : loading ? (
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
              <span className="leaderboard-value"><AnimatedNumber value={row.value} /></span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
