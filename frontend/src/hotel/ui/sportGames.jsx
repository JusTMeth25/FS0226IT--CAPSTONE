/**
 * Minigiochi sportivi dell'hotel: tiri liberi allo stadio, bowling e minigolf. Stesso schema
 * degli altri giochi di Minigame.jsx (init, tick, press, score, done, view).
 */

const rand = (min, max) => min + Math.random() * (max - min);
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// ------------------------------------------------------------------ tiri liberi

/**
 * Basket: la barra della forza oscilla; nella zona verde e' canestro (2 punti), al centro esatto
 * non tocca il ferro (3 punti). Trenta secondi, e ogni canestro fa correre un po' di piu' la barra.
 */
export const basket = {
  compact: true,
  help: 'La barra della forza va su e giu\': premi SPAZIO nella zona verde per fare canestro (2 punti). Al centro esatto e\' un tiro pulito da 3!',
  duration: 30_000,
  keys: { ' ': 'shoot', Enter: 'shoot' },
  buttons: [['shoot', 'Tira', 'ph-basketball']],
  init: () => ({ power: 0, dir: 1, zone: rand(50, 78), points: 0, streak: 0, flight: 0, shot: null, result: null }),
  tick(s, dt) {
    if (s.flight > 0) {
      s.flight = Math.max(0, s.flight - dt);
      return;
    }
    s.power += s.dir * dt * (0.1 + Math.min(0.08, s.points * 0.002));
    if (s.power >= 100) { s.power = 100; s.dir = -1; }
    if (s.power <= 0) { s.power = 0; s.dir = 1; }
  },
  press(s, action, pulse, emit) {
    if (action !== 'shoot' || s.flight > 0) return;
    const off = s.power - (s.zone + 6);
    let made = 0;
    if (Math.abs(off) <= 1.5) made = 3;
    else if (Math.abs(off) <= 6) made = 2;
    s.points += made;
    s.streak = made ? s.streak + 1 : 0;
    s.result = made === 3 ? 'Ciuff! Tiro pulito +3' : made ? 'Canestro! +2' : off < 0 ? 'Corto…' : 'Lungo…';
    s.shot = { made, off: clamp(off, -30, 30) };
    s.flight = 650;
    emit?.({ kind: 'shoot', made: made ? 1 : 0, swish: made === 3 ? 1 : 0, off: s.shot.off });
    s.zone = rand(40, 82);
    if (made) pulse();
  },
  score: (s) => s.points,
  done: () => false,
  view: (s) => {
    return (
      <div className="mg-sport">
        <div className="mg-meter mg-power">
          <span className="mg-zone" style={{ left: `${s.zone}%`, width: '12%' }} />
          <span className="mg-zone mg-zone-perfect" style={{ left: `${s.zone + 4.5}%`, width: '3%' }} />
          <span className="mg-cue" style={{ left: `${s.power}%` }} />
        </div>
        <div className="mg-row"><span>{s.result || `Serie: ${s.streak}`}</span><div className="mg-big">{s.points}<small>punti</small></div></div>
      </div>
    );
  }
};

// ------------------------------------------------------------------ bowling

/** Birilli: posizione laterale (in larghezze di birillo) e fila, dal primo in avanti. */
const PINS = [[0, 0], [-0.5, 1], [0.5, 1], [-1, 2], [0, 2], [1, 2], [-1.5, 3], [-0.5, 3], [0.5, 3], [1.5, 3]];
const FRAMES = 5;

/**
 * Chi cade con una boccia che passa in `x` (0 = centro) con forza `power` (0-100). Il birillo
 * colpito in pieno cade sempre, quelli vicini con una probabilita' che cresce con la forza, e
 * ogni birillo che cade puo' tirarsi dietro quelli della fila dopo.
 */
export function knockPins(standing, x, power) {
  const down = new Set();
  const force = power / 100;
  standing.forEach((i) => {
    const d = Math.abs(PINS[i][0] - x);
    if (d < 0.55 || (d < 1.25 && Math.random() < force * 0.85)) down.add(i);
  });
  let changed = true;
  while (changed) {
    changed = false;
    standing.forEach((i) => {
      if (down.has(i)) return;
      const hit = [...down].some((j) => PINS[i][1] > PINS[j][1] && Math.abs(PINS[i][0] - PINS[j][0]) <= 0.5);
      if (hit && Math.random() < 0.35 + force * 0.4) {
        down.add(i);
        changed = true;
      }
    });
  }
  return down;
}

/**
 * Bowling: cinque frame da due tiri. Prima fermi la mira (la freccia va da una canalina
 * all'altra), poi la forza. Strike +10 punti di bonus, spare +5.
 */
export const bowling = {
  compact: true,
  help: 'Premi SPAZIO per fermare la mira, poi di nuovo per la forza. Cinque frame da due tiri: strike +10, spare +5.',
  duration: 0,
  keys: { ' ': 'go', Enter: 'go' },
  buttons: [['go', 'Ferma', 'ph-circle']],
  init: () => ({
    phase: 'aim', aim: 0, aimDir: 1, power: 0, powerDir: 1, frame: 1, roll: 1, standing: [...Array(10).keys()],
    points: 0, frames: [], rolling: 0, ballX: 0, result: null, fallen: []
  }),
  tick(s, dt, emit) {
    if (s.rolling > 0) {
      s.rolling = Math.max(0, s.rolling - dt);
      if (s.rolling === 0) bowling.afterRoll(s, emit);
      return;
    }
    if (s.phase === 'aim') {
      s.aim += s.aimDir * dt * 0.0028;
      if (s.aim > 2.2) { s.aim = 2.2; s.aimDir = -1; }
      if (s.aim < -2.2) { s.aim = -2.2; s.aimDir = 1; }
    } else if (s.phase === 'power') {
      s.power += s.powerDir * dt * 0.12;
      if (s.power >= 100) { s.power = 100; s.powerDir = -1; }
      if (s.power <= 0) { s.power = 0; s.powerDir = 1; }
    }
  },
  press(s, action, pulse, emit) {
    if (action !== 'go' || s.rolling > 0 || s.phase === 'over') return;
    if (s.phase === 'aim') {
      s.phase = 'power';
      return;
    }
    // Un filo d'effetto: la boccia devia un poco verso il centro, di piu' se lanciata piano.
    s.ballX = clamp(s.aim - s.aim * 0.12 * (1 - s.power / 100) + rand(-0.15, 0.15), -2.4, 2.4);
    s.fallen = Math.abs(s.ballX) > 2.1 ? [] : [...knockPins(s.standing, s.ballX, s.power)];
    s.rolling = 1_100;
    s.phase = 'roll';
    emit?.({ kind: 'roll', x: s.ballX, fallen: s.fallen, standing: s.standing.filter((i) => !s.fallen.includes(i)) });
    pulse();
  },
  afterRoll(s, emit) {
    const knocked = s.fallen.length;
    s.standing = s.standing.filter((i) => !s.fallen.includes(i));
    s.points += knocked;
    const current = s.frames[s.frame - 1] || (s.frames[s.frame - 1] = []);
    current.push(knocked);
    let frameOver = false;
    if (s.roll === 1 && s.standing.length === 0) {
      s.points += 10;
      s.result = 'STRIKE! +10 bonus';
      frameOver = true;
    } else if (s.roll === 2) {
      if (s.standing.length === 0) {
        s.points += 5;
        s.result = 'Spare! +5 bonus';
      } else {
        s.result = `${current[0] + current[1]} birilli`;
      }
      frameOver = true;
    } else {
      s.result = knocked ? `${knocked} birilli giu'` : 'In canalina…';
      s.roll = 2;
    }
    if (frameOver) {
      s.frame += 1;
      s.roll = 1;
      s.standing = [...Array(10).keys()];
      // Nuovo frame: nella stanza i birilli si rialzano.
      emit?.({ kind: 'reset' });
    }
    s.phase = s.frame > FRAMES ? 'over' : 'aim';
    s.power = 0;
  },
  score: (s) => s.points,
  done: (s) => s.phase === 'over' && s.rolling === 0,
  view: (s) => {
    return (
      <div className="mg-sport">
        <div className="mg-lane-aim" title="Mira: da una canalina all'altra">
          <span className="mg-lane-pins">{[...Array(10).keys()].map((i) => <i key={i} className={s.standing.includes(i) ? 'up' : ''} />)}</span>
          <span className="mg-lane-ball" style={{ left: `${((s.aim + 2.4) / 4.8) * 100}%` }} />
        </div>
        <div className="mg-meter mg-power"><span className="mg-cue" style={{ left: `${s.phase === 'power' ? s.power : 0}%` }} /></div>
        <div className="mg-frames">
          {Array.from({ length: FRAMES }, (_, i) => (
            <span key={i} className={i + 1 === s.frame ? 'current' : ''}>
              {(s.frames[i] || []).map((n, r) => (r === 0 && n === 10 ? 'X' : r === 1 && s.frames[i][0] + n === 10 ? '/' : n)).join(' ') || '·'}
            </span>
          ))}
        </div>
        <div className="mg-row">
          <span>{s.result || (s.phase === 'aim' ? 'Ferma la mira' : 'Ferma la forza')}</span>
          <div className="mg-big">{s.points}<small>punti</small></div>
        </div>
      </div>
    );
  }
};

// ------------------------------------------------------------------ minigolf

/** Campo 200x120: partenza, buca, muri (rettangoli), respingenti (cerchi) e zone in pendenza. */
const COURSES = {
  1: { start: [22, 60], hole: [176, 60], walls: [], bumpers: [] },
  2: { start: [22, 100], hole: [176, 100], walls: [[92, 30, 14, 90]], bumpers: [] },
  3: { start: [22, 60], hole: [178, 60], walls: [[92, 0, 16, 46], [92, 74, 16, 46]], bumpers: [], windmill: true },
  4: { start: [22, 60], hole: [178, 60], walls: [], bumpers: [[80, 45, 11], [110, 78, 11], [140, 40, 10], [110, 20, 8]] },
  5: { start: [22, 60], hole: [178, 60], walls: [[70, 0, 60, 48], [70, 72, 60, 48]], bumpers: [] },
  6: { start: [22, 100], hole: [176, 22], walls: [[60, 50, 70, 10]], bumpers: [], slope: [60, 60, 110, 60, 0.00004] }
};
const MAX_STROKES = 6;

function golfStep(s, course, dt, now) {
  const walls = [...course.walls];
  // Mulino: la pala sale e scende e chiude a tratti il passaggio centrale.
  if (course.windmill) walls.push([94, 46 + Math.sin(now / 420) * 16 - 6, 12, 12]);
  s.blade = course.windmill ? 46 + Math.sin(now / 420) * 16 - 6 : null;
  const steps = Math.ceil(dt / 4);
  for (let k = 0; k < steps; k += 1) {
    const h = dt / steps;
    // Pallina finita a ridosso di un muro (spigoli, pala del mulino): si sposta fuori dal lato piu' vicino.
    walls.forEach(([wx, wy, ww, wh]) => {
      if (s.x > wx - 3 && s.x < wx + ww + 3 && s.y > wy - 3 && s.y < wy + wh + 3) {
        const exits = [[wx - 3.1 - s.x, 0], [wx + ww + 3.1 - s.x, 0], [0, wy - 3.1 - s.y], [0, wy + wh + 3.1 - s.y]];
        const [ex, ey] = exits.reduce((best, e) => (Math.abs(e[0] + e[1]) < Math.abs(best[0] + best[1]) ? e : best));
        s.x += ex;
        s.y += ey;
      }
    });
    if (course.slope) {
      const [sx, sy, sw, shh, force] = course.slope;
      if (s.x > sx && s.x < sx + sw && s.y > sy && s.y < sy + shh) s.vy += force * h;
    }
    let nx = s.x + s.vx * h;
    let ny = s.y + s.vy * h;
    if (nx < 4 || nx > 196) { s.vx = -s.vx * 0.8; nx = clamp(nx, 4, 196); }
    if (ny < 4 || ny > 116) { s.vy = -s.vy * 0.8; ny = clamp(ny, 4, 116); }
    walls.forEach(([wx, wy, ww, wh]) => {
      if (nx > wx - 3 && nx < wx + ww + 3 && ny > wy - 3 && ny < wy + wh + 3) {
        const fromSide = s.x <= wx - 3 || s.x >= wx + ww + 3;
        if (fromSide) { s.vx = -s.vx * 0.8; nx = s.x; } else { s.vy = -s.vy * 0.8; ny = s.y; }
      }
    });
    course.bumpers.forEach(([bx, by, br]) => {
      const dx = nx - bx;
      const dy = ny - by;
      const d = Math.hypot(dx, dy);
      if (d < br + 3) {
        const nxn = dx / d;
        const nyn = dy / d;
        const dot = s.vx * nxn + s.vy * nyn;
        s.vx = (s.vx - 2 * dot * nxn) * 1.05;
        s.vy = (s.vy - 2 * dot * nyn) * 1.05;
        nx = bx + nxn * (br + 3.2);
        ny = by + nyn * (br + 3.2);
      }
    });
    s.x = nx;
    s.y = ny;
    const friction = Math.pow(0.9982, h);
    s.vx *= friction;
    s.vy *= friction;
    const speed = Math.hypot(s.vx, s.vy);
    const toHole = Math.hypot(s.x - course.hole[0], s.y - course.hole[1]);
    if (toHole < 5 && speed < 0.16) {
      s.holed = true;
      s.moving = false;
      return;
    }
    if (speed < 0.005) {
      s.vx = 0;
      s.vy = 0;
      s.moving = false;
      return;
    }
  }
}

/**
 * Minigolf: la freccia della mira oscilla, premi per fermarla; poi la forza. Pochi colpi = tanti
 * punti: buca in uno 6 punti, poi uno in meno a colpo; dopo sei colpi la buca e' persa.
 */
export function golf(hole) {
  const course = COURSES[hole] || COURSES[1];
  return {
    compact: true,
    help: 'Premi SPAZIO per fermare la mira, poi la forza, e manda la pallina in buca. Meno colpi fai, piu\' punti prendi (buca in uno = 6).',
    duration: 0,
    keys: { ' ': 'go', Enter: 'go' },
    buttons: [['go', 'Ferma', 'ph-golf']],
    init: () => ({
      x: course.start[0], y: course.start[1], vx: 0, vy: 0, strokes: 0, phase: 'aim', aim: 0, aimDir: 1,
      power: 0, powerDir: 1, moving: false, holed: false, clock: 0, blade: null, sent: -1
    }),
    tick(s, dt, emit) {
      s.clock += dt;
      // La pallina nella stanza segue quella del gioco: posizione ogni ~120 ms mentre rotola.
      if (s.sent < 0 || (s.moving && s.clock - s.sent > 120)) {
        s.sent = s.clock;
        emit?.({ kind: 'ball', u: s.x / 200, v: s.y / 120 });
      }
      if (s.moving) {
        golfStep(s, course, dt, s.clock);
        if (!s.moving) emit?.(s.holed ? { kind: 'hole' } : { kind: 'ball', u: s.x / 200, v: s.y / 120 });
        if (!s.moving && !s.holed) s.phase = s.strokes >= MAX_STROKES ? 'over' : 'aim';
        if (s.holed) s.phase = 'over';
        return;
      }
      if (course.windmill) s.blade = 46 + Math.sin(s.clock / 420) * 16 - 6;
      if (s.phase === 'aim') {
        s.aim += s.aimDir * dt * 0.0018;
        if (s.aim > 1.3) { s.aim = 1.3; s.aimDir = -1; }
        if (s.aim < -1.3) { s.aim = -1.3; s.aimDir = 1; }
      } else if (s.phase === 'power') {
        s.power += s.powerDir * dt * 0.1;
        if (s.power >= 100) { s.power = 100; s.powerDir = -1; }
        if (s.power <= 0) { s.power = 0; s.powerDir = 1; }
      }
    },
    press(s, action, pulse, emit) {
      if (action !== 'go' || s.moving || s.phase === 'over') return;
      if (s.phase === 'aim') {
        s.phase = 'power';
        return;
      }
      const base = Math.atan2(course.hole[1] - s.y, course.hole[0] - s.x);
      const angle = base + s.aim;
      const speed = 0.04 + (s.power / 100) * 0.36;
      s.vx = Math.cos(angle) * speed;
      s.vy = Math.sin(angle) * speed;
      s.strokes += 1;
      s.moving = true;
      s.phase = 'roll';
      emit?.({ kind: 'roll' });
      pulse();
    },
    score: (s) => (s.holed ? Math.max(1, MAX_STROKES + 1 - s.strokes) : 0),
    done: (s) => s.phase === 'over' && !s.moving,
    view: (s) => {
      const base = Math.atan2(course.hole[1] - s.y, course.hole[0] - s.x) + s.aim;
      const arrow = 14 + (s.phase === 'power' ? s.power * 0.35 : 10);
      return (
        <div className="mg-sport">
          <svg className="mg-svg" viewBox="0 0 200 120" role="img" aria-label={`Minigolf, buca ${hole}`}>
            <rect x="0" y="0" width="200" height="120" fill="#16a34a" stroke="#8a5a3b" strokeWidth="6" />
            {course.slope && <rect x={course.slope[0]} y={course.slope[1]} width={course.slope[2]} height={course.slope[3]} fill="#15803d" />}
            {course.slope && <text x={course.slope[0] + 8} y={course.slope[1] + 36} fill="#bbf7d0" fontSize="8">discesa ↓</text>}
            {course.walls.map(([x, y, w, h]) => <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} fill="#8a5a3b" />)}
            {course.bumpers.map(([x, y, r]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#f472b6" stroke="#9d174d" />)}
            {course.windmill && s.blade !== null && <rect x="94" y={s.blade} width="12" height="12" fill="#f8fafc" stroke="#991b1b" />}
            <circle cx={course.hole[0]} cy={course.hole[1]} r="5" fill="#111827" />
            <line x1={course.hole[0]} y1={course.hole[1]} x2={course.hole[0]} y2={course.hole[1] - 22} stroke="#e5e7eb" />
            <path d={`M${course.hole[0]} ${course.hole[1] - 22} l10 4 l-10 4 z`} fill="#ef4444" />
            {!s.holed && <circle cx={s.x} cy={s.y} r="3" fill="#ffffff" stroke="#111827" strokeWidth="0.8" />}
            {!s.moving && s.phase !== 'over' && (
              <line x1={s.x} y1={s.y} x2={s.x + Math.cos(base) * arrow} y2={s.y + Math.sin(base) * arrow}
                stroke={s.phase === 'aim' ? '#facc15' : '#f97316'} strokeWidth="2" strokeLinecap="round" />
            )}
          </svg>
          <div className="mg-meter mg-power"><span className="mg-cue" style={{ left: `${s.phase === 'power' ? s.power : 0}%` }} /></div>
          <div className="mg-row">
            <span>{s.holed ? `In buca in ${s.strokes}!` : s.phase === 'over' ? 'Buca persa' : `Colpi: ${s.strokes}/${MAX_STROKES}`}</span>
            <div className="mg-big">{s.holed ? Math.max(1, MAX_STROKES + 1 - s.strokes) : 0}<small>punti</small></div>
          </div>
        </div>
      );
    }
  };
}
