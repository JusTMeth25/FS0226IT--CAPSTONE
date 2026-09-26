/**
 * Minigiochi del tempo libero: il karaoke del Neon Bar, la pesca dal molo della spiaggia e il
 * go-kart. Stessa forma dei giochi di Minigame.jsx (init, tick, press, view).
 */

const rand = (min, max) => min + Math.random() * (max - min);
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// ------------------------------------------------------------------ karaoke

/** "Giradischi di mezzanotte": testo originale, una riga ogni sei secondi circa. */
const SONG = [
  'Gira il vinile sotto la luna',
  'ogni solco racconta una storia',
  'alza il volume e balla con me',
  'la puntina scende e il cuore va',
  'canta piu\' forte, fino al mattino!'
];
const LINE_MS = 6_000;
const LANES = ['Basso', 'Medio', 'Alto'];

export const sing = {
  help: 'Canta a tempo: premi A, S o D (o i pulsanti Basso, Medio, Alto) quando la nota arriva sul microfono. Le note di fila danno la combo.',
  duration: SONG.length * LINE_MS,
  keys: { a: 0, A: 0, ArrowLeft: 0, s: 1, S: 1, ArrowDown: 1, d: 2, D: 2, ArrowRight: 2 },
  buttons: [[0, 'Basso', 'ph-music-note'], [1, 'Medio', 'ph-music-note'], [2, 'Alto', 'ph-music-notes']],
  init: () => ({ notes: [], spawn: 900, elapsed: 0, hits: 0, combo: 0, best: 0, points: 0, misses: 0, id: 0, flash: [0, 0, 0] }),
  tick(s, dt) {
    s.elapsed += dt;
    s.spawn -= dt;
    if (s.spawn <= 0 && s.elapsed < SONG.length * LINE_MS - 1500) {
      s.notes.push({ id: (s.id += 1), lane: Math.floor(Math.random() * 3), x: 0 });
      s.spawn = rand(420, 820);
    }
    s.notes.forEach((n) => { n.x += dt * 0.045; });
    const missed = s.notes.filter((n) => n.x > 104).length;
    if (missed) {
      s.misses += missed;
      s.combo = 0;
    }
    s.notes = s.notes.filter((n) => n.x <= 104);
    s.flash = s.flash.map((f) => Math.max(0, f - dt));
  },
  press(s, lane, pulse, emit) {
    const note = s.notes.find((n) => n.lane === lane && n.x > 80 && n.x < 102);
    if (!note) {
      s.combo = 0;
      s.misses += 1;
      return;
    }
    s.notes = s.notes.filter((n) => n !== note);
    s.hits += 1;
    s.combo += 1;
    s.best = Math.max(s.best, s.combo);
    // Una nota vale 2, con la combo lunga fino a 4.
    s.points += 2 + Math.min(2, Math.floor(s.combo / 8));
    s.flash[lane] = 200;
    pulse();
    emit?.({ kind: 'sing', x: lane });
  },
  score: (s) => Math.min(120, s.points),
  done: () => false,
  view: (s) => {
    const line = Math.min(SONG.length - 1, Math.floor(s.elapsed / LINE_MS));
    const progress = (s.elapsed % LINE_MS) / LINE_MS;
    const text = SONG[line];
    const cut = Math.round(text.length * progress);
    return (
      <div className="mg-karaoke">
        <div className="mg-lyrics" aria-live="polite">
          <p><span className="sung">{text.slice(0, cut)}</span>{text.slice(cut)}</p>
          {SONG[line + 1] && <p className="next">{SONG[line + 1]}</p>}
        </div>
        <div className="mg-karaoke-lanes">
          {LANES.map((label, lane) => (
            <div key={label} className={`mg-karaoke-lane${s.flash[lane] ? ' hit' : ''}`}>
              {s.notes.filter((n) => n.lane === lane).map((n) => <span key={n.id} className="mg-karaoke-note" style={{ left: `${n.x}%` }}>♪</span>)}
              <i className="ph-fill ph-microphone-stage mg-karaoke-mic" />
            </div>
          ))}
        </div>
        <div className="mg-row"><span>Combo {s.combo} (max {s.best})</span><div className="mg-big">{Math.min(120, s.points)}<small>punti</small></div></div>
      </div>
    );
  }
};

// ------------------------------------------------------------------ pesca

/** Pesci, dal piu' comune al leggendario: punti minimi e massimi. */
const FISH = [
  { name: 'Sardina', min: 8, max: 22 },
  { name: 'Orata', min: 22, max: 42 },
  { name: 'Spigola', min: 38, max: 58 },
  { name: 'Tonno', min: 55, max: 78 },
  { name: 'Pesce spada', min: 72, max: 92 },
  { name: 'Pesce Vinile', min: 90, max: 100 }
];

/** Il lancio perfetto (potenza vicina a 85) porta al largo, dove stanno i pesci grossi. */
function pickFish(power) {
  const quality = 1 - Math.min(1, Math.abs(power - 85) / 60);
  const roll = Math.random() * 0.75 + quality * 0.35;
  const index = clamp(Math.floor(roll * FISH.length), 0, FISH.length - 1);
  const fish = FISH[index];
  return { ...fish, points: Math.round(rand(fish.min, fish.max)) };
}

export const fish = {
  compact: true,
  help: 'SPAZIO (o Pesca): lancia quando la barra e\' sul verde, ferra quando abbocca, poi premi a ritmo per recuperare senza spezzare la lenza.',
  duration: 60_000,
  keys: { ' ': 'go', Enter: 'go' },
  buttons: [['go', 'Pesca!', 'ph-fish']],
  init: () => ({ phase: 'aim', power: 0, dir: 1, wait: 0, biteLeft: 0, tension: 30, reel: 0, tries: 0, fish: null, caught: null, note: 'Prendi la mira…' }),
  tick(s, dt, emit) {
    if (s.phase === 'aim') {
      s.power += s.dir * dt * 0.11;
      if (s.power >= 100) { s.power = 100; s.dir = -1; }
      if (s.power <= 0) { s.power = 0; s.dir = 1; }
    } else if (s.phase === 'wait') {
      s.wait -= dt;
      if (s.wait <= 0) {
        s.phase = 'bite';
        s.biteLeft = 900;
        s.note = 'Abbocca! Ferra subito!';
        emit?.({ kind: 'bite' });
      }
    } else if (s.phase === 'bite') {
      s.biteLeft -= dt;
      if (s.biteLeft <= 0) s.miss = 'Troppo tardi: il pesce e\' scappato.';
    } else if (s.phase === 'reel') {
      // Il pesce tira: la tensione scende da sola, e i pesci grossi strattonano.
      const pull = 0.02 + (s.fish.points / 100) * 0.035;
      s.tension -= dt * pull;
      if (Math.random() < dt * 0.0015 * (s.fish.points / 50)) s.tension += rand(8, 18);
      if (s.tension >= 100) s.miss = 'Troppa forza: la lenza si e\' spezzata!';
      else if (s.tension <= 0) s.miss = 'Lenza lenta: il pesce si e\' liberato.';
      else if (s.tension > 30 && s.tension < 80) s.reel += dt * 0.012;
      if (s.reel >= 100) {
        s.phase = 'done';
        s.caught = s.fish;
        s.note = `Preso! ${s.fish.name} da ${s.fish.points} punti.`;
        emit?.({ kind: 'catch', x: s.fish.points });
      }
    }
    if (s.miss) {
      s.tries += 1;
      s.note = s.tries >= 3 ? `${s.miss} Niente da fare, oggi non abboccano.` : `${s.miss} Riprova.`;
      s.phase = s.tries >= 3 ? 'done' : 'aim';
      s.miss = null;
      s.power = 0;
      emit?.({ kind: 'reset' });
    }
  },
  press(s, action, pulse, emit) {
    if (action !== 'go') return;
    if (s.phase === 'aim') {
      s.phase = 'wait';
      s.wait = rand(1500, 4500);
      s.fish = pickFish(s.power);
      s.note = s.power > 70 && s.power < 97 ? 'Gran lancio! Aspetta che abbocchi…' : 'Aspetta che abbocchi…';
      emit?.({ kind: 'cast', power: Math.round(s.power) });
      pulse();
    } else if (s.phase === 'wait') {
      s.note = 'Calma… non ha ancora abboccato!';
    } else if (s.phase === 'bite') {
      s.phase = 'reel';
      s.tension = 45;
      s.reel = 0;
      s.note = `Hai ferrato qualcosa di ${s.fish.points > 70 ? 'molto grosso' : s.fish.points > 40 ? 'grosso' : 'piccolo'}! Recupera.`;
      emit?.({ kind: 'reel' });
    } else if (s.phase === 'reel') {
      s.tension += 9;
      pulse();
    }
  },
  score: (s) => s.caught?.points || 0,
  done: (s) => s.phase === 'done',
  view: (s) => (
    <div className="mg-fish">
      <p className="mg-fish-note">{s.note}</p>
      {s.phase === 'aim' && (
        <div className="mg-meter mg-fish-power" aria-label="Potenza del lancio">
          <span className="sweet" />
          <span className="needle" style={{ left: `${s.power}%` }} />
        </div>
      )}
      {(s.phase === 'wait' || s.phase === 'bite') && (
        <div className={`mg-fish-bobber${s.phase === 'bite' ? ' bite' : ''}`}><i className="ph-fill ph-circle" /></div>
      )}
      {s.phase === 'reel' && (
        <>
          <div className="mg-meter mg-fish-tension" aria-label="Tensione della lenza">
            <span className="safe" />
            <span className="needle" style={{ left: `${clamp(s.tension, 0, 100)}%` }} />
          </div>
          <div className="mg-meter"><span style={{ width: `${s.reel}%` }} /></div>
        </>
      )}
      {s.caught && <div className="mg-big">{s.caught.points}<small>{s.caught.name}</small></div>}
      <p className="mg-fish-tries">Tentativi {s.tries}/3</p>
    </div>
  )
};

// ------------------------------------------------------------------ go-kart

const LAPS = 3;
/** Punto della pista (0-1) in coordinate della vista 0-100: superellisse come in room.js. */
function trackPoint(t) {
  const theta = Math.PI / 2 - t * Math.PI * 2;
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return { x: 50 + 42 * Math.sign(c) * Math.abs(c) ** 0.45, y: 50 + 34 * Math.sign(s) * Math.abs(s) ** 0.45 };
}
const TRACK_PATH = Array.from({ length: 80 }, (_, i) => {
  const p = trackPoint(i / 80);
  return `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
}).join(' ') + ' Z';

/** Quanto e' stretta la curva in quel punto: 0 sul rettilineo, 1 nel cuore della curva. */
function curveAt(t) {
  const phase = (t * 4) % 1;
  return Math.max(0, 1 - Math.abs(phase - 0.5) * 4) ** 1.5;
}

export const kart = {
  help: 'SU/W (o Gas) per accelerare, GIU\'/S (o Freno) prima delle curve: se entri troppo veloce vai in testacoda. Tre giri, conta il tempo.',
  duration: 150_000,
  keys: { ArrowUp: 'gas', w: 'gas', W: 'gas', ' ': 'gas', ArrowDown: 'brake', s: 'brake', S: 'brake' },
  buttons: [['brake', 'Freno', 'ph-hand-palm'], ['gas', 'Gas!', 'ph-lightning']],
  init: () => ({ t: 0, lap: 0, speed: 0, elapsed: 0, spin: 0, lapTimes: [], lapStart: 0, fxAt: 0, note: 'Via!', finished: false }),
  tick(s, dt, emit) {
    if (s.finished) return;
    s.elapsed += dt;
    if (s.spin > 0) {
      s.spin -= dt;
      s.speed = Math.max(0, s.speed - dt * 0.002);
    } else {
      s.speed = Math.max(0, s.speed - dt * 0.00018);
    }
    const limit = 1 - curveAt(s.t) * 0.55;
    if (s.spin <= 0 && curveAt(s.t) > 0.3 && s.speed > limit + 0.08) {
      s.spin = 900;
      s.speed *= 0.35;
      s.note = 'Testacoda! Frena prima delle curve.';
    }
    s.t += (s.speed * dt) / 11000;
    if (s.t >= 1) {
      s.t -= 1;
      s.lap += 1;
      s.lapTimes.push(s.elapsed - s.lapStart);
      s.lapStart = s.elapsed;
      s.note = s.lap >= LAPS ? 'Traguardo!' : `Giro ${s.lap + 1} di ${LAPS}`;
      emit?.({ kind: 'lap', x: s.lap });
      if (s.lap >= LAPS) s.finished = true;
    }
    if (s.elapsed - s.fxAt > 160) {
      s.fxAt = s.elapsed;
      emit?.({ kind: 'kart', u: Math.round(s.t * 1000) / 1000, x: s.lap, power: Math.round(s.speed * 100) });
    }
  },
  press(s, action, pulse) {
    if (s.finished) return;
    if (action === 'gas') {
      s.speed = Math.min(1, s.speed + 0.09);
      pulse();
    } else if (action === 'brake') {
      s.speed = Math.max(0.1, s.speed - 0.18);
    }
  },
  // Piu' veloce, piu' punti: 300 meno i secondi dei tre giri.
  score: (s) => (s.lap >= LAPS ? clamp(Math.round(300 - s.elapsed / 1000), 0, 260) : 0),
  done: (s) => s.finished,
  view: (s) => {
    const p = trackPoint(s.t);
    const limit = 1 - curveAt(s.t) * 0.55;
    return (
      <div className="mg-kart">
        <svg viewBox="0 0 100 100" className="mg-kart-track" aria-hidden="true">
          <rect x="0" y="0" width="100" height="100" fill="#2f7d31" rx="6" />
          <path d={TRACK_PATH} fill="none" stroke="#3f3f46" strokeWidth="11" />
          <path d={TRACK_PATH} fill="none" stroke="#f4f4f5" strokeWidth="0.6" strokeDasharray="2 2" />
          <line x1="50" y1="78" x2="50" y2="90" stroke="#fff" strokeWidth="1.5" strokeDasharray="1.5 1.5" />
          <circle cx={p.x} cy={p.y} r="3" fill={s.spin > 0 ? '#f59e0b' : '#dc2626'} stroke="#fff" strokeWidth="0.8" />
        </svg>
        <div className="mg-row">
          <span>Giro {Math.min(LAPS, s.lap + 1)}/{LAPS} · {(s.elapsed / 1000).toFixed(1)}s</span>
          <span className={s.speed > limit ? 'mg-kart-warn' : ''}>{curveAt(s.t) > 0.3 ? 'Curva!' : 'Rettilineo'}</span>
        </div>
        <div className="mg-meter"><span style={{ width: `${s.speed * 100}%`, background: s.speed > limit ? '#ef4444' : undefined }} /></div>
        <p className="mg-fish-note">{s.note}</p>
      </div>
    );
  }
};
