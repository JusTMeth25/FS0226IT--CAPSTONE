/**
 * Forma della pista dei go-kart, la stessa nella stanza dell'hotel e nel minigioco: una
 * superellisse (rettilinei lunghi, curve strette). I punti sono ricampionati a passo costante,
 * cosi' la frazione di giro `u` corrisponde alla distanza percorsa: un kart che va a velocita'
 * costante si muove in modo regolare sia nel pannello sia nella stanza.
 *
 * Coordinate normalizzate: x e y fra -1 e 1, u = 0 sulla linea di partenza (a meta' del
 * rettilineo in basso), poi verso destra.
 */
const EXPONENT = 0.45;
const RAW = 720;
export const TRACK_POINTS = 360;

function rawPoint(t) {
  const theta = Math.PI / 2 - t * Math.PI * 2;
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return { x: Math.sign(c) * Math.abs(c) ** EXPONENT, y: Math.sign(s) * Math.abs(s) ** EXPONENT };
}

/** Punti a passo costante lungo la pista, in un rettangolo largo `a` e alto `b` (semiassi). */
export function trackPoints(a = 1, b = 1) {
  const raw = Array.from({ length: RAW + 1 }, (_, i) => {
    const p = rawPoint(i / RAW);
    return { x: p.x * a, y: p.y * b };
  });
  const cumulative = [0];
  for (let i = 1; i < raw.length; i += 1) {
    cumulative.push(cumulative[i - 1] + Math.hypot(raw[i].x - raw[i - 1].x, raw[i].y - raw[i - 1].y));
  }
  const total = cumulative[cumulative.length - 1];
  const points = [];
  let j = 1;
  for (let i = 0; i < TRACK_POINTS; i += 1) {
    const target = (i / TRACK_POINTS) * total;
    while (j < raw.length - 1 && cumulative[j] < target) j += 1;
    const span = cumulative[j] - cumulative[j - 1] || 1;
    const k = (target - cumulative[j - 1]) / span;
    points.push({ x: raw[j - 1].x + (raw[j].x - raw[j - 1].x) * k, y: raw[j - 1].y + (raw[j].y - raw[j - 1].y) * k });
  }
  return { points, length: total };
}

const UNIT = trackPoints(1, 1).points;

/** Punto (normalizzato) a una frazione di giro u, interpolato fra i campioni. */
export function unitPoint(u) {
  const f = ((u % 1) + 1) % 1 * TRACK_POINTS;
  const i = Math.floor(f);
  const a = UNIT[i % TRACK_POINTS];
  const b = UNIT[(i + 1) % TRACK_POINTS];
  const k = f - i;
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
}

/** Differenza fra due frazioni di giro, fra -0.5 e 0.5 (attraverso il traguardo). */
export function lapDelta(from, to) {
  let d = to - from;
  if (d > 0.5) d -= 1;
  if (d < -0.5) d += 1;
  return d;
}
