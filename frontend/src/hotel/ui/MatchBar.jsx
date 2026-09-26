import { useEffect, useState } from 'react';

function clock(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Partita a squadre allo stadio: si sceglie Blu o Rossi (fino a due per parte), poi un giocatore
 * fischia l'inizio. Tre minuti; se e' pari, supplementari con golden goal.
 */
export default function MatchBar({ match, me, clockOffset, send }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!match || match.phase === 'lobby') return undefined;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [match]);
  if (!match) return null;

  const mine = match.blue.some((p) => p.id === me?.id) ? 'blue' : match.red.some((p) => p.id === me?.id) ? 'red' : null;
  const playing = match.phase !== 'lobby';
  const canStart = !playing && mine && match.blue.length > 0 && match.red.length > 0;
  const left = match.endsAt - (now + clockOffset);

  const team = (key, label) => {
    const players = match[key];
    const full = players.length >= match.perTeam;
    return (
      <div className={`match-team is-${key}`}>
        <b>{label}</b>
        <ul>
          {players.map((p) => <li key={p.id} className={p.id === me?.id ? 'me' : ''}>{p.name}</li>)}
          {Array.from({ length: match.perTeam - players.length }, (_, i) => <li key={`free${i}`} className="free">libero</li>)}
        </ul>
        {!playing && mine !== key && (
          <button type="button" className="btn btn-small btn-secondary" disabled={full} onClick={() => send({ type: 'match_join', team: key })}>
            {full ? 'Piena' : 'Entra'}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className={`hotel-match-bar${playing ? ' is-playing' : ''}`} role="region" aria-label="Partita a squadre">
      {team('blue', 'Blu')}
      <div className="match-center">
        {playing ? (
          <>
            <span className="match-phase">{match.phase === 'golden' ? 'Golden goal!' : 'Partita'}</span>
            <strong className="match-clock">{clock(left)}</strong>
          </>
        ) : (
          <>
            <span className="match-phase">Partita {match.perTeam} contro {match.perTeam}</span>
            {canStart && <button type="button" className="btn btn-small btn-gold" onClick={() => send({ type: 'match_start' })}><i className="ph-fill ph-whistle" /> Fischia</button>}
            {!canStart && <small>{mine ? 'Serve almeno un avversario' : 'Scegli una squadra'}</small>}
            {mine && <button type="button" className="btn btn-small btn-secondary" onClick={() => send({ type: 'match_join', team: 'none' })}>Esci</button>}
          </>
        )}
      </div>
      {team('red', 'Rossi')}
    </div>
  );
}
