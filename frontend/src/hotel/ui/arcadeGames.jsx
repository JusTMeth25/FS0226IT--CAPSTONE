/**
 * Ping pong e freccette della sala giochi. Stessa forma degli altri minigiochi (Minigame.jsx).
 */
import PongCanvas from './PongCanvas.jsx';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const rand = (min, max) => min + Math.random() * (max - min);

// ------------------------------------------------------------------ ping pong

const WIN = 11;
const PADDLE = 18;

/** Palla al servizio: parte dal centro verso chi ha appena fatto punto. */
function serve(s, towardPlayer) {
  s.ball = { x: 50, y: 50, vx: rand(-0.025, 0.025), vy: towardPlayer ? 0.045 : -0.045 };
  s.pause = 700;
}

export const pong = {
  // Non compatto: il tavolo sta tutto nel pannello, in orizzontale.
  help: 'Tieni premuto SU/GIU (W/S o le frecce) per spostarti lungo il tavolo e rimandare la pallina. Colpirla col bordo della racchetta la manda di lato. Si vince a 11.',
  duration: 240_000,
  // Il tavolo e' in orizzontale: su e giu' muovono il giocatore lungo il suo lato (restano anche sinistra e destra).
  keys: {
    ArrowUp: 'left', w: 'left', W: 'left', ArrowLeft: 'left', a: 'left', A: 'left',
    ArrowDown: 'right', s: 'right', S: 'right', ArrowRight: 'right', d: 'right', D: 'right'
  },
  buttons: [['left', '▲', null], ['right', '▼', null]],
  init() {
    const s = { me: 50, ai: 50, score: 0, cpu: 0, held: {}, hits: 0, flash: 0, aiFlash: 0, meMove: 0, aiMove: 0, last: null };
    serve(s, true);
    return s;
  },
  // La fisica avanza a passi di al massimo 4 ms: anche se un fotogramma arriva in ritardo la
  // pallina non "salta" oltre la racchetta e il movimento resta regolare.
  tick(s, dt, emit) {
    let left = dt;
    while (left > 0) {
      const step = Math.min(4, left);
      pong.step(s, step, emit);
      left -= step;
    }
  },
  step(s, dt, emit) {
    s.flash = Math.max(0, s.flash - dt);
    s.aiFlash = Math.max(0, s.aiFlash - dt);
    const dir = (s.held.right ? 1 : 0) - (s.held.left ? 1 : 0);
    const before = s.me;
    s.me = clamp(s.me + dir * dt * 0.09, PADDLE / 2, 100 - PADDLE / 2);
    s.meMove = Math.sign(s.me - before);
    // Paddle, il robot: segue la palla con un po' di ritardo (e sbaglia di piu' quando va veloce).
    const target = s.ball.vy < 0 ? s.ball.x : 50;
    const speed = 0.045 + Math.min(0.03, s.hits * 0.0015);
    const aiStep = clamp(target - s.ai, -speed * dt, speed * dt);
    s.ai += aiStep;
    s.aiMove = Math.abs(aiStep) > 0.01 ? Math.sign(aiStep) : 0;
    if (s.pause > 0) {
      s.pause -= dt;
      return;
    }
    const b = s.ball;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < 3 || b.x > 97) {
      b.vx = -b.vx;
      b.x = clamp(b.x, 3, 97);
    }
    const hit = (paddle, towardY) => {
      const offset = (b.x - paddle) / (PADDLE / 2);
      b.vy = towardY * Math.min(0.1, Math.abs(b.vy) * 1.06);
      b.vx = clamp(b.vx + offset * 0.03, -0.07, 0.07);
      s.hits += 1;
    };
    if (b.vy > 0 && b.y >= 90 && b.y <= 95 && Math.abs(b.x - s.me) <= PADDLE / 2 + 2) {
      b.y = 90;
      hit(s.me, -1);
      s.flash = 150;
      emit?.({ kind: 'rally', x: 1 });
    } else if (b.vy < 0 && b.y <= 10 && b.y >= 5 && Math.abs(b.x - s.ai) <= PADDLE / 2 + 1) {
      b.y = 10;
      hit(s.ai, 1);
      s.aiFlash = 180;
      emit?.({ kind: 'rally', x: 0 });
    }
    if (b.y > 102) {
      s.cpu += 1;
      s.last = 'Punto per Paddle.';
      emit?.({ kind: 'point', x: s.score, u: s.cpu / 100 });
      serve(s, false);
    } else if (b.y < -2) {
      s.score += 1;
      s.last = 'Punto tuo!';
      emit?.({ kind: 'point', x: s.score, u: s.cpu / 100 });
      serve(s, true);
    }
  },
  press(s, action, pulse) {
    s.held[action] = true;
    pulse();
  },
  release(s, action) {
    s.held[action] = false;
  },
  score: (s) => s.score,
  done: (s) => s.score >= WIN || s.cpu >= WIN,
  view: (s) => (
    <div className="mg-pong">
      <PongCanvas s={s} />
      <div className="mg-row"><span>Paddle <b>{s.cpu}</b></span><span>{s.last || 'Al servizio…'}</span><div className="mg-big">{s.score}<small>tu</small></div></div>
    </div>
  )
};

// ------------------------------------------------------------------ freccette

const DARTS = 9;

/** Punti di una freccetta a distanza r (0 = centro, 1 = bordo del bersaglio). */
export function dartPoints(r) {
  if (r < 0.06) return 50;
  if (r < 0.12) return 25;
  if (r >= 0.36 && r < 0.43) return 60;
  if (r < 0.8) return r < 0.36 ? 20 : 12;
  if (r < 0.9) return 40;
  if (r <= 1) return 5;
  return 0;
}

export const darts = {
  compact: true,
  help: 'Il mirino si muove da solo: premi SPAZIO (o Tira) quando passa sul centro. Nove freccette: centro 50, triplo 60, doppio 40.',
  duration: 120_000,
  keys: { ' ': 'throw', Enter: 'throw' },
  buttons: [['throw', 'Tira!', 'ph-target']],
  init: () => ({ t: rand(0, 10), thrown: [], total: 0, note: null, cool: 0 }),
  tick(s, dt) {
    // Il mirino disegna una figura che si allarga col tempo: piu' si aspetta, piu' e' difficile.
    s.t += dt / 1000;
    s.cool = Math.max(0, s.cool - dt);
    const wobble = 0.55 + 0.25 * Math.sin(s.t * 0.4);
    s.aim = { x: Math.sin(s.t * 1.7) * wobble, y: Math.sin(s.t * 2.3 + 1) * wobble * 0.9 };
  },
  press(s, action, pulse, emit) {
    if (action !== 'throw' || s.cool > 0 || s.thrown.length >= DARTS || !s.aim) return;
    const x = clamp(s.aim.x + rand(-0.05, 0.05), -1.1, 1.1);
    const y = clamp(s.aim.y + rand(-0.05, 0.05), -1.1, 1.1);
    const points = dartPoints(Math.hypot(x, y));
    s.thrown.push({ x, y, points });
    s.total += points;
    s.cool = 450;
    s.note = points === 50 ? 'Centro!' : points === 60 ? 'Triplo!' : points === 40 ? 'Doppio!' : points === 0 ? 'Fuori…' : `${points} punti`;
    pulse();
    emit?.({ kind: 'dart', u: Math.round(x * 100) / 100, v: Math.round(y * 100) / 100, x: points });
  },
  score: (s) => Math.min(450, s.total),
  done: (s) => s.thrown.length >= DARTS && s.cool <= 0,
  view: (s) => (
    <div className="mg-darts">
      <div className="mg-dartboard" aria-label="Bersaglio">
        {s.thrown.slice(-3).map((d, i) => (
          <span key={`${s.thrown.length}-${i}`} className="mg-dart" style={{ left: `${50 + d.x * 50}%`, top: `${50 + d.y * 50}%` }} />
        ))}
        {s.aim && <span className="mg-aim" style={{ left: `${50 + s.aim.x * 50}%`, top: `${50 + s.aim.y * 50}%` }} />}
      </div>
      <div className="mg-row"><span>Freccette {s.thrown.length}/{DARTS}</span><span>{s.note}</span><div className="mg-big">{Math.min(450, s.total)}<small>punti</small></div></div>
    </div>
  )
};
