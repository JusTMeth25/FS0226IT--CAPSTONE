import { trackPoints, TRACK_POINTS } from '../kartTrack.js';

/** Mondo del minigioco del go-kart: pista in unita' del mondo, fisica e ricerca in pista. */

export { TRACK_POINTS };
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

/** Mondo del minigioco: pista grande (semiassi in unita'), meta' larghezza dell'asfalto. */
export const A = 900;
export const B = 520;
export const HALF = 72;
export const WALL = HALF + 70;
export const { points: TRACK, length: TRACK_LENGTH } = trackPoints(A, B);
export const LAPS = 3;
export const MAX_SPEED = 420;
export const GRASS_SPEED = 170;
export const ACCEL = 300;
export const BRAKE = 620;
export const COAST = 90;
export const STEER = 2.7;

/** Vista: pixel per unita' del mondo, e dimensioni del canvas. */
export const SCALE = 0.42;
export const VIEW_W = 440;
export const VIEW_H = 300;
export const MARGIN = 260;
export const WORLD_X0 = -A - MARGIN;
export const WORLD_Y0 = -B - MARGIN;
export const WORLD_W = (A + MARGIN) * 2;
export const WORLD_H = (B + MARGIN) * 2;

/** Punto della pista piu' vicino, cercando attorno all'ultimo (il kart non salta). */
export function nearest(x, y, hint) {
  let best = hint;
  let bestD = Infinity;
  for (let k = -24; k <= 24; k += 1) {
    const i = (hint + k + TRACK_POINTS) % TRACK_POINTS;
    const d = Math.hypot(TRACK[i].x - x, TRACK[i].y - y);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return { index: best, dist: bestD };
}

/** Frazione di giro di un punto qualsiasi fra due campioni. */
export function pointAt(u, offset = 0) {
  const f = ((u % 1) + 1) % 1 * TRACK_POINTS;
  const i = Math.floor(f);
  const p = TRACK[i % TRACK_POINTS];
  const q = TRACK[(i + 1) % TRACK_POINTS];
  const k = f - i;
  const angle = Math.atan2(q.y - p.y, q.x - p.x);
  return {
    x: p.x + (q.x - p.x) * k - Math.sin(angle) * offset,
    y: p.y + (q.y - p.y) * k + Math.cos(angle) * offset,
    angle
  };
}

