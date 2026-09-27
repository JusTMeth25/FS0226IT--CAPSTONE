import { useCallback, useEffect, useRef, useState } from 'react';
import { basket, bowling, golf } from './sportGames.jsx';
import { pool } from './billiards.jsx';
import { fish, sing } from './leisureGames.jsx';
import { kart } from './kartGame.jsx';
import { darts, pong } from './arcadeGames.jsx';
import { disco } from './discoGame.jsx';
import { hockey } from './hockeyGame.jsx';
import { rock } from './rockGame.jsx';

/**
 * Minigiochi sui mobili dell'hotel. Si gioca qui, nel browser; il server ha fatto partire la
 * partita (minigame_start) e alla fine riceve solo il punteggio, che controlla.
 *
 * Ogni gioco e' una piccola simulazione aggiornata a ogni fotogramma: `init` crea lo stato,
 * `tick` lo fa avanzare di dt millisecondi, `press` reagisce a un tasto (o a un pulsante sullo
 * schermo), `view` lo disegna. Lo stato vive in un ref; a ogni fotogramma se ne fa una copia
 * (`snap`) che React disegna.
 */

const rand = (min, max) => min + Math.random() * (max - min);

const GAMES = {
  // Panca piana: ogni pressione spinge il bilanciere; se ti fermi torna giu'. Arrivato in cima
  // e' una ripetizione. Piu' ne fai, piu' pesa.
  bench: {
    help: 'Premi SPAZIO (o il pulsante) il piu\' velocemente possibile per spingere il bilanciere.',
    duration: 25_000,
    keys: { ' ': 'push', Enter: 'push' },
    buttons: [['push', 'Spingi!', 'ph-barbell']],
    init: () => ({ lift: 0, reps: 0 }),
    tick(s, dt) {
      s.lift = Math.max(0, s.lift - dt * (0.025 + s.reps * 0.0012));
    },
    press(s, action, pulse) {
      if (action !== 'push') return;
      s.lift += 11 - Math.min(6, s.reps * 0.2);
      if (s.lift >= 100) {
        s.lift = 0;
        s.reps += 1;
        pulse();
      }
    },
    score: (s) => s.reps,
    done: (s, max) => s.reps >= max,
    view: (s) => (
      <div className="mg-bench">
        <div className="mg-meter mg-meter-vertical"><span style={{ height: `${s.lift}%` }} /></div>
        <div className="mg-big">{s.reps}<small>ripetizioni</small></div>
      </div>
    )
  },

  // Tapis roulant: alterna sinistro e destro; il ritmo giusto fa salire la velocita'.
  run: {
    help: 'Alterna FRECCIA SINISTRA e FRECCIA DESTRA (o A e D) per correre: piu\' sei regolare, piu\' vai veloce.',
    duration: 20_000,
    keys: { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' },
    buttons: [['left', 'Sinistro', 'ph-footprints'], ['right', 'Destro', 'ph-footprints']],
    init: () => ({ speed: 0, meters: 0, last: null }),
    tick(s, dt) {
      s.speed = Math.max(0, s.speed - dt * 0.0016);
      s.meters += (s.speed * dt) / 1000;
    },
    press(s, action, pulse) {
      if (action === s.last) {
        s.speed = Math.max(0, s.speed - 1);
      } else {
        s.speed = Math.min(9, s.speed + 0.55);
        pulse();
      }
      s.last = action;
    },
    score: (s) => Math.floor(s.meters),
    done: () => false,
    view: (s) => (
      <div className="mg-run">
        <div className="mg-meter"><span style={{ width: `${(s.speed / 9) * 100}%` }} /></div>
        <div className="mg-row"><span>{(s.speed * 3.6).toFixed(1)} km/h</span><div className="mg-big">{Math.floor(s.meters)}<small>metri</small></div></div>
      </div>
    )
  },

  // Sacco da boxe: compare una direzione, colpisci quella giusta prima che sparisca.
  box: {
    help: 'Colpisci la direzione che compare: FRECCIA SINISTRA, SU o DESTRA. Piu\' colpi di fila fanno combo.',
    duration: 20_000,
    keys: { ArrowLeft: 'left', ArrowUp: 'up', ArrowRight: 'right' },
    buttons: [['left', 'Sinistro', 'ph-arrow-left'], ['up', 'Montante', 'ph-arrow-up'], ['right', 'Destro', 'ph-arrow-right']],
    init: () => ({ target: 'up', left: 1200, window: 1200, points: 0, combo: 0, flash: 0 }),
    tick(s, dt) {
      s.left -= dt;
      s.flash = Math.max(0, s.flash - dt);
      if (s.left <= 0) {
        s.combo = 0;
        GAMES.box.next(s);
      }
    },
    next(s) {
      s.target = ['left', 'up', 'right'][Math.floor(Math.random() * 3)];
      s.window = Math.max(480, s.window - 25);
      s.left = s.window;
    },
    press(s, action, pulse, emit) {
      if (action === s.target) {
        s.combo += 1;
        s.points += s.combo >= 5 ? 2 : 1;
        s.flash = 200;
        emit?.({ kind: 'hit' });
        pulse();
      } else {
        s.combo = 0;
      }
      GAMES.box.next(s);
    },
    score: (s) => s.points,
    done: () => false,
    view: (s) => (
      <div className="mg-box">
        <div className={`mg-target mg-target-${s.target}${s.flash ? ' hit' : ''}`}>
          <i className={`ph-fill ${{ left: 'ph-arrow-left', up: 'ph-arrow-up', right: 'ph-arrow-right' }[s.target]}`} />
          <span className="mg-target-time" style={{ width: `${(s.left / s.window) * 100}%` }} />
        </div>
        <div className="mg-row"><span>Combo x{s.combo}</span><div className="mg-big">{s.points}<small>colpi</small></div></div>
      </div>
    )
  },

  // Curl bicipiti: un braccio alla volta, alternando sinistro e destro. Ogni curl stanca: se
  // l'energia finisce bisogna rifiatare un attimo. Due volte lo stesso braccio non vale.
  curl: {
    help: 'Alterna FRECCIA SINISTRA e FRECCIA DESTRA (o A e D): ogni curl alternato e\' una ripetizione. Non esagerare, l\'energia cala!',
    duration: 25_000,
    keys: { ArrowLeft: 0, a: 0, A: 0, ArrowRight: 1, d: 1, D: 1 },
    buttons: [[0, 'Sinistro', 'ph-barbell'], [1, 'Destro', 'ph-barbell']],
    init: () => ({ reps: 0, last: null, busy: 0, energy: 100, tired: false, result: null }),
    tick(s, dt) {
      s.busy = Math.max(0, s.busy - dt);
      s.energy = Math.min(100, s.energy + dt * 0.012);
      if (s.tired && s.energy >= 35) s.tired = false;
    },
    press(s, arm, pulse, emit) {
      if (s.busy > 0 || s.tired) return;
      if (arm === s.last) {
        s.result = 'Alterna le braccia!';
        s.energy = Math.max(0, s.energy - 8);
        return;
      }
      s.last = arm;
      s.busy = 260;
      s.energy -= 7 + s.reps * 0.1;
      if (s.energy <= 0) {
        s.energy = 0;
        s.tired = true;
        s.result = 'Stanco! Rifiata un attimo…';
        return;
      }
      s.reps += 1;
      s.result = null;
      emit?.({ kind: 'curl', arm });
      pulse();
    },
    score: (s) => s.reps,
    done: (s, max) => s.reps >= max,
    view: (s) => (
      <div className="mg-curl">
        <div className="mg-row"><span>Energia</span><span>{s.tired ? 'rifiata…' : `${Math.round(s.energy)}%`}</span></div>
        <div className="mg-meter"><span style={{ width: `${s.energy}%`, background: s.tired ? '#ef4444' : undefined }} /></div>
        <div className="mg-row">
          <span>{s.result || (s.last === null ? 'Parti con un braccio' : `Ora il ${s.last === 0 ? 'destro' : 'sinistro'}`)}</span>
          <div className="mg-big">{s.reps}<small>ripetizioni</small></div>
        </div>
      </div>
    )
  },

  // Pesca-peluche: la pinza va avanti e indietro, premi quando e' sopra un peluche.
  claw: {
    help: 'La pinza si muove da sola: premi SPAZIO quando e\' sopra un peluche. Hai 3 tentativi.',
    duration: 0,
    keys: { ' ': 'drop', Enter: 'drop' },
    buttons: [['drop', 'Cala la pinza', 'ph-hand-grabbing']],
    init: () => ({ x: 0, t: 0, speed: 0.0022, tries: 3, won: 0, drop: 0, result: null,
      prizes: [rand(12, 30), rand(42, 58), rand(70, 88)].map((p) => ({ x: p, color: ['#f472b6', '#fbbf24', '#60a5fa'][Math.floor(Math.random() * 3)] })) }),
    tick(s, dt) {
      if (s.drop > 0) {
        s.drop = Math.max(0, s.drop - dt);
        return;
      }
      s.t += dt * s.speed;
      s.x = 50 + Math.sin(s.t) * 48;
    },
    press(s, action, pulse) {
      if (action !== 'drop' || s.drop > 0 || s.tries <= 0) return;
      s.tries -= 1;
      const hit = s.prizes.findIndex((p) => Math.abs(p.x - s.x) < 5);
      if (hit >= 0) {
        s.prizes.splice(hit, 1);
        s.won += 1;
        s.result = 'Preso!';
        pulse();
      } else {
        s.result = 'Mancato…';
      }
      s.drop = 900;
      s.speed *= 1.25;
    },
    score: (s) => s.won,
    done: (s) => s.tries <= 0 && s.drop === 0,
    view: (s) => (
      <div className="mg-claw">
        <div className="mg-claw-box">
          <span className={`mg-claw-hand${s.drop ? ' down' : ''}`} style={{ left: `${s.x}%` }}><i className="ph-fill ph-hand-grabbing" /></span>
          {s.prizes.map((p) => <span key={p.x} className="mg-claw-prize" style={{ left: `${p.x}%`, background: p.color }} />)}
        </div>
        <div className="mg-row"><span>{s.result || `Tentativi: ${s.tries}`}</span><div className="mg-big">{s.won}<small>peluche</small></div></div>
      </div>
    )
  },

  // Vinyl Rush: le note scendono su quattro corsie, premi il tasto quando arrivano sulla linea.
  rhythm: {
    help: 'Premi la freccia giusta (o D F J K) quando la nota arriva sulla linea in basso.',
    duration: 25_000,
    keys: { ArrowLeft: 0, d: 0, D: 0, ArrowDown: 1, f: 1, F: 1, ArrowUp: 2, j: 2, J: 2, ArrowRight: 3, k: 3, K: 3 },
    buttons: [[0, '←', null], [1, '↓', null], [2, '↑', null], [3, '→', null]],
    init: () => ({ notes: [], spawn: 600, hits: 0, misses: 0, flash: [0, 0, 0, 0], id: 0 }),
    tick(s, dt) {
      s.spawn -= dt;
      if (s.spawn <= 0) {
        s.notes.push({ id: (s.id += 1), lane: Math.floor(Math.random() * 4), y: 0 });
        s.spawn = rand(380, 700);
      }
      s.notes.forEach((n) => { n.y += dt * 0.05; });
      const missed = s.notes.filter((n) => n.y > 105).length;
      s.misses += missed;
      s.notes = s.notes.filter((n) => n.y <= 105);
      s.flash = s.flash.map((f) => Math.max(0, f - dt));
    },
    press(s, lane, pulse) {
      const note = s.notes.find((n) => n.lane === lane && n.y > 78 && n.y < 100);
      if (note) {
        s.notes = s.notes.filter((n) => n !== note);
        s.hits += 1;
        s.flash[lane] = 180;
        pulse();
      } else {
        s.misses += 1;
      }
    },
    score: (s) => s.hits,
    done: () => false,
    view: (s) => (
      <div className="mg-rhythm">
        <div className="mg-lanes">
          {[0, 1, 2, 3].map((lane) => (
            <div key={lane} className={`mg-lane${s.flash[lane] ? ' hit' : ''}`}>
              {s.notes.filter((n) => n.lane === lane).map((n) => <span key={n.id} className="mg-note" style={{ top: `${n.y}%` }} />)}
            </div>
          ))}
          <span className="mg-line" />
        </div>
        <div className="mg-row"><span>Mancate {s.misses}</span><div className="mg-big">{s.hits}<small>note</small></div></div>
      </div>
    )
  },

  // Biliardo stile 8 Ball (billiards.jsx): si mira sul tavolo e si tira.
  pool,

  // Stadio, bowling e minigolf (sportGames.jsx): una buca del minigolf per mobile.
  basket,
  bowling,
  // Karaoke, pesca e go-kart (leisureGames.jsx).
  sing,
  fish,
  kart,
  // Ping pong e freccette (arcadeGames.jsx).
  pong,
  darts,
  // Gara di ballo della Disco anni 80 (discoGame.jsx).
  disco,
  // Tiri in porta del palaghiaccio (hockeyGame.jsx).
  hockey,
  // Gara rock stile Guitar Hero (rockGame.jsx).
  rock,
  ...Object.fromEntries([1, 2, 3, 4, 5, 6].map((hole) => [`golf${hole}`, golf(hole)]))
};

/** Nomi dei comandi per i lettori di schermo (i pulsanti mostrano spesso solo una freccia). */
const ACTION_NAMES = { left: 'Sinistra', right: 'Destra', gas: 'Accelera', brake: 'Frena', 0: 'Nota sinistra', 1: 'Nota gi\u00f9', 2: 'Nota su', 3: 'Nota destra' };

/** Scena del gioco; `act` serve ai giochi che si comandano anche con il mouse (il biliardo). */
function GameView({ game, snap, act, extra }) {
  return game.view(snap, act, extra);
}

/**
 * @param start messaggio minigame_start del server (gioco, titolo, record della stanza)
 * @param onFinish chiamato una volta con il punteggio finale
 * @param onPulse ogni azione riuscita: l'avatar si muove (ripetizione, pugno, passo...)
 */
export default function Minigame({ start, result, onFinish, onReplay, onClose, onPulse, onFx, extra, clockOffset = 0 }) {
  const game = GAMES[start.game];
  const state = useRef(null);
  const [phase, setPhase] = useState('ready');
  const [snap, setSnap] = useState(null);
  const [finalScore, setFinalScore] = useState(null);
  const [countdown, setCountdown] = useState(3);
  const timeLeft = useRef(game?.duration || 0);
  const playStart = useRef(0);
  const finished = useRef(false);
  // La pagina si ridisegna spesso (chat, NPC...) e ricrea le callback: si tengono in un ref,
  // cosi' il ciclo del gioco non riparte da capo e il tempo non si azzera.
  const callbacks = useRef({ onFinish, onPulse, onFx });
  useEffect(() => {
    callbacks.current = { onFinish, onPulse, onFx };
  }, [onFinish, onPulse, onFx]);
  // Eventi del gioco (tiro, lancio, pallina) mandati alla stanza: gli altri li vedono animati.
  const emit = useCallback((fx) => callbacks.current.onFx?.(fx), []);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    const score = game.score(state.current);
    setFinalScore(score);
    setPhase('done');
    callbacks.current.onFinish(score);
  }, [game]);

  // Dati della partita per init (ora del server, partenza della gara): in un ref, come le callback.
  const setup = useRef({ start, clockOffset });
  useEffect(() => {
    setup.current = { start, clockOffset };
  }, [start, clockOffset]);

  // Conto alla rovescia, poi si gioca. I giochi con un via loro (il semaforo del go-kart) partono subito.
  useEffect(() => {
    if (phase !== 'ready') return undefined;
    state.current = game.init(setup.current.start, setup.current.clockOffset);
    setSnap({ ...state.current, time: timeLeft.current });
    if (game.ownStart) {
      const go = setTimeout(() => setPhase('play'), 0);
      return () => clearTimeout(go);
    }
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          setPhase('play');
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, game]);

  // Ciclo del gioco: un passo a ogni fotogramma.
  useEffect(() => {
    if (phase !== 'play') return undefined;
    let raf = 0;
    let last = performance.now();
    playStart.current = last;
    const loop = (now) => {
      // La fisica avanza a passi piccoli, ma il tempo di gioco e' quello vero: se il browser
      // rallenta, la partita non dura di piu'.
      const dt = Math.min(100, now - last);
      last = now;
      game.tick(state.current, dt, emit);
      if (game.duration) {
        timeLeft.current = game.duration - (now - playStart.current);
        if (timeLeft.current <= 0) {
          finish();
          return;
        }
      }
      if (game.done(state.current, start.maxScore)) {
        finish();
        return;
      }
      setSnap({ ...state.current, time: timeLeft.current });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, game, finish, start.maxScore, emit]);

  const release = useCallback((action) => {
    if (phase !== 'play' || finished.current || !game.release) return;
    game.release(state.current, action);
  }, [phase, game]);

  const act = useCallback((action) => {
    if (phase !== 'play' || finished.current) return;
    game.press(state.current, action, () => callbacks.current.onPulse(), emit);
  }, [phase, game, emit]);

  // Tastiera: si ignora mentre si scrive in chat.
  useEffect(() => {
    if (phase !== 'play') return undefined;
    const onKey = (event) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.repeat) return;
      const action = game.keys[event.key];
      if (action === undefined) return;
      event.preventDefault();
      act(action);
    };
    // Giochi con i tasti tenuti premuti (lo sterzo del go-kart): si avvisa anche quando si lasciano.
    const onKeyUp = (event) => {
      const action = game.keys[event.key];
      if (action !== undefined) release(action);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [phase, game, act, release]);

  if (!game) return null;
  const best = start.best;
  const seconds = Math.max(0, Math.ceil((snap?.time || 0) / 1000));

  return (
    <div className={`hotel-panel hotel-minigame${game.compact ? ' is-compact' : ''}${game.wide ? ' is-wide' : ''}`} role="dialog" aria-label={start.title}>
      <header className="hotel-panel-header">
        <h3><i className="ph-fill ph-trophy" /> {start.title}</h3>
        {phase === 'play' && game.duration > 0 && <span className={`pvp-timer${seconds <= 5 ? ' urgent' : ''}`}>{seconds}s</span>}
        <button type="button" className="hotel-panel-close" onClick={onClose} aria-label="Chiudi"><i className="ph ph-x" /></button>
      </header>
      <p className="hotel-panel-hint">{game.help}</p>
      <p className="mg-record">
        <i className="ph-fill ph-crown" /> Record della stanza: {best ? `${best.score} ${start.unit} (${best.username})` : 'nessuno, fallo tu!'}
        {' · '}batterlo vale fino a 50 gold
      </p>

      {phase === 'ready' && <div className="mg-countdown">{countdown}</div>}

      {phase === 'play' && snap && (
        <div className="mg-stage"><GameView game={game} snap={snap} act={act} extra={extra} /></div>
      )}

      {phase === 'play' && (
        <div className="mg-buttons">
          {game.buttons.map(([action, label, icon]) => (
            <button key={String(action)} type="button" className="btn btn-primary mg-button" aria-label={ACTION_NAMES[action] ? `${ACTION_NAMES[action]} (${label})` : undefined}
              onPointerDown={(event) => { event.preventDefault(); act(action); }}
              onPointerUp={() => release(action)} onPointerLeave={() => release(action)} onPointerCancel={() => release(action)}>
              {icon && <i className={`ph-fill ${icon}`} />} {label}
            </button>
          ))}
        </div>
      )}

      {phase === 'done' && (
        <div className="mg-result">
          <strong>{result ? result.score : finalScore} {start.unit}</strong>
          {result?.record && <span className="mg-new-record"><i className="ph-fill ph-crown" /> Nuovo record della stanza!</span>}
          {result?.reward?.gold > 0 && <span className="mg-reward"><i className="ph-fill ph-coin" /> +{result.reward.gold} gold</span>}
          {result?.reward?.reason === 'limit' && <span className="mg-reward-note">Per oggi i record premiati sono finiti: torna domani.</span>}
          {result?.reward?.reason === 'low_score' && <span className="mg-reward-note">Record troppo basso per un premio: punta piu&apos; in alto!</span>}
          <div className="mg-buttons">
            <button type="button" className="btn btn-secondary btn-small" onClick={onClose}>Chiudi</button>
            <button type="button" className="btn btn-primary btn-small" onClick={onReplay}><i className="ph-fill ph-arrow-counter-clockwise" /> Rigioca</button>
          </div>
        </div>
      )}
    </div>
  );
}
