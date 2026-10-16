import { useEffect, useState } from 'react';

const SHORT = ['Ottavi', 'Quarti', 'Semifinali', 'Finale'];

function useNow(enabled) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return undefined;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [enabled]);
  return now;
}

function clock(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function Side({ entrant, score, won, lost, me, showScore }) {
  if (!entrant) return <div className="cup-side cup-side-empty"><span>—</span></div>;
  return (
    <div className={`cup-side${won ? ' won' : ''}${lost ? ' lost' : ''}${entrant.id === me ? ' me' : ''}`}>
      <i className={`ph-fill ${entrant.npc ? 'ph-robot' : 'ph-user'}`} aria-hidden="true" />
      <span className="cup-name" title={entrant.name}>{entrant.id === me ? 'Tu' : entrant.name}</span>
      {!entrant.npc && !entrant.online && <i className="ph ph-wifi-slash cup-offline" title="Non collegato" />}
      {showScore && <b className="cup-score">{score}</b>}
    </div>
  );
}

function MatchBox({ match, me }) {
  const done = match.status === 'done';
  const live = match.status === 'live';
  const mine = match.a?.id === me || match.b?.id === me;
  return (
    <div className={`cup-match${live ? ' live' : ''}${done ? ' done' : ''}${mine ? ' mine' : ''}`}>
      <Side entrant={match.a} score={match.scoreA} me={me} showScore={done}
        won={done && match.winner === match.a?.id} lost={done && match.winner !== match.a?.id} />
      <Side entrant={match.b} score={match.scoreB} me={me} showScore={done}
        won={done && match.winner === match.b?.id} lost={done && match.winner !== match.b?.id} />
      {live && <span className="cup-live">LIVE</span>}
      {done && (match.forfeit || match.tiebreak) && (
        <span className="cup-note">{match.forfeit ? 'a tavolino' : 'spareggio'}</span>
      )}
    </div>
  );
}

/**
 * Tabellone a eliminazione diretta: ottavi a sinistra e a destra, che convergono verso la
 * finale al centro, come nelle coppe vere. Su schermi stretti si scorre in orizzontale.
 */
export function TournamentBracket({ state, me }) {
  const rounds = state.rounds;
  const half = (r, side) => {
    const list = rounds[r];
    const n = list.length / 2;
    return side === 'left' ? list.slice(0, n) : list.slice(n);
  };
  const column = (r, side) => (
    <div key={`${side}-${r}`} className={`cup-col cup-col-${side} cup-r${r}${state.status === 'running' && state.round === r ? ' current' : ''}`}>
      <h4>{SHORT[r]}</h4>
      <div className="cup-col-matches">
        {half(r, side).map((m) => <MatchBox key={m.slot} match={m} me={me} />)}
      </div>
    </div>
  );
  const final = rounds[3][0];
  const champion = final.status === 'done' ? (final.winner === final.a?.id ? final.a : final.b) : null;
  return (
    <div className="cup-bracket-scroll">
      <div className="cup-bracket">
        {[0, 1, 2].map((r) => column(r, 'left'))}
        <div className={`cup-col cup-final${state.status === 'running' && state.round === 3 ? ' current' : ''}`}>
          <div className="cup-trophy" aria-hidden="true"><i className="ph-fill ph-trophy" /></div>
          <h4>Finale</h4>
          <MatchBox match={final} me={me} />
          {champion && <p className="cup-champion"><i className="ph-fill ph-crown" /> {champion.id === me ? 'Hai vinto tu!' : champion.name}</p>}
        </div>
        {[2, 1, 0].map((r) => column(r, 'right'))}
      </div>
    </div>
  );
}

/** Intestazione, iscrizione e tabellone: lo stesso in Arena e nella pagina Battaglie. */
export function TournamentPanel({ tournament, me, canJoin = true, joinHint, compact = false }) {
  const { state, clockOffset, notice, join, leave, online } = tournament;
  const now = useNow(!!state) + clockOffset;
  if (!state) {
    return <div className="cup-panel glass-panel"><p className="battle-opponent-empty">{online ? 'Carico il torneo…' : 'Mi collego al torneo…'}</p></div>;
  }
  const humans = state.entrants.filter((e) => !e.npc);
  const entered = state.entrants.some((e) => e.id === me);
  const stillIn = entered && state.status !== 'finished' && !state.rounds.some((round) => round.some((m) =>
    m.status === 'done' && (m.a?.id === me || m.b?.id === me) && m.winner !== me));
  const [first, second, third] = state.prizes;
  const paid = state.paid?.find((p) => p.id === me);

  let status;
  if (state.status === 'open') {
    status = humans.length === 0
      ? 'Iscrizioni aperte: il torneo parte con il primo iscritto.'
      : `Iscrizioni aperte · si parte fra ${clock(state.startsAt - now)} · ${humans.length}/${state.size} giocatori (i posti liberi vanno agli NPC)`;
  } else if (state.status === 'running') {
    status = state.nextRoundAt
      ? `${state.roundNames[state.round + 1] || ''} fra ${clock(state.nextRoundAt - now)}`
      : `${state.roundNames[state.round]} in corso`;
  } else {
    status = 'Torneo concluso: il prossimo apre fra poco.';
  }

  return (
    <div className={`cup-panel${compact ? ' compact' : ' glass-panel'}`}>
      <header className="cup-head">
        <div className="cup-title">
          <i className="ph-fill ph-trophy" />
          <div>
            <h3>Coppa VinylDex #{state.number}</h3>
            <p>{status}</p>
          </div>
        </div>
        <div className="cup-pool" title={`Premi in gold al massimo in ${state.maxPrizedPerDay} tornei al giorno`}>
          <span>Montepremi</span>
          <b><i className="ph-fill ph-coins" /> {state.prizePool}</b>
          <small>1° {first} · 2° {second} · 3°-4° {third}</small>
        </div>
      </header>

      {notice && <p className="cup-notice">{notice}</p>}
      {paid && <p className="cup-notice cup-notice-win"><i className="ph-fill ph-coins" /> Premio: +{paid.gold} gold</p>}

      <div className="cup-actions">
        {state.status === 'open' && !entered && (
          <button type="button" className="btn btn-primary btn-small" disabled={!online || !canJoin} onClick={join}>
            <i className="ph-fill ph-sword" /> Iscriviti
          </button>
        )}
        {state.status === 'open' && entered && (
          <>
            <span className="cup-entered"><i className="ph-fill ph-check-circle" /> Sei iscritto: resta collegato, la tua partita parte da sola.</span>
            <button type="button" className="btn btn-secondary btn-small" onClick={leave}>Ritirati</button>
          </>
        )}
        {state.status === 'running' && stillIn && (
          <>
            <span className="cup-entered"><i className="ph-fill ph-lightning" /> Sei in gara: la prossima partita parte da sola.</span>
            <button type="button" className="btn btn-secondary btn-small" onClick={leave}>Ritirati</button>
          </>
        )}
        {!entered && joinHint && state.status === 'open' && <span className="battle-opponent-hint">{joinHint}</span>}
      </div>

      <TournamentBracket state={state} me={me} />
      <p className="battle-opponent-hint">
        Eliminazione diretta dagli ottavi alla finale: 3 round, categoria e carte come nelle sfide dell&apos;Arena.
        In caso di pareggio passa chi ha fatto più punti. Chi non è collegato quando tocca a lui perde a tavolino.
      </p>
    </div>
  );
}
