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
  press(s, action, pulse) {
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
    s.zone = rand(40, 82);
    if (made) pulse();
  },
  score: (s) => s.points,
  done: () => false,
  view: (s) => {
    // Traiettoria: dalla mano (20,120) al ferro (160,42); se sbagli, finisce corta o lunga.
    const t = s.flight > 0 ? 1 - s.flight / 650 : 0;
    const endX = 160 + (s.shot && !s.shot.made ? s.shot.off * 1.2 : 0);
    const bx = 20 + (endX - 20) * t;
    const by = 120 - Math.sin(t * Math.PI) * 90 - t * 78 + (t > 0.9 && s.shot?.made ? (t - 0.9) * 200 : 0);
    return (
      <div className="mg-sport">
        <svg className="mg-svg" viewBox="0 0 200 140" role="img" aria-label="Campo da basket">
          <rect x="0" y="0" width="200" height="140" fill="#7c2d12" />
          <rect x="0" y="118" width="200" height="22" fill="#c2410c" />
          {[20, 60, 100, 140, 180].map((x) => <rect key={x} x={x} y="118" width="1" height="22" fill="#9a3412" />)}
          <rect x="182" y="14" width="4" height="104" fill="#6b7280" />
          <rect x="170" y="14" width="14" height="36" fill="#f8fafc" stroke="#111827" strokeWidth="1" />
          <rect x="171" y="27" width="8" height="10" fill="none" stroke="#dc2626" strokeWidth="1.2" />
          <rect x="150" y="42" width="22" height="2.5" fill="#f97316" />
          <path d="M151 44 L155 56 L167 56 L171 44" fill="none" stroke="#f1f5f9" strokeWidth="1" />
          {s.flight > 0 && <circle cx={bx} cy={by} r="6" fill="#ea580c" stroke="#431407" strokeWidth="1" />}
          {s.flight === 0 && <circle cx="20" cy="112" r="6" fill="#ea580c" stroke="#431407" strokeWidth="1" />}
        </svg>
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
  help: 'Premi SPAZIO per fermare la mira, poi di nuovo per la forza. Cinque frame da due tiri: strike +10, spare +5.',
  duration: 0,
  keys: { ' ': 'go', Enter: 'go' },
  buttons: [['go', 'Ferma', 'ph-circle']],
  init: () => ({
    phase: 'aim', aim: 0, aimDir: 1, power: 0, powerDir: 1, frame: 1, roll: 1, standing: [...Array(10).keys()],
    points: 0, frames: [], rolling: 0, ballX: 0, result: null, fallen: []
  }),
  tick(s, dt) {
    if (s.rolling > 0) {
      s.rolling = Math.max(0, s.rolling - dt);
      if (s.rolling === 0) bowling.afterRoll(s);
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
  press(s, action) {
    if (action !== 'go' || s.rolling > 0 || s.phase === 'over') return;
    if (s.phase === 'aim') {
      s.phase = 'power';
      return;
    }
    // Un filo d'effetto: la boccia devia un poco verso il centro, di piu' se lanciata piano.
    s.ballX = clamp(s.aim - s.aim * 0.12 * (1 - s.power / 100) + rand(-0.15, 0.15), -2.4, 2.4);
    s.fallen = Math.abs(s.ballX) > 2.1 ? [] : [...knockPins(s.standing, s.ballX, s.power)];
    s.rolling = 900;
    s.phase = 'roll';
  },
  afterRoll(s) {
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
    }
    s.phase = s.frame > FRAMES ? 'over' : 'aim';
    s.power = 0;
  },
  score: (s) => s.points,
  done: (s) => s.phase === 'over' && s.rolling === 0,
  view: (s) => {
    const t = s.rolling > 0 ? 1 - s.rolling / 900 : 0;
    const laneX = (x) => 60 + x * 14;
    const standingSet = new Set(s.standing);
    return (
      <div className="mg-sport">
        <svg className="mg-svg" viewBox="0 0 120 150" role="img" aria-label="Pista da bowling">
          <rect x="0" y="0" width="120" height="150" fill="#111827" />
          <rect x="22" y="0" width="76" height="150" fill="#e7c38a" />
          <rect x="16" y="0" width="6" height="150" fill="#3f3f46" />
          <rect x="98" y="0" width="6" height="150" fill="#3f3f46" />
          {[30, 45, 60, 75, 90].map((x) => <path key={x} d={`M${x} 102 l-3 6 h6 z`} fill="#1e3a8a" />)}
          {PINS.map(([px, row], i) => {
            const up = standingSet.has(i) && !(s.rolling > 0 && t > 0.75 && s.fallen.includes(i));
            const fallenNow = s.fallen.includes(i) && (s.rolling === 0 || t > 0.75);
            if (!up && !fallenNow && !standingSet.has(i)) return null;
            return up
              ? <g key={i}><ellipse cx={laneX(px)} cy={14 + row * 9} rx="3.2" ry="4" fill="#f8fafc" /><rect x={laneX(px) - 3} y={12 + row * 9} width="6" height="1.4" fill="#dc2626" /></g>
              : <ellipse key={i} cx={laneX(px) + 3} cy={16 + row * 9} rx="4.5" ry="2" fill="#9ca3af" opacity={s.rolling > 0 ? 1 : 0} />;
          })}
          {s.rolling > 0 && <circle cx={laneX(s.ballX)} cy={140 - t * 125} r="5" fill="#7c3aed" stroke="#2e1065" />}
          {s.rolling === 0 && s.phase !== 'over' && (
            <>
              <circle cx={laneX(s.aim)} cy="140" r="5" fill="#7c3aed" stroke="#2e1065" />
              <path d={`M${laneX(s.aim)} 128 l-4 6 h8 z`} fill={s.phase === 'aim' ? '#facc15' : '#22c55e'} />
            </>
          )}
        </svg>
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
    help: 'Premi SPAZIO per fermare la mira, poi la forza, e manda la pallina in buca. Meno colpi fai, piu\' punti prendi (buca in uno = 6).',
    duration: 0,
    keys: { ' ': 'go', Enter: 'go' },
    buttons: [['go', 'Ferma', 'ph-golf']],
    init: () => ({
      x: course.start[0], y: course.start[1], vx: 0, vy: 0, strokes: 0, phase: 'aim', aim: 0, aimDir: 1,
      power: 0, powerDir: 1, moving: false, holed: false, clock: 0, blade: null
    }),
    tick(s, dt) {
      s.clock += dt;
      if (s.moving) {
        golfStep(s, course, dt, s.clock);
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
    press(s, action, pulse) {
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
