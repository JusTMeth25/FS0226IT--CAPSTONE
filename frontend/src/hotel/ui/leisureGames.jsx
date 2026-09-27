/**
 * Minigiochi del tempo libero: la pesca dal molo della spiaggia e il go-kart (il karaoke e' in
 * karaokeGame.jsx). Stessa forma dei giochi di Minigame.jsx (init, tick, press, view).
 */

const rand = (min, max) => min + Math.random() * (max - min);
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

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
