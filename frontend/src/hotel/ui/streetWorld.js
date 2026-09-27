/**
 * Mondo della gara in citta': un giro fra i palazzi del quartiere (curve, una esse, un rettilineo
 * lungo), in unita' del mondo. La pista e' una spline chiusa campionata a punti fitti; i palazzi
 * sono blocchi generati una volta, fuori dall'asfalto.
 */

export const HALF = 95;
export const LAPS = 2;
export const MAX_SPEED = 520;
export const ACCEL = 330;
export const BRAKE = 700;
export const COAST = 110;
export const STEER = 2.6;

const CORNERS = [
  [-900, -520], [-100, -520], [150, -330], [900, -330], [960, 120], [700, 480], [-120, 480], [-380, 220], [-900, 220]
];

/** Catmull-Rom chiusa: punti fitti con la distanza percorsa dall'inizio. */
function buildTrack() {
  const points = [];
  const n = CORNERS.length;
  for (let i = 0; i < n; i += 1) {
    const p0 = CORNERS[(i - 1 + n) % n];
    const p1 = CORNERS[i];
    const p2 = CORNERS[(i + 1) % n];
    const p3 = CORNERS[(i + 2) % n];
    for (let k = 0; k < 40; k += 1) {
      const t = k / 40;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      points.push({ x: f(p0[0], p1[0], p2[0], p3[0]), y: f(p0[1], p1[1], p2[1], p3[1]) });
    }
  }
  let length = 0;
  points.forEach((p, i) => {
    p.s = length;
    const q = points[(i + 1) % points.length];
    length += Math.hypot(q.x - p.x, q.y - p.y);
  });
  // Curvatura: quanto gira la pista in quel punto (serve agli avversari per frenare).
  points.forEach((p, i) => {
    const a = points[(i - 3 + points.length) % points.length];
    const b = points[(i + 3) % points.length];
    const h1 = Math.atan2(p.y - a.y, p.x - a.x);
    const h2 = Math.atan2(b.y - p.y, b.x - p.x);
    let d = Math.abs(h2 - h1);
    if (d > Math.PI) d = 2 * Math.PI - d;
    p.curve = d;
  });
  return { points, length };
}

export const { points: TRACK, length: TRACK_LENGTH } = buildTrack();

/** Punto della pista piu' vicino, cercando attorno all'ultimo. */
export function nearest(x, y, hint) {
  let best = hint;
  let bestD = Infinity;
  for (let k = -30; k <= 30; k += 1) {
    const i = (hint + k + TRACK.length) % TRACK.length;
    const d = Math.hypot(TRACK[i].x - x, TRACK[i].y - y);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return { index: best, dist: bestD };
}

/** Punto a una distanza s (con i giri) lungo la pista, spostato di lato di offset. */
export function pointAtDistance(s, offset = 0) {
  const d = ((s % TRACK_LENGTH) + TRACK_LENGTH) % TRACK_LENGTH;
  let lo = 0;
  let hi = TRACK.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (TRACK[mid].s <= d) lo = mid;
    else hi = mid - 1;
  }
  const p = TRACK[lo];
  const q = TRACK[(lo + 1) % TRACK.length];
  const seg = Math.hypot(q.x - p.x, q.y - p.y) || 1;
  const k = (d - p.s) / seg;
  const angle = Math.atan2(q.y - p.y, q.x - p.x);
  return { x: p.x + (q.x - p.x) * k - Math.sin(angle) * offset, y: p.y + (q.y - p.y) * k + Math.cos(angle) * offset, angle, curve: p.curve };
}

/** Palazzi: blocchi in una griglia, tolti quelli che toccherebbero la strada. */
function buildBlocks() {
  const blocks = [];
  const colors = ['#6b5b7a', '#7a6a58', '#5b6b7a', '#7a5b5b', '#56606b', '#8a7a64'];
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let gx = -1300; gx < 1300; gx += 170) {
    for (let gy = -900; gy < 900; gy += 170) {
      const w = 110 + rand() * 40;
      const h = 110 + rand() * 40;
      const cx = gx + 85;
      const cy = gy + 85;
      const reach = Math.hypot(w, h) / 2 + HALF + 30;
      if (TRACK.some((p) => Math.hypot(p.x - cx, p.y - cy) < reach)) continue;
      blocks.push({ x: cx - w / 2, y: cy - h / 2, w, h, color: colors[Math.floor(rand() * colors.length)], lit: rand() });
    }
  }
  return blocks;
}

export const BLOCKS = buildBlocks();
