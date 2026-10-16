import { useState } from 'react';
import { useApiResource } from '../hooks/useApiResource.js';
import { useAuth } from '../hooks/useAuth.js';
import { leaderboardApi } from '../services/leaderboardApi.js';
import { apiClient } from '../services/apiClient.js';
import { SOURCE_LABELS, getSourceLabel } from '../utils/cardUtils.js';
import LoadingSpinner from '../components/common/LoadingSpinner.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import AnimatedNumber from '../components/fx/AnimatedNumber.jsx';
import { m } from 'motion/react';
import PhantomTitle from '../components/phantom/PhantomTitle.jsx';
import StarBurst from '../components/phantom/StarBurst.jsx';
import '../styles/pages/game-ranks.css';

const TYPES = [
  { key: 'collection', label: 'Collezione' },
  { key: 'gold', label: 'Gold' },
  { key: 'battles', label: 'Battaglie vinte' },
  { key: 'games', label: 'Per gioco' }
];

/**
 * Podio dei primi tre e, sotto, il resto della classifica in righe dritte.
 * Nel DOM l'ordine resta 1-2-3 (lettori di schermo, tastiera); il CSS mette il primo al centro.
 * `extra(row)` aggiunge un dato accanto al valore (la percentuale nella classifica per gioco).
 */
function Ranking({ rows, rowKey, value, extra }) {
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);
  return (
    <div className="lb-ranking">
      <ol className="lb-podium" aria-label="Podio">
        {podium.map((row, i) => (
          <m.li
            key={rowKey(row, i)}
            className={`lb-step lb-step-${i + 1}`}
            initial={{ y: 48, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            // Prima il terzo, poi il secondo, per ultimo il primo: la suspense del podio.
            transition={{ type: 'spring', stiffness: 460, damping: 26, delay: (2 - i) * 0.09 }}
          >
            {i === 0 && <StarBurst size={46} fill="var(--neon-gold)" stroke="#000" className="lb-star" />}
            <span className="lb-step-name" title={row.username}>{row.username}</span>
            <span className="lb-step-value"><AnimatedNumber value={value(row)} />{extra && <small>{extra(row)}</small>}</span>
            <span className="lb-step-block" aria-hidden="true"><span>{i + 1}</span></span>
            <span className="sr-only">{i + 1}° posto</span>
          </m.li>
        ))}
      </ol>
      {rest.length > 0 && (
        <ol className="lb-list glass-panel" start={4}>
          {rest.map((row, i) => (
            <li className="leaderboard-row" style={{ animationDelay: `${Math.min(i, 20) * 0.04}s` }} key={rowKey(row, i + 3)}>
              <span className="leaderboard-rank">{i + 4}</span>
              <span className="leaderboard-name">{row.username}</span>
              {extra && <span className="leaderboard-percent">{extra(row)}</span>}
              <span className="leaderboard-value"><AnimatedNumber value={value(row)} /></span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

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
        <Ranking key={source} rows={rows} rowKey={(row) => row.id} value={(row) => row.cards}
          extra={(row) => `${row.percent}%`} />
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
      <PhantomTitle text="Classifica" className="game-page-title" />

      <div className="tabs-row lb-tabs">
        {TYPES.map((t) => (
          <button key={t.key} className={`btn ${type === t.key ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={type === t.key} onClick={() => setType(t.key)}>{t.label}</button>
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
        <Ranking key={type} rows={rows} rowKey={(row, i) => row.userId || i} value={(row) => row.value} />
      )}
    </section>
  );
}
