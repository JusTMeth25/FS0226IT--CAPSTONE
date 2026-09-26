import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../../services/apiClient.js';

const ROUND_NAMES = ['Finale', 'Semifinali', 'Quarti'];

function roundName(round, total) {
  return ROUND_NAMES[total - round] || `Turno ${round}`;
}
const GAME_ICONS = { bowling: 'ph-bowling-ball', pool: 'ph-circle-half' };

function left(ms) {
  const m = Math.max(0, Math.floor(ms / 60000));
  const s = Math.max(0, Math.floor((ms % 60000) / 1000));
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Torneo a eliminazione: iscrizioni, tabellone con i turni (quarti, semifinali, finale) e
 * l'incontro da giocare. Il minigioco del torneo si gioca dove si vuole nell'hotel.
 */
export function TournamentTab({ me, version }) {
  const [data, setData] = useState(null);
  const [notice, setNotice] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(() => {
    apiClient.get('/hotel/tournament').then(setData).catch(() => setNotice('Tornei non raggiungibili.'));
  }, []);
  useEffect(() => { load(); }, [load, version]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const run = (path, ok) => apiClient.post(path).then((res) => { setData(res); setNotice(ok); })
    .catch((err) => setNotice(err?.code === 'tournament_full' ? 'Torneo al completo.' : 'Non riuscito, riprova.'));

  if (!data) return <p className="hotel-panel-hint">{notice || 'Carico il torneo…'}</p>;
  const t = data.tournament;
  const rounds = t ? [...new Set(t.matches.map((m) => m.round))] : [];
  // Turni in tutto: dal numero di incontri del primo turno (4 = quarti, semifinali, finale).
  const firstRound = t ? t.matches.filter((m) => m.round === 1).length : 0;
  const totalRounds = Math.max(1, Math.round(Math.log2(firstRound * 2)));
  const myMatch = t?.matches.find((m) => m.round === t.round && !m.winnerId && (m.aId === me?.id || m.bId === me?.id));
  return (
    <div className="tournament-tab">
      {notice && <p className="hotel-panel-hint" role="status">{notice}</p>}
      {t && (
        <section className="tournament-card">
          <header>
            <i className={`ph-fill ${GAME_ICONS[t.game] || 'ph-trophy'}`} />
            <div>
              <strong>{t.title}</strong>
              <small>Premi: {data.prizes[0]} gold al vincitore, {data.prizes[1]} al finalista</small>
            </div>
          </header>
          {t.status === 'SIGNUP' ? (
            <>
              <p>Iscritti {t.players.length}/{data.size} · si parte a {data.size} giocatori, o fra {left(new Date(t.signupEnds).getTime() - now)} se sono almeno 4.</p>
              <ul className="tournament-players">{t.players.map((p) => <li key={p.id}>{p.username}</li>)}</ul>
              {t.joined ? (
                <button type="button" className="btn btn-secondary btn-small" onClick={() => run('/hotel/tournament/withdraw', 'Iscrizione ritirata.')}>Ritirati</button>
              ) : (
                <button type="button" className="btn btn-gold btn-small" onClick={() => run('/hotel/tournament/signup', 'Iscritto! Ti avviso quando tocca a te.')}>
                  <i className="ph-fill ph-pen-nib" /> Iscriviti
                </button>
              )}
            </>
          ) : (
            <>
              {myMatch && (
                <p className="tournament-my-match">
                  Tocca a te: gioca a {t.game === 'bowling' ? 'bowling (sala Bowling)' : 'biliardo (Sala Giochi)'} entro {left(new Date(myMatch.deadline).getTime() - now)}. Conta la prima partita.
                </p>
              )}
              <div className="tournament-bracket">
                {rounds.map((round) => (
                  <div key={round} className="tournament-round">
                    <h5>{roundName(round, totalRounds)}</h5>
                    {t.matches.filter((m) => m.round === round).map((m) => (
                      <div key={`${m.round}-${m.slot}`} className="tournament-match">
                        {[['aId', 'aName', 'aScore'], ['bId', 'bName', 'bScore']].map(([id, name, score]) => (
                          <span key={id} className={`${m.winnerId && m.winnerId === m[id] ? 'won' : ''}${m[id] === me?.id ? ' me' : ''}`}>
                            {m[name] || (m[id] ? '?' : 'passa il turno')}
                            <b>{m[score] ?? ''}</b>
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}
      {data.last.length > 0 && (
        <>
          <h4 className="events-sub">Ultimi vincitori</h4>
          <ul className="event-list">
            {data.last.map((l) => (
              <li key={l.endedAt}>
                <i className="ph-fill ph-trophy" />
                <div><strong>{l.winner || '—'}</strong><span>{l.game === 'bowling' ? 'Bowling' : 'Biliardo'}</span></div>
                <time>{new Date(l.endedAt).toLocaleDateString('it-IT')}</time>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** Stagione sportiva del mese: classifica, i propri punti, come si guadagnano. */
export function SeasonTab({ me, version }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let cancelled = false;
    apiClient.get('/hotel/season').then((res) => {
      if (!cancelled) setData({ ...res, days: Math.max(0, Math.ceil((new Date(res.endsAt).getTime() - Date.now()) / 86400000)) });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [version]);
  if (!data) return <p className="hotel-panel-hint">Carico la stagione…</p>;
  const month = new Date(`${data.season}-01T12:00:00`).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  const { days } = data;
  return (
    <div className="season-tab">
      <p className="hotel-panel-hint">
        Stagione di {month}: mancano {days} giorni. Premi {data.prizes.join(' / ')} gold ai primi tre.
      </p>
      <p className="season-how">Punti: 1-10 a ogni partita sportiva (secondo il punteggio), 2 a gol, 10 per una partita vinta allo stadio, 10/6/3 sul podio del go-kart, 30 per un torneo vinto.</p>
      {data.mine && <p className="season-mine">Tu: <b>{data.mine.points}</b> punti, {data.mine.rank}° posto</p>}
      <ol className="event-board">
        {data.ranking.length === 0 && <li className="hotel-panel-hint">Ancora nessun punto questo mese.</li>}
        {data.ranking.map((row, i) => (
          <li key={row.id} className={row.id === me?.id ? 'mine' : ''}>
            <span className="event-rank">{i + 1}</span>
            <span className="event-name">{row.username}</span>
            <b>{row.points}</b>
          </li>
        ))}
      </ol>
      {data.last?.winners?.length > 0 && (
        <p className="gallery-last"><i className="ph-fill ph-trophy" /> Stagione {data.last.season}: {data.last.winners.map((w, i) => `${i + 1}. ${w.username}`).join(' · ')}</p>
      )}
    </div>
  );
}
