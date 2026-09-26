/**
 * Biliardo stile 8 Ball: tavolo visto dall'alto, si mira con il mouse (o con le frecce), si
 * carica la forza e si tira. Le bilie si urtano, rimbalzano sulle sponde e cadono nelle sei
 * buche; la posizione di tutte le bilie va anche alla stanza, dove si muovono sul tavolo vero.
 * Punti = bilie colorate in buca con 12 tiri; la bianca in buca costa un tiro.
 */

const W = 200;
const H = 100;
const R = 3.2;
const CUSHION = 7;
const POCKET_R = 6.5;
const POCKETS = [[CUSHION - 1, CUSHION - 1], [W / 2, CUSHION - 2.5], [W - CUSHION + 1, CUSHION - 1],
  [CUSHION - 1, H - CUSHION + 1], [W / 2, H - CUSHION + 2.5], [W - CUSHION + 1, H - CUSHION + 1]];
const SHOTS = 12;
/** Colori delle bilie: 0 la bianca, 1-7 piene, 8 la nera, 9-15 rigate (stesso colore con la fascia). */
export const BALL_COLORS = ['#f8fafc', '#facc15', '#2563eb', '#dc2626', '#7c3aed', '#f97316', '#16a34a', '#7f1d1d',
  '#111827', '#facc15', '#2563eb', '#dc2626', '#7c3aed', '#f97316', '#16a34a', '#7f1d1d'];
const CUE_START = [52, H / 2];

function rack() {
  // Triangolo con la nera al centro della terza fila.
  const order = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15];
  const balls = [{ n: 0, x: CUE_START[0], y: CUE_START[1], vx: 0, vy: 0, in: false }];
  let k = 0;
  for (let row = 0; row < 5; row += 1) {
    for (let i = 0; i <= row; i += 1) {
      balls.push({ n: order[k], x: 138 + row * R * 1.8, y: H / 2 + (i - row / 2) * R * 2.05, vx: 0, vy: 0, in: false });
      k += 1;
    }
  }
  return balls;
}

function step(s, dt) {
  const n = Math.ceil(dt / 3);
  for (let k = 0; k < n; k += 1) {
    const h = dt / n;
    const live = s.balls.filter((b) => !b.in);
    live.forEach((b) => {
      b.x += b.vx * h;
      b.y += b.vy * h;
      // Buche: il centro della bilia entra nella buca.
      if (POCKETS.some(([px, py]) => Math.hypot(b.x - px, b.y - py) < POCKET_R)) {
        b.in = true;
        b.vx = 0;
        b.vy = 0;
        if (b.n === 0) s.scratch = true;
        else {
          s.potted += 1;
          s.shotPotted += 1;
        }
        return;
      }
      // Sponde.
      if (b.x < CUSHION + R) { b.x = CUSHION + R; b.vx = Math.abs(b.vx) * 0.82; }
      if (b.x > W - CUSHION - R) { b.x = W - CUSHION - R; b.vx = -Math.abs(b.vx) * 0.82; }
      if (b.y < CUSHION + R) { b.y = CUSHION + R; b.vy = Math.abs(b.vy) * 0.82; }
      if (b.y > H - CUSHION - R) { b.y = H - CUSHION - R; b.vy = -Math.abs(b.vy) * 0.82; }
    });
    // Urti fra bilie: stessa massa, urto elastico lungo la congiungente.
    for (let i = 0; i < live.length; i += 1) {
      for (let j = i + 1; j < live.length; j += 1) {
        const a = live[i];
        const b = live[j];
        if (a.in || b.in) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d === 0 || d >= R * 2) continue;
        const nx = dx / d;
        const ny = dy / d;
        const overlap = R * 2 - d;
        a.x -= (nx * overlap) / 2;
        a.y -= (ny * overlap) / 2;
        b.x += (nx * overlap) / 2;
        b.y += (ny * overlap) / 2;
        const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (rel <= 0) continue;
        a.vx -= rel * nx * 0.96;
        a.vy -= rel * ny * 0.96;
        b.vx += rel * nx * 0.96;
        b.vy += rel * ny * 0.96;
      }
    }
    const friction = Math.pow(0.9984, h);
    s.balls.forEach((b) => {
      b.vx *= friction;
      b.vy *= friction;
      if (Math.hypot(b.vx, b.vy) < 0.004) { b.vx = 0; b.vy = 0; }
    });
  }
  return s.balls.some((b) => !b.in && (b.vx || b.vy));
}

/** Posizioni per la stanza: coppie (x, y) da 0 a 1, -1 per le bilie in buca. */
function snapshot(s) {
  return s.balls.flatMap((b) => (b.in ? [-1, -1] : [Math.round((b.x / W) * 1000) / 1000, Math.round((b.y / H) * 1000) / 1000]));
}

export const pool = {
  help: 'Mira con il mouse sul tavolo (o con le frecce), premi SPAZIO per caricare la forza e di nuovo per tirare. Metti in buca piu\' bilie che puoi con 12 tiri: la bianca in buca costa un tiro.',
  duration: 0,
  keys: { ' ': 'shoot', Enter: 'shoot', ArrowLeft: 'left', ArrowRight: 'right', a: 'left', d: 'right' },
  buttons: [['left', '', 'ph-arrow-counter-clockwise'], ['shoot', 'Carica / Tira', 'ph-target'], ['right', '', 'ph-arrow-clockwise']],
  init: () => ({ balls: rack(), angle: Math.PI, phase: 'aim', power: 0, powerDir: 1, shots: SHOTS, potted: 0, shotPotted: 0,
    scratch: false, moving: false, sent: -1, clock: 0, result: null }),
  tick(s, dt, emit) {
    s.clock += dt;
    if (s.sent < 0) {
      s.sent = s.clock;
      emit?.({ kind: 'balls', balls: snapshot(s) });
    }
    if (s.moving) {
      s.moving = step(s, dt);
      if (s.clock - s.sent > 130 || !s.moving) {
        s.sent = s.clock;
        emit?.({ kind: 'balls', balls: snapshot(s) });
      }
      if (!s.moving) {
        const cue = s.balls[0];
        if (s.scratch) {
          // Bianca in buca: torna al suo posto (o dove c'e' spazio) e si perde un tiro.
          cue.in = false;
          cue.x = CUE_START[0];
          cue.y = CUE_START[1];
          while (s.balls.some((b) => b !== cue && !b.in && Math.hypot(b.x - cue.x, b.y - cue.y) < R * 2.2)) cue.y += R * 2.2;
          s.shots = Math.max(0, s.shots - 1);
          s.result = 'Bianca in buca: un tiro in meno';
          s.scratch = false;
          emit?.({ kind: 'balls', balls: snapshot(s) });
        } else {
          s.result = s.shotPotted ? `${s.shotPotted} in buca!` : 'Niente in buca';
        }
        s.phase = s.shots <= 0 || s.potted >= 15 ? 'over' : 'aim';
      }
      return;
    }
    if (s.phase === 'power') {
      s.power += s.powerDir * dt * 0.11;
      if (s.power >= 100) { s.power = 100; s.powerDir = -1; }
      if (s.power <= 0) { s.power = 0; s.powerDir = 1; }
    }
  },
  press(s, action, pulse, emit) {
    if (s.moving || s.phase === 'over') return;
    if (typeof action === 'object' && action?.aim !== undefined) {
      if (s.phase === 'aim') s.angle = action.aim;
      return;
    }
    if (action === 'left' || action === 'right') {
      s.angle += (action === 'left' ? -1 : 1) * 0.05;
      return;
    }
    if (action !== 'shoot') return;
    if (s.phase === 'aim') {
      s.phase = 'power';
      s.power = 0;
      s.powerDir = 1;
      return;
    }
    const speed = 0.05 + (s.power / 100) * 0.55;
    s.balls[0].vx = Math.cos(s.angle) * speed;
    s.balls[0].vy = Math.sin(s.angle) * speed;
    s.shots -= 1;
    s.shotPotted = 0;
    s.moving = true;
    s.phase = 'roll';
    s.result = null;
    emit?.({ kind: 'cue', power: s.power });
    pulse();
  },
  score: (s) => s.potted,
  done: (s) => s.phase === 'over' && !s.moving,
  view: (s, act) => {
    const cue = s.balls[0];
    // Linea di mira fino alla prima bilia o sponda (tratteggiata), come nelle app di biliardo.
    const aimLen = 220;
    const ex = cue.x + Math.cos(s.angle) * aimLen;
    const ey = cue.y + Math.sin(s.angle) * aimLen;
    const onAim = (event) => {
      if (!act) return;
      const svg = event.currentTarget;
      const rect = svg.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * W;
      const y = ((event.clientY - rect.top) / rect.height) * H;
      act({ aim: Math.atan2(y - cue.y, x - cue.x) });
    };
    const pull = s.phase === 'power' ? 6 + s.power * 0.18 : 6;
    return (
      <div className="mg-sport">
        <svg className="mg-svg mg-pool-table" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Tavolo da biliardo"
          onPointerMove={onAim} onPointerDown={onAim}>
          <rect x="0" y="0" width={W} height={H} rx="6" fill="#5b3a1e" />
          <rect x={CUSHION - 3} y={CUSHION - 3} width={W - 2 * CUSHION + 6} height={H - 2 * CUSHION + 6} fill="#0f5132" />
          <rect x={CUSHION} y={CUSHION} width={W - 2 * CUSHION} height={H - 2 * CUSHION} fill="#15803d" />
          <line x1="52" y1={CUSHION} x2="52" y2={H - CUSHION} stroke="#22c55e" strokeWidth="0.5" />
          {POCKETS.map(([px, py]) => <circle key={`${px}-${py}`} cx={px} cy={py} r={POCKET_R - 1.5} fill="#0a0a0a" />)}
          {!s.moving && s.phase !== 'over' && !cue.in && (
            <>
              <line x1={cue.x} y1={cue.y} x2={ex} y2={ey} stroke="rgba(255,255,255,0.55)" strokeWidth="0.6" strokeDasharray="2 2" />
              <line x1={cue.x - Math.cos(s.angle) * pull} y1={cue.y - Math.sin(s.angle) * pull}
                x2={cue.x - Math.cos(s.angle) * (pull + 60)} y2={cue.y - Math.sin(s.angle) * (pull + 60)}
                stroke="#d6a45c" strokeWidth="1.6" strokeLinecap="round" />
            </>
          )}
          {s.balls.filter((b) => !b.in).map((b) => (
            <g key={b.n}>
              <circle cx={b.x} cy={b.y} r={R} fill={b.n >= 9 ? '#f8fafc' : BALL_COLORS[b.n]} stroke="#0a0a0a" strokeWidth="0.35" />
              {b.n >= 9 && <rect x={b.x - R} y={b.y - 1.3} width={R * 2} height="2.6" fill={BALL_COLORS[b.n]} />}
              {b.n > 0 && <circle cx={b.x} cy={b.y} r="1.2" fill="#f8fafc" />}
            </g>
          ))}
        </svg>
        <div className="mg-meter mg-power"><span className="mg-cue" style={{ left: `${s.phase === 'power' ? s.power : 0}%` }} /></div>
        <div className="mg-row">
          <span>{s.result || (s.phase === 'power' ? 'Premi di nuovo per tirare' : `Tiri: ${s.shots}`)}</span>
          <div className="mg-big">{s.potted}<small>bilie</small></div>
        </div>
      </div>
    );
  }
};
