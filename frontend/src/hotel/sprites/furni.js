import { HALF_H, HALF_W } from '../iso.js';
import { bake, createCanvas, shade } from './pixel.js';
import { getRarityColor, resolveCardImage } from '../../utils/cardUtils.js';
import { BASE_URL } from '../../services/apiClient.js';

/**
 * Mobili in pixel art stile Habbo, disegnati da codice come gli avatar.
 *
 * Ogni mobile e' fatto di forme semplici in coordinate di casella (u lungo x, v lungo y, z in
 * pixel verso l'alto): parallelepipedi con le facce in legno, stoffa o metallo, cilindri per
 * vasi e paralumi, ciuffi di foglie. La luce viene da sinistra: faccia sinistra appena in
 * ombra, destra piu' scura, spigoli davanti illuminati. Alla fine un contorno scuro unico gira
 * attorno a tutto il mobile, come negli sprite di Habbo.
 *
 * I tipi devono coincidere con FurniCatalog.java. Uno sprite ha l'ancora nel vertice alto
 * della casella d'angolo del mobile, lo stesso punto che il renderer calcola con tileTop.
 */
const OUTLINE = '#1a1030';
const PAD = 96;
const TOP_ROOM = 150;

// ------------------------------------------------------------------ regole comuni

/** Mobile "a terra" (tappeti, piastrelle): gli altri mobili ci si possono appoggiare sopra. */
export function isFlat(def) {
  return !!def && def.walkable && def.sitDir < 0 && !def.wall;
}

/** Caselle occupate con la rotazione data: rot 2 e 6 scambiano larghezza e lunghezza. */
export function footprintOf(def, rot) {
  if (!def || def.wall) return { fx: 1, fy: 1 };
  return rot === 2 || rot === 6 ? { fx: def.length, fy: def.width } : { fx: def.width, fy: def.length };
}

/** Rotazione successiva: quattro lati per i mobili a pavimento, le due pareti per quelli appesi. */
export function nextRotation(def, rot) {
  if (def?.wall) return rot === 2 ? 0 : 2;
  return ((rot || 0) + 2) % 8;
}

// ------------------------------------------------------------------ texture

function hash(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Texture per pixel: ricevono il colore della faccia e il pixel sullo schermo e restituiscono
 * il colore da usare. Legno venato, stoffa con la trama, metallo con il riflesso, pietra.
 */
const TEXTURES = {
  wood: (base, x, y) => {
    const grain = Math.sin(y * 0.9 + Math.sin(x * 0.18) * 2.2 + hash(Math.floor(y / 5), 3) * 3);
    if (grain > 0.86) return shade(base, -0.16);
    if (grain < -0.94) return shade(base, 0.08);
    return base;
  },
  fabric: (base, x, y) => ((x + y) % 2 === 0 ? shade(base, 0.04) : shade(base, -0.03)),
  metal: (base, x, y) => ((x + y * 2) % 11 === 0 ? shade(base, 0.25) : base),
  stone: (base, x, y) => shade(base, (hash(x, y) - 0.5) * 0.12)
};

// ------------------------------------------------------------------ primitive

/** Riempie un poligono convesso a righe intere; il colore puo' essere una funzione del pixel. */
function fillPolygon(ctx, points, color) {
  const ys = points.map((p) => p.y);
  const minY = Math.ceil(Math.min(...ys));
  const maxY = Math.floor(Math.max(...ys));
  const perPixel = typeof color === 'function';
  if (!perPixel) ctx.fillStyle = color;
  for (let y = minY; y <= maxY; y += 1) {
    const xs = [];
    for (let i = 0; i < points.length; i += 1) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      if ((y >= a.y && y < b.y) || (y >= b.y && y < a.y)) {
        xs.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x));
      }
    }
    if (xs.length < 2) continue;
    const left = Math.round(Math.min(...xs));
    const right = Math.round(Math.max(...xs));
    if (!perPixel) {
      ctx.fillRect(left, y, Math.max(1, right - left), 1);
      continue;
    }
    for (let x = left; x < Math.max(left + 1, right); x += 1) {
      ctx.fillStyle = color(x, y);
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

/** Linea a pixel netti fra due punti dello schermo. */
function line(ctx, a, b, color) {
  ctx.fillStyle = color;
  const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y), 1);
  for (let i = 0; i <= steps; i += 1) {
    ctx.fillRect(Math.round(a.x + ((b.x - a.x) * i) / steps), Math.round(a.y + ((b.y - a.y) * i) / steps), 1, 1);
  }
}

/**
 * Parallelepipedo da (u0,v0) a (u1,v1) in caselle, dalla quota z0 alla z1 in pixel.
 * Le facce laterali si scuriscono verso il basso e gli spigoli davanti prendono luce.
 */
function box(ctx, P, { u0, v0, u1, v1, z0 = 0, z1, color, left, right, top, tex, glow }) {
  const topFace = [P(u0, v0, z1), P(u1, v0, z1), P(u1, v1, z1), P(u0, v1, z1)];
  const leftFace = [P(u0, v1, z1), P(u1, v1, z1), P(u1, v1, z0), P(u0, v1, z0)];
  const rightFace = [P(u1, v0, z1), P(u1, v1, z1), P(u1, v1, z0), P(u1, v0, z0)];
  const texture = tex ? TEXTURES[tex] : null;
  const height = Math.max(1, z1 - z0);
  const leftColor = left || shade(color, -0.18);
  const sideFill = (base, face) => {
    if (!texture && height < 6) return base;
    const bottom = Math.max(...face.map((p) => p.y));
    return (x, y) => {
      const c = bottom - y < height * 0.25 ? shade(base, -0.08) : base;
      return texture ? texture(c, x, y) : c;
    };
  };
  const topColor = top || color;
  if (height > 0) {
    fillPolygon(ctx, leftFace, sideFill(leftColor, leftFace));
    fillPolygon(ctx, rightFace, sideFill(right || shade(color, -0.36), rightFace));
  }
  fillPolygon(ctx, topFace, texture ? (x, y) => texture(topColor, x, y) : topColor);
  // Spigoli illuminati: il bordo davanti del piano e lo spigolo verticale verso chi guarda.
  line(ctx, P(u0, v1, z1), P(u1, v1, z1), shade(topColor, glow ? 0.5 : 0.22));
  line(ctx, P(u1, v1, z1), P(u1, v0, z1), shade(topColor, 0.1));
  if (height > 3) line(ctx, P(u1, v1, z1 - 1), P(u1, v1, z0 + 1), shade(leftColor, 0.12));
}

/**
 * Cilindro verticale con centro (u, v) e raggio r in caselle: vasi, paralumi, gambe, tavoli
 * tondi. Il corpo sfuma da chiaro a scuro da sinistra a destra, il coperchio e' un'ellisse.
 */
function cylinder(ctx, P, { u, v, r, z0 = 0, z1, color, top, tex, open = false }) {
  const rx = r * HALF_W * Math.SQRT2;
  const ry = r * HALF_H * Math.SQRT2;
  const base = P(u, v, z0);
  const lid = P(u, v, z1);
  const texture = tex ? TEXTURES[tex] : null;
  for (let x = Math.floor(base.x - rx); x <= Math.ceil(base.x + rx); x += 1) {
    const t = (x + 0.5 - base.x) / rx;
    if (Math.abs(t) > 1) continue;
    const dy = ry * Math.sqrt(1 - t * t);
    const yTop = Math.round(lid.y + dy);
    const yBottom = Math.round(base.y + dy);
    const light = t < -0.35 ? 0.12 : t > 0.45 ? -0.34 : t > 0.05 ? -0.16 : 0;
    const col = shade(color, light);
    for (let y = yTop; y <= yBottom; y += 1) {
      ctx.fillStyle = texture ? texture(col, x, y) : col;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const lidColor = open ? shade(color, -0.45) : (top || shade(color, 0.12));
  for (let y = Math.floor(lid.y - ry); y <= Math.ceil(lid.y + ry); y += 1) {
    const t = (y + 0.5 - lid.y) / ry;
    if (Math.abs(t) > 1) continue;
    const dx = rx * Math.sqrt(1 - t * t);
    ctx.fillStyle = lidColor;
    ctx.fillRect(Math.round(lid.x - dx), y, Math.max(1, Math.round(dx * 2)), 1);
  }
  // Bordo del coperchio chiaro davanti.
  ctx.fillStyle = shade(top || color, 0.3);
  for (let x = Math.floor(lid.x - rx * 0.8); x <= Math.ceil(lid.x + rx * 0.3); x += 1) {
    const t = (x + 0.5 - lid.x) / rx;
    ctx.fillRect(x, Math.round(lid.y + ry * Math.sqrt(Math.max(0, 1 - t * t))), 1, 1);
  }
}

/** Ciuffo di foglie: tante piccole ellissi in tre verdi, piu' chiare in alto a sinistra. */
function foliage(ctx, P, { u, v, z, r, color = '#2f9e44', seed = 1, spread = 1 }) {
  const c = P(u, v, z);
  const greens = [shade(color, -0.3), color, shade(color, 0.25)];
  const leaves = Math.round(44 * r * spread);
  for (let i = 0; i < leaves; i += 1) {
    const a = hash(i, seed) * Math.PI * 2;
    const d = Math.sqrt(hash(seed, i)) * r * 18;
    const lx = c.x + Math.cos(a) * d * 1.3;
    const ly = c.y + Math.sin(a) * d * 0.9;
    const shadeIndex = ly < c.y - 3 && lx < c.x + 4 ? 2 : ly > c.y + 5 ? 0 : 1;
    const w = 5 + Math.floor(hash(i, seed + 7) * 4);
    ctx.fillStyle = greens[shadeIndex];
    ctx.fillRect(Math.round(lx - w / 2), Math.round(ly - 2), w, 4);
    ctx.fillRect(Math.round(lx - w / 2 + 1), Math.round(ly - 3), w - 2, 6);
    ctx.fillStyle = shade(greens[shadeIndex], 0.2);
    ctx.fillRect(Math.round(lx - w / 2 + 1), Math.round(ly - 3), 2, 1);
  }
}

/** Palma: foglie lunghe a ventaglio che ricadono, con le foglioline ai lati della nervatura. */
function fronds(ctx, P, { u, v, z, length = 30, color = '#22a355', seed = 1 }) {
  const c = P(u, v, z);
  const count = 8;
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 + hash(i, seed) * 0.4;
    const dirX = Math.cos(angle) * 1.25;
    const dirY = Math.sin(angle) * 0.6;
    const len = length * (0.75 + hash(seed, i) * 0.35);
    const tone = dirY < -0.2 ? shade(color, 0.2) : dirY > 0.3 ? shade(color, -0.25) : color;
    for (let t = 0; t <= len; t += 1) {
      const k = t / len;
      const x = c.x + dirX * t;
      const y = c.y + dirY * t - Math.sin(k * Math.PI) * 8 + k * k * 10;
      ctx.fillStyle = shade(tone, -0.2);
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      if (t % 2 === 0 && k > 0.1) {
        const leaf = Math.round(5 * (1 - k * 0.6));
        ctx.fillStyle = tone;
        ctx.fillRect(Math.round(x), Math.round(y + 1), 1, leaf);
        ctx.fillRect(Math.round(x - dirY * 2), Math.round(y - leaf + 1), 1, leaf);
      }
    }
  }
  ctx.fillStyle = shade(color, -0.35);
  ctx.fillRect(Math.round(c.x) - 2, Math.round(c.y) - 2, 5, 4);
}

/** Contorno unico attorno al mobile: ogni pixel vuoto che tocca il disegno diventa scuro. */
function outline(ctx, w, h) {
  let image;
  try {
    image = ctx.getImageData(0, 0, w, h);
  } catch {
    return;
  }
  const d = image.data;
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 40;
  ctx.fillStyle = OUTLINE;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) ctx.fillRect(x, y, 1, 1);
    }
  }
}

// ------------------------------------------------------------------ mobili

/**
 * Ogni disegnatore lavora come se il mobile avesse rot 0, con il davanti verso +v (in basso a
 * sinistra sullo schermo). Riceve:
 *  - b(opts): parallelepipedo; c(opts): cilindro; leaves(opts): fogliame; palm(opts): palma
 *  - d(u, v, z, color, w, h): rettangolino di pixel su una faccia
 *  - front(fn): parti sul lato davanti, che con rot 4 e 6 finiscono dietro al mobile
 */
const WOOD = '#8a5a3b';
const WOOD_DARK = '#5b3a26';

const DRAW = {
  chair_neon(b) {
    [[0.24, 0.24], [0.24, 0.7], [0.7, 0.24], [0.7, 0.7]].forEach(([u, v]) => b({ u0: u, v0: v, u1: u + 0.06, v1: v + 0.06, z1: 16, color: '#2a1f55' }));
    b({ u0: 0.2, v0: 0.2, u1: 0.8, v1: 0.8, z0: 16, z1: 22, color: '#8b5cf6', tex: 'fabric' });
    b({ u0: 0.2, v0: 0.2, u1: 0.32, v1: 0.8, z0: 22, z1: 54, color: '#ec4899', tex: 'fabric' });
    b({ u0: 0.2, v0: 0.2, u1: 0.32, v1: 0.8, z0: 54, z1: 56, color: '#f9a8d4', glow: true });
  },
  sofa_vinyl(b) {
    b({ u0: 0.06, v0: 0.12, u1: 1.94, v1: 0.9, z1: 14, color: '#1e1b3a' });
    b({ u0: 0.1, v0: 0.2, u1: 1.0, v1: 0.9, z0: 14, z1: 22, color: '#22d3ee', tex: 'fabric' });
    b({ u0: 1.0, v0: 0.2, u1: 1.9, v1: 0.9, z0: 14, z1: 22, color: '#22d3ee', tex: 'fabric' });
    b({ u0: 0.06, v0: 0.12, u1: 1.94, v1: 0.3, z0: 14, z1: 46, color: '#1a9fb5', tex: 'fabric' });
    b({ u0: 0.06, v0: 0.12, u1: 0.24, v1: 0.9, z0: 14, z1: 32, color: '#1a9fb5', tex: 'fabric' });
    b({ u0: 1.76, v0: 0.12, u1: 1.94, v1: 0.9, z0: 14, z1: 32, color: '#1a9fb5', tex: 'fabric' });
  },
  armchair(b) {
    b({ u0: 0.1, v0: 0.1, u1: 0.9, v1: 0.9, z1: 12, color: '#3a2340' });
    b({ u0: 0.26, v0: 0.18, u1: 0.84, v1: 0.84, z0: 12, z1: 22, color: '#14b8a6', tex: 'fabric' });
    b({ u0: 0.1, v0: 0.1, u1: 0.28, v1: 0.9, z0: 12, z1: 50, color: '#0f8f82', tex: 'fabric' });
    b({ u0: 0.1, v0: 0.1, u1: 0.9, v1: 0.24, z0: 12, z1: 34, color: '#0f8f82', tex: 'fabric' });
    b({ u0: 0.1, v0: 0.76, u1: 0.9, v1: 0.9, z0: 12, z1: 34, color: '#0f8f82', tex: 'fabric' });
  },
  bar_stool(b, { c }) {
    c({ u: 0.5, v: 0.5, r: 0.2, z0: 0, z1: 2, color: '#6b7280' });
    c({ u: 0.5, v: 0.5, r: 0.05, z0: 2, z1: 30, color: '#9ca3af', tex: 'metal' });
    c({ u: 0.5, v: 0.5, r: 0.18, z0: 10, z1: 12, color: '#9ca3af' });
    c({ u: 0.5, v: 0.5, r: 0.25, z0: 30, z1: 36, color: '#ec4899', top: '#f472b6', tex: 'fabric' });
  },
  beanbag(b, { c }) {
    c({ u: 0.5, v: 0.5, r: 0.36, z0: 0, z1: 14, color: '#8b5cf6', tex: 'fabric' });
    c({ u: 0.5, v: 0.5, r: 0.3, z0: 14, z1: 20, color: '#a78bfa', tex: 'fabric' });
    b({ u0: 0.14, v0: 0.2, u1: 0.3, v1: 0.8, z0: 12, z1: 34, color: '#7c3aed', tex: 'fabric' });
  },
  table_round(b, { c }) {
    c({ u: 0.5, v: 0.5, r: 0.18, z0: 0, z1: 3, color: '#4b5563' });
    c({ u: 0.5, v: 0.5, r: 0.05, z0: 3, z1: 30, color: '#9ca3af', tex: 'metal' });
    c({ u: 0.5, v: 0.5, r: 0.36, z0: 30, z1: 34, color: '#e5e7eb', top: '#f8fafc' });
  },
  cafe_table(b, { c }) {
    c({ u: 0.5, v: 0.5, r: 0.16, z0: 0, z1: 3, color: '#1f1f2e' });
    c({ u: 0.5, v: 0.5, r: 0.05, z0: 3, z1: 30, color: '#1f1f2e' });
    c({ u: 0.5, v: 0.5, r: 0.36, z0: 30, z1: 35, color: WOOD, top: '#a06a45', tex: 'wood' });
  },
  coffee_table(b) {
    [[0.12, 0.2], [0.12, 0.72], [1.82, 0.2], [1.82, 0.72]].forEach(([u, v]) => b({ u0: u, v0: v, u1: u + 0.08, v1: v + 0.08, z1: 14, color: WOOD_DARK }));
    b({ u0: 0.08, v0: 0.16, u1: 1.92, v1: 0.84, z0: 14, z1: 20, color: WOOD, tex: 'wood' });
    b({ u0: 0.5, v0: 0.36, u1: 0.8, v1: 0.6, z0: 20, z1: 22, color: '#ec4899' });
    b({ u0: 1.3, v0: 0.4, u1: 1.4, v1: 0.5, z0: 20, z1: 28, color: '#f5f5f5' });
  },
  plant_palm(b, { c, palm }) {
    c({ u: 0.5, v: 0.5, r: 0.2, z0: 0, z1: 18, color: '#b45309', top: '#3f2a1a', tex: 'stone' });
    for (let z = 18; z < 62; z += 6) c({ u: 0.5, v: 0.5, r: 0.05, z0: z, z1: z + 5, color: '#8a6433', top: '#6b4a2a' });
    palm({ u: 0.5, v: 0.5, z: 64, length: 30, color: '#22a355', seed: 3 });
  },
  plant_big(b, { c, leaves }) {
    c({ u: 0.5, v: 0.5, r: 0.24, z0: 0, z1: 22, color: '#e7e1d4', top: '#3f2a1a', tex: 'stone' });
    c({ u: 0.5, v: 0.5, r: 0.04, z0: 22, z1: 60, color: '#6b4a2a', tex: 'wood' });
    leaves({ u: 0.5, v: 0.5, z: 82, r: 1.35, color: '#2f8f3a', seed: 11 });
    leaves({ u: 0.5, v: 0.5, z: 66, r: 1.0, color: '#2a7f34', seed: 5 });
  },
  lamp_neon(b, { c, d }) {
    c({ u: 0.5, v: 0.5, r: 0.18, z0: 0, z1: 4, color: '#1f1f2e' });
    c({ u: 0.5, v: 0.5, r: 0.03, z0: 4, z1: 70, color: '#4b4570', tex: 'metal' });
    c({ u: 0.5, v: 0.5, r: 0.26, z0: 70, z1: 92, color: '#22d3ee', top: '#a5f3fc' });
    d(0.5, 0.5, 94, '#ffffff', 4, 1);
  },
  lamp_floor(b, { c }) {
    c({ u: 0.5, v: 0.5, r: 0.16, z0: 0, z1: 4, color: '#3f3f46' });
    c({ u: 0.5, v: 0.5, r: 0.03, z0: 4, z1: 78, color: '#d4a017', tex: 'metal' });
    c({ u: 0.5, v: 0.5, r: 0.3, z0: 78, z1: 100, color: '#fcd34d', top: '#fff7cc', open: true });
  },
  rug_vinyl(b, { c }) {
    c({ u: 1, v: 1, r: 0.92, z0: 0, z1: 1, color: '#111018', top: '#15131f' });
    [0.8, 0.66, 0.52].forEach((r) => c({ u: 1, v: 1, r, z0: 1, z1: 1, color: '#15131f', top: r === 0.66 ? '#231f33' : '#1a1727' }));
    c({ u: 1, v: 1, r: 0.34, z0: 1, z1: 2, color: '#ec4899', top: '#ec4899' });
    c({ u: 1, v: 1, r: 0.06, z0: 2, z1: 2, color: '#111018', top: '#111018' });
  },
  rug_round(b, { c }) {
    c({ u: 1, v: 1, r: 0.95, z0: 0, z1: 1, color: '#c9b79c', top: '#d8c7ab' });
    c({ u: 1, v: 1, r: 0.8, z0: 1, z1: 1, color: '#d8c7ab', top: '#b45f3c' });
    c({ u: 1, v: 1, r: 0.66, z0: 1, z1: 1, color: '#b45f3c', top: '#e8dcc4' });
    c({ u: 1, v: 1, r: 0.3, z0: 1, z1: 1, color: '#e8dcc4', top: '#2f5d63' });
  },
  speaker(b, { d, front }) {
    b({ u0: 0.18, v0: 0.2, u1: 0.82, v1: 0.8, z1: 60, color: '#262233', left: '#1f1c2b', right: '#15131e', tex: 'fabric' });
    front(() => {
      [[44, 7], [22, 10]].forEach(([z, s]) => {
        d(0.36, 0.8, z, '#3b3552', s * 2, s * 2 - 2);
        d(0.42, 0.8, z - 4, '#8b5cf6', s, s - 2);
      });
    });
  },
  jukebox(b, { c, d, now, front }) {
    b({ u0: 0.12, v0: 0.18, u1: 0.88, v1: 0.82, z1: 70, color: '#7c2d12', left: '#9a3412', right: '#431407', tex: 'wood' });
    c({ u: 0.5, v: 0.5, r: 0.38, z0: 70, z1: 78, color: '#fbbf24', top: '#fde68a' });
    front(() => {
      const colors = ['#ec4899', '#22d3ee', '#ffd700', '#8b5cf6', '#22c55e'];
      for (let i = 0; i < 6; i += 1) {
        const col = colors[(i + Math.floor((now || 0) / 300)) % colors.length];
        d(0.18 + i * 0.12, 0.82, 64 - i * 2, col, 5, 5);
      }
      d(0.3, 0.82, 44, '#111018', 18, 16);
      d(0.33, 0.82, 42, '#fbbf24', 12, 2);
      d(0.33, 0.82, 36, '#fbbf24', 12, 2);
      d(0.3, 0.82, 20, '#431407', 18, 10);
    });
  },
  dance_tile(b, { item }) {
    const colors = ['#ec4899', '#22d3ee', '#ffd700', '#8b5cf6', '#22c55e', '#3b82f6'];
    const playing = item?.playing && item.colorIndex >= 0;
    const color = playing ? colors[item.colorIndex % colors.length] : '#2d2a55';
    b({ u0: 0.04, v0: 0.04, u1: 0.96, v1: 0.96, z1: 2, color, glow: playing });
    b({ u0: 0.3, v0: 0.3, u1: 0.7, v1: 0.7, z0: 2, z1: 2, color: shade(color, 0.3) });
  },
  trophy(b, { c }) {
    b({ u0: 0.24, v0: 0.24, u1: 0.76, v1: 0.76, z1: 16, color: '#1f1f2e', tex: 'stone' });
    c({ u: 0.5, v: 0.5, r: 0.06, z0: 16, z1: 30, color: '#d4a017', tex: 'metal' });
    b({ u0: 0.2, v0: 0.46, u1: 0.28, v1: 0.54, z0: 38, z1: 48, color: '#ffd700' });
    c({ u: 0.5, v: 0.5, r: 0.22, z0: 30, z1: 52, color: '#ffd700', top: '#fff3b0', open: true });
    b({ u0: 0.72, v0: 0.46, u1: 0.8, v1: 0.54, z0: 38, z1: 48, color: '#ffd700' });
  },
  card_pedestal(b) {
    b({ u0: 0.22, v0: 0.22, u1: 0.78, v1: 0.78, z1: 32, color: '#f4f1ff', left: '#d9d2f5', right: '#b7aee0', tex: 'stone' });
    b({ u0: 0.16, v0: 0.16, u1: 0.84, v1: 0.84, z0: 32, z1: 36, color: '#8b5cf6', glow: true });
  },
  bookshelf(b, { d, front }) {
    b({ u0: 0.1, v0: 0.3, u1: 0.9, v1: 0.84, z1: 110, color: WOOD, tex: 'wood' });
    front(() => {
      const books = ['#ef4444', '#22c55e', '#3b82f6', '#fbbf24', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
      [8, 34, 60, 86].forEach((z, shelf) => {
        d(0.14, 0.84, z + 20, WOOD_DARK, 22, 20);
        let u = 0.16;
        for (let i = 0; i < 6; i += 1) {
          const w = 2 + Math.floor(hash(i, shelf) * 2);
          const h = 12 + Math.floor(hash(shelf, i) * 6);
          d(u, 0.84, z + h, books[(i + shelf * 3) % books.length], w, h);
          u += (w + 1) / 32;
        }
      });
    });
  },
  record_shelf(b, { d, front }) {
    b({ u0: 0.12, v0: 0.3, u1: 0.88, v1: 0.82, z1: 70, color: '#2a1f55', tex: 'wood' });
    front(() => {
      [6, 30, 54].forEach((z, shelf) => {
        for (let i = 0; i < 5; i += 1) {
          const color = ['#ec4899', '#22d3ee', '#ffd700', '#8b5cf6', '#f97316', '#22c55e'][(i + shelf) % 6];
          d(0.16 + i * 0.14, 0.82, z + 16, '#111018', 4, 16);
          d(0.16 + i * 0.14, 0.82, z + 10, color, 3, 4);
        }
      });
    });
  },
  turntable(b, { c, d }) {
    b({ u0: 0.1, v0: 0.14, u1: 0.9, v1: 0.86, z1: 30, color: WOOD_DARK, tex: 'wood' });
    b({ u0: 0.12, v0: 0.16, u1: 0.88, v1: 0.84, z0: 30, z1: 36, color: '#e5e7eb', tex: 'metal' });
    c({ u: 0.46, v: 0.5, r: 0.3, z0: 36, z1: 38, color: '#111018', top: '#18161f' });
    c({ u: 0.46, v: 0.5, r: 0.1, z0: 38, z1: 38, color: '#ec4899', top: '#ec4899' });
    b({ u0: 0.74, v0: 0.2, u1: 0.8, v1: 0.26, z0: 36, z1: 42, color: '#6b7280' });
    b({ u0: 0.62, v0: 0.22, u1: 0.8, v1: 0.26, z0: 42, z1: 43, color: '#9ca3af' });
    d(0.18, 0.84, 18, '#22d3ee', 3, 2);
  },
  arcade(b, { d, now, front }) {
    b({ u0: 0.14, v0: 0.2, u1: 0.86, v1: 0.8, z1: 96, color: '#3b1d6e', tex: 'wood' });
    front(() => {
      b({ u0: 0.14, v0: 0.8, u1: 0.86, v1: 0.94, z0: 44, z1: 50, color: '#1f1f2e' });
      const frame = Math.floor((now || 0) / 400) % 2;
      d(0.18, 0.8, 88, '#0b0b14', 20, 22);
      d(0.2, 0.8, 85, frame ? '#22d3ee' : '#8b5cf6', 16, 16);
      d(0.26, 0.8, 80, '#ffd700', 4, 3);
      d(0.4, 0.8, 74, '#ec4899', 5, 3);
      d(0.18, 0.8, 96, '#ec4899', 20, 5);
      d(0.3, 0.94, 50, '#ef4444', 3, 3);
      d(0.5, 0.94, 50, '#22c55e', 3, 3);
    });
  },
  coffee_machine(b, { d, front }) {
    b({ u0: 0.1, v0: 0.2, u1: 0.9, v1: 0.8, z1: 34, color: WOOD_DARK, tex: 'wood' });
    b({ u0: 0.16, v0: 0.26, u1: 0.84, v1: 0.76, z0: 34, z1: 70, color: '#d1d5db', tex: 'metal' });
    b({ u0: 0.16, v0: 0.26, u1: 0.84, v1: 0.76, z0: 70, z1: 74, color: '#9ca3af' });
    front(() => {
      d(0.24, 0.76, 60, '#1f1f2e', 14, 7);
      d(0.3, 0.76, 50, '#6b7280', 3, 5);
      d(0.5, 0.76, 50, '#6b7280', 3, 5);
      d(0.3, 0.76, 42, '#f5f5f5', 5, 6);
      d(0.6, 0.76, 64, '#ef4444', 2, 2);
    });
  },
  cafe_counter(b, { d, front }) {
    b({ u0: 0.04, v0: 0.14, u1: 1.96, v1: 0.86, z1: 42, color: '#2f5d63', tex: 'wood' });
    b({ u0: 0, v0: 0.1, u1: 2, v1: 0.9, z0: 42, z1: 46, color: WOOD, tex: 'wood' });
    b({ u0: 0.3, v0: 0.3, u1: 0.44, v1: 0.44, z0: 46, z1: 54, color: '#f5f5f5' });
    b({ u0: 1.3, v0: 0.3, u1: 1.7, v1: 0.6, z0: 46, z1: 60, color: '#bfdbfe', top: '#e0f2fe' });
    front(() => {
      for (let i = 0; i < 6; i += 1) d(0.14 + i * 0.3, 0.86, 34, '#244a4f', 6, 24);
    });
  },
  pool_water(b, { d, now }) {
    // Acqua della piscina: niente contorno fra una casella e l'altra, riflessi che si muovono.
    const step = Math.floor((now || 0) / 600) % 4;
    b({ u0: 0, v0: 0, u1: 1, v1: 1, z1: 0, color: '#2aa7c9' });
    const glints = [[0.2, 0.3], [0.6, 0.15], [0.35, 0.7], [0.75, 0.6], [0.1, 0.9], [0.85, 0.3]];
    glints.forEach(([u, v], i) => {
      const du = ((step + i) % 4) * 0.04;
      d(u + du, v, 0, i % 2 ? '#8fe3f5' : '#d6f4ff', 6, 1);
      d(u + du + 0.08, v + 0.04, 0, '#5cc6e0', 4, 1);
    });
  },
  sunbed(b) {
    [[0.14, 0.26], [0.14, 0.68], [0.82, 0.26], [0.82, 0.68]].forEach(([u, v]) => b({ u0: u, v0: v, u1: u + 0.05, v1: v + 0.05, z1: 10, color: '#e5e7eb' }));
    b({ u0: 0.1, v0: 0.24, u1: 0.9, v1: 0.76, z0: 10, z1: 13, color: '#f5f5f5' });
    ['#22d3ee', '#f5f5f5', '#22d3ee', '#f5f5f5', '#22d3ee'].forEach((color, i) => {
      b({ u0: 0.28 + i * 0.124, v0: 0.26, u1: 0.4 + i * 0.124, v1: 0.74, z0: 13, z1: 16, color, tex: 'fabric' });
    });
    b({ u0: 0.1, v0: 0.26, u1: 0.2, v1: 0.74, z0: 13, z1: 30, color: '#22d3ee', tex: 'fabric' });
    b({ u0: 0.1, v0: 0.26, u1: 0.28, v1: 0.74, z0: 13, z1: 22, color: '#22d3ee', tex: 'fabric' });
  },
  umbrella(b, { c }) {
    c({ u: 0.5, v: 0.5, r: 0.16, z0: 0, z1: 6, color: '#6b7280' });
    c({ u: 0.5, v: 0.5, r: 0.025, z0: 6, z1: 84, color: '#e5e7eb', tex: 'metal' });
    [[0.62, 78, 81, '#ec4899'], [0.5, 81, 85, '#fdf2f8'], [0.38, 85, 89, '#ec4899'], [0.24, 89, 92, '#fdf2f8'], [0.1, 92, 95, '#ec4899']]
      .forEach(([r, z0, z1, color]) => c({ u: 0.5, v: 0.5, r, z0, z1, color }));
  },
  lifeguard_chair(b, { d, front }) {
    [[0.14, 0.2], [0.14, 0.74], [0.8, 0.2], [0.8, 0.74]].forEach(([u, v]) => b({ u0: u, v0: v, u1: u + 0.06, v1: v + 0.06, z1: 62, color: '#f5f5f5' }));
    b({ u0: 0.1, v0: 0.16, u1: 0.9, v1: 0.84, z0: 60, z1: 64, color: '#ef4444' });
    b({ u0: 0.1, v0: 0.16, u1: 0.22, v1: 0.84, z0: 64, z1: 92, color: '#ef4444' });
    front(() => {
      [14, 28, 42].forEach((z) => d(0.2, 0.84, z, '#f5f5f5', 34, 2));
      d(0.34, 0.84, 88, '#f5f5f5', 10, 8);
      d(0.36, 0.84, 86, '#ef4444', 6, 4);
    });
  },
  aquarium(b, { d, now, front }) {
    b({ u0: 0.04, v0: 0.2, u1: 1.96, v1: 0.8, z1: 26, color: '#3b2a1e', tex: 'wood' });
    b({ u0: 0.06, v0: 0.22, u1: 1.94, v1: 0.78, z0: 26, z1: 70, color: '#38bdf8', left: '#1e94c9', right: '#146a92', top: '#7dd3fc' });
    b({ u0: 0.04, v0: 0.2, u1: 1.96, v1: 0.8, z0: 70, z1: 74, color: '#1f1f2e' });
    front(() => {
      const step = Math.floor((now || 0) / 300) % 6;
      d(0.1, 0.78, 34, '#d9b77c', 56, 6);
      [[0.3, 58, '#f97316'], [0.9, 48, '#fbbf24'], [1.4, 60, '#ec4899'], [0.6, 42, '#22c55e']].forEach(([u, z, color], i) => {
        const swim = ((step + i * 2) % 6) * 0.05 - 0.12;
        d(u + swim, 0.78, z, color, 6, 3);
        d(u + swim - 0.06, 0.78, z - 1, color, 2, 1);
      });
      [0.4, 1.2, 1.7].forEach((u) => d(u, 0.78, 44 + ((step * 5) % 20), '#e0f2fe', 2, 2));
      d(0.2, 0.78, 50, '#16a34a', 2, 14);
      d(1.6, 0.78, 54, '#16a34a', 2, 18);
    });
  },
  fireplace(b, { d, now, front }) {
    b({ u0: 0.06, v0: 0.12, u1: 1.94, v1: 0.74, z1: 62, color: '#8a7b6e', tex: 'stone' });
    b({ u0: 0.02, v0: 0.08, u1: 1.98, v1: 0.8, z0: 62, z1: 68, color: '#5b3a26', tex: 'wood' });
    b({ u0: 0.5, v0: 0.12, u1: 1.5, v1: 0.5, z0: 68, z1: 120, color: '#7a6c60', tex: 'stone' });
    b({ u0: 0.3, v0: 0.4, u1: 0.4, v1: 0.5, z0: 68, z1: 78, color: '#fbbf24' });
    front(() => {
      const step = Math.floor((now || 0) / 150) % 4;
      d(0.42, 0.74, 44, '#1a1210', 36, 30);
      const flames = ['#f97316', '#fbbf24', '#ef4444', '#fde68a'];
      for (let i = 0; i < 6; i += 1) {
        const h = 10 + ((i * 7 + step * 5) % 12);
        d(0.5 + i * 0.12, 0.74, 18 + h, flames[(i + step) % 4], 4, h);
      }
      d(0.46, 0.74, 18, '#5b3a26', 30, 4);
    });
  },
  bench(b) {
    [[0.14, 0.3], [0.14, 0.72], [1.8, 0.3], [1.8, 0.72]].forEach(([u, v]) => b({ u0: u, v0: v, u1: u + 0.06, v1: v + 0.06, z1: 18, color: '#1f2937' }));
    [0.28, 0.44, 0.6].forEach((v) => b({ u0: 0.08, v0: v, u1: 1.92, v1: v + 0.13, z0: 18, z1: 21, color: '#a06a45', tex: 'wood' }));
    [26, 36, 46].forEach((z) => b({ u0: 0.08, v0: 0.2, u1: 1.92, v1: 0.26, z0: z, z1: z + 6, color: '#a06a45', tex: 'wood' }));
    b({ u0: 0.14, v0: 0.2, u1: 0.2, v1: 0.26, z0: 18, z1: 52, color: '#1f2937' });
    b({ u0: 1.8, v0: 0.2, u1: 1.86, v1: 0.26, z0: 18, z1: 52, color: '#1f2937' });
  },
  fountain(b, { c, d, now }) {
    const step = Math.floor((now || 0) / 250) % 4;
    c({ u: 1, v: 1, r: 0.92, z0: 0, z1: 16, color: '#cbd5e1', top: '#e2e8f0', tex: 'stone' });
    c({ u: 1, v: 1, r: 0.8, z0: 16, z1: 16, color: '#38bdf8', top: '#38bdf8' });
    c({ u: 1, v: 1, r: 0.12, z0: 16, z1: 44, color: '#cbd5e1', tex: 'stone' });
    c({ u: 1, v: 1, r: 0.34, z0: 44, z1: 50, color: '#cbd5e1', top: '#7dd3fc', tex: 'stone' });
    c({ u: 1, v: 1, r: 0.05, z0: 50, z1: 62, color: '#bae6fd' });
    // Gocce che ricadono dalla vasca alta a quella bassa.
    [[0.72, 0.9], [1.28, 1.1], [0.9, 1.3], [1.1, 0.72]].forEach(([u, v], i) => {
      const z = 44 - ((step + i) % 4) * 7;
      d(u, v, z, '#e0f2fe', 2, 4);
    });
    [[0.6, 1.3], [1.35, 0.8], [1.2, 1.4]].forEach(([u, v], i) => d(u, v, 16, (step + i) % 2 ? '#bae6fd' : '#7dd3fc', 6, 1));
  },
  flower_bed(b, { d, leaves }) {
    b({ u0: 0.08, v0: 0.08, u1: 0.92, v1: 0.92, z1: 10, color: '#7c5a3b', tex: 'wood' });
    b({ u0: 0.14, v0: 0.14, u1: 0.86, v1: 0.86, z0: 10, z1: 10, color: '#3f2a1a' });
    leaves({ u: 0.5, v: 0.5, z: 16, r: 0.45, color: '#2f9e44', seed: 21 });
    const petals = ['#ec4899', '#fbbf24', '#f5f5f5', '#8b5cf6', '#ef4444'];
    [[0.3, 0.3], [0.7, 0.3], [0.5, 0.5], [0.3, 0.7], [0.7, 0.7], [0.5, 0.2], [0.2, 0.5], [0.8, 0.5]].forEach(([u, v], i) => {
      d(u, v, 22, petals[i % petals.length], 4, 3);
      d(u + 0.03, v, 23, '#fde68a', 1, 1);
    });
  },
  icecream_cart(b, { c, d, front }) {
    c({ u: 0.4, v: 0.86, r: 0.14, z0: 4, z1: 6, color: '#1f2937' });
    c({ u: 1.6, v: 0.86, r: 0.14, z0: 4, z1: 6, color: '#1f2937' });
    b({ u0: 0.1, v0: 0.18, u1: 1.9, v1: 0.82, z0: 10, z1: 46, color: '#fdf2f8' });
    b({ u0: 0.08, v0: 0.16, u1: 1.92, v1: 0.84, z0: 46, z1: 50, color: '#ec4899' });
    ['#f9a8d4', '#fde68a', '#a7f3d0', '#6b3e1f'].forEach((color, i) => c({ u: 0.4 + i * 0.36, v: 0.5, r: 0.12, z0: 50, z1: 54, color: '#e5e7eb', top: color }));
    c({ u: 1.7, v: 0.3, r: 0.025, z0: 50, z1: 96, color: '#e5e7eb' });
    [[0.62, 92, 94, '#ec4899'], [0.46, 94, 97, '#fdf2f8'], [0.28, 97, 100, '#ec4899'], [0.1, 100, 102, '#fdf2f8']]
      .forEach(([r, z0, z1, color]) => c({ u: 1.7, v: 0.3, r, z0, z1, color }));
    front(() => {
      for (let i = 0; i < 6; i += 1) d(0.16 + i * 0.3, 0.82, 44, i % 2 ? '#ec4899' : '#fdf2f8', 8, 34);
      d(0.7, 0.82, 34, '#8b5cf6', 30, 8);
    });
  },
  bar_counter(b, { d, front }) {
    b({ u0: 0.02, v0: 0.1, u1: 2.98, v1: 0.9, z1: 40, color: '#4a2511', left: '#5c2e15', right: '#2e170a', tex: 'wood' });
    b({ u0: 0, v0: 0.06, u1: 3, v1: 0.94, z0: 40, z1: 44, color: '#1f1f2e', glow: true });
    const bottles = ['#22c55e', '#ec4899', '#ffd700', '#22d3ee'];
    bottles.forEach((col, i) => b({ u0: 0.4 + i * 0.6, v0: 0.3, u1: 0.5 + i * 0.6, v1: 0.4, z0: 44, z1: 62, color: col }));
    front(() => {
      for (let i = 0; i < 16; i += 1) d(0.1 + i * 0.18, 0.9, 14, i % 2 ? '#ec4899' : '#22d3ee', 3, 2);
    });
  },
  dj_booth(b, { c, d, now, front }) {
    b({ u0: 0.05, v0: 0.1, u1: 1.95, v1: 0.9, z1: 34, color: '#1f1f2e', left: '#18182a', right: '#101019', tex: 'metal' });
    b({ u0: 0.05, v0: 0.1, u1: 1.95, v1: 0.9, z0: 34, z1: 38, color: '#8b5cf6', glow: true });
    [0.55, 1.45].forEach((u) => {
      c({ u, v: 0.5, r: 0.26, z0: 38, z1: 40, color: '#111018', top: '#18161f' });
      c({ u, v: 0.5, r: 0.08, z0: 40, z1: 40, color: '#ec4899', top: '#ec4899' });
    });
    front(() => {
      const pulse = Math.floor((now || 0) / 250) % 2 === 0;
      for (let i = 0; i < 10; i += 1) d(0.14 + i * 0.18, 0.9, 20, pulse === (i % 2 === 0) ? '#22d3ee' : '#ec4899', 4, 4);
    });
  }
};

// ------------------------------------------------------------------ mobili a parete

/**
 * Mobili a parete: disegnati sul piano del muro. Con rot 0 il muro e' quello di destra
 * (lungo x, in discesa verso destra), con rot 2 quello di sinistra. `a` e' la distanza lungo
 * il muro dall'angolo della casella, `h` l'altezza dal pavimento.
 */
function wallPoint(ox, oy, rot, a, h) {
  return rot === 2
    ? { x: ox - HALF_W + a, y: oy + HALF_H - a / 2 - h }
    : { x: ox + a, y: oy + a / 2 - h };
}

function wallRect(ctx, ox, oy, rot, a0, a1, h0, h1, color) {
  const perPixel = typeof color === 'function';
  for (let a = a0; a < a1; a += 1) {
    const top = wallPoint(ox, oy, rot, a, h1);
    for (let y = 0; y < h1 - h0; y += 1) {
      ctx.fillStyle = perPixel ? color(a, h1 - y) : color;
      ctx.fillRect(Math.round(top.x), Math.round(top.y) + y, 1, 1);
    }
  }
}

function drawWallItem(ctx, ox, oy, item, img, rarityColor, now) {
  const { type, rot } = item;
  const R = (a0, a1, h0, h1, color) => wallRect(ctx, ox, oy, rot, a0, a1, h0, h1, color);
  if (type === 'poster_neon') {
    R(6, 27, 40, 88, '#140a2e');
    R(9, 24, 76, 80, '#ec4899');
    R(9, 24, 64, 68, '#22d3ee');
    R(11, 22, 52, 56, '#ffd700');
    R(13, 20, 44, 47, '#8b5cf6');
  } else if (type === 'card_frame') {
    R(6, 27, 42, 86, '#c9a227');
    R(8, 25, 44, 84, rarityColor || '#8b5cf6');
    if (img) {
      const slope = rot === 2 ? -0.5 : 0.5;
      const p = wallPoint(ox, oy, rot, 10, 82);
      ctx.save();
      ctx.setTransform(1, slope, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, p.x, p.y - slope * p.x, 13, 36);
      ctx.restore();
    } else {
      R(10, 23, 46, 82, '#2a1f55');
    }
  } else if (type === 'neon_sign') {
    // Insegna al neon: una nota musicale e l'alone, che ogni tanto sfarfalla.
    const on = Math.floor((now || 0) / 1800) % 7 !== 0;
    R(2, 31, 58, 96, 'rgba(236, 72, 153, 0.18)');
    R(4, 29, 60, 94, '#140a2e');
    const tube = on ? '#ff7ad9' : '#7a3a66';
    const cyan = on ? '#7ae8ff' : '#2a5561';
    R(8, 14, 68, 74, cyan);
    R(12, 14, 72, 88, cyan);
    R(12, 24, 86, 88, tube);
    R(22, 24, 72, 88, tube);
    R(18, 24, 68, 74, tube);
  } else if (type === 'window_wall') {
    R(3, 30, 36, 104, '#e5e0d8');
    R(5, 28, 38, 102, (a, h) => {
      const glass = h > 70 ? '#8fd3e6' : '#6fb3c8';
      return (a + h) % 23 < 2 ? '#d6f4ff' : glass;
    });
    R(16, 17, 38, 102, '#e5e0d8');
    R(5, 28, 70, 71, '#e5e0d8');
    R(2, 31, 32, 36, '#cbc3b5');
  } else if (type === 'chalkboard') {
    R(4, 29, 40, 90, WOOD);
    R(6, 27, 42, 88, (a, h) => ((a * 7 + h * 3) % 29 === 0 ? '#3d5c4a' : '#23392d'));
    R(8, 20, 78, 80, '#f5f5f5');
    R(8, 24, 70, 71, '#fde68a');
    R(8, 17, 62, 63, '#f9a8d4');
    R(8, 22, 54, 55, '#f5f5f5');
    R(6, 27, 40, 42, '#d4c3a1');
  }
}

// ------------------------------------------------------------------ immagini delle carte

const cardImages = new Map();

/**
 * Immagine della carta esposta, caricata una volta sola. Le carte importate passano dal proxy
 * del backend come nella carta 3D: cosi' il canvas non viene "sporcato" da immagini di altri
 * domini e il clic al pixel sui mobili continua a funzionare.
 */
export function cardImage(card, onLoad) {
  if (!card) return null;
  const cached = cardImages.get(card.id);
  if (cached?.complete && cached.naturalWidth) return cached;
  if (!cached) {
    const img = new Image();
    const src = resolveCardImage(card);
    const proxied = /^https?:\/\//.test(src);
    // Il proxy sta sul backend, che in sviluppo e' su un'altra porta: senza CORS il canvas
    // diventerebbe illeggibile e addio contorni e clic al pixel.
    if (proxied) img.crossOrigin = 'anonymous';
    img.src = proxied ? `${BASE_URL}/cards/${encodeURIComponent(card.id)}/image` : src;
    img.onload = () => onLoad?.();
    cardImages.set(card.id, img);
  }
  return null;
}

// ------------------------------------------------------------------ sprite

/**
 * Disegna un mobile in un canvas suo. Restituisce il canvas e dove si trova, al suo interno,
 * il vertice alto della casella d'angolo (l'ancora).
 */
export function furniSprite(item, def, { now = 0, onImageLoad } = {}) {
  const { fx, fy } = footprintOf(def, item.rot);
  const width = (fx + fy) * HALF_W + PAD;
  const height = (fx + fy) * HALF_H + TOP_ROOM + 24;
  const { canvas, ctx } = createCanvas(width, height, { readable: true });
  const ox = fy * HALF_W + PAD / 2;
  const oy = TOP_ROOM;

  if (def.wall) {
    const img = def.cardDisplay ? cardImage(item.card, onImageLoad) : null;
    drawWallItem(ctx, ox, oy, item, img, item.card ? getRarityColor(item.card.rarity) : null, now);
    outline(ctx, width, height);
    return { canvas: bake(canvas), anchorX: ox, anchorY: oy };
  }

  const W = def.width;
  const L = def.length;
  const turn = (u, v) => {
    switch (item.rot) {
      case 2: return [v, u];
      case 4: return [W - u, L - v];
      case 6: return [L - v, W - u];
      default: return [u, v];
    }
  };
  const P = (u, v, z) => ({ x: ox + (u - v) * HALF_W, y: oy + (u + v) * HALF_H - z });
  const rotated = (opts) => {
    const [a0, c0] = turn(opts.u0, opts.v0);
    const [a1, c1] = turn(opts.u1, opts.v1);
    return { ...opts, u0: Math.min(a0, a1), u1: Math.max(a0, a1), v0: Math.min(c0, c1), v1: Math.max(c0, c1) };
  };
  // Le parti si mettono in coda: quelle "davanti" vanno disegnate per ultime, e quando il
  // mobile e' girato di spalle non si disegnano affatto (finirebbero sopra al corpo).
  const fromBack = item.rot === 4 || item.rot === 6;
  const body = [];
  const fronts = [];
  let queue = body;
  const b = (opts) => queue.push(() => box(ctx, P, rotated(opts)));
  const c = (opts) => {
    const [u, v] = turn(opts.u, opts.v);
    queue.push(() => cylinder(ctx, P, { ...opts, u, v }));
  };
  const leaves = (opts) => {
    const [u, v] = turn(opts.u, opts.v);
    queue.push(() => foliage(ctx, P, { ...opts, u, v }));
  };
  const palm = (opts) => {
    const [u, v] = turn(opts.u, opts.v);
    queue.push(() => fronds(ctx, P, { ...opts, u, v }));
  };
  const d = (u, v, z, color, w = 1, h = 1) => {
    const [ru, rv] = turn(u, v);
    queue.push(() => {
      const p = P(ru, rv, z);
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), w, h);
    });
  };
  const front = (fn) => {
    queue = fronts;
    fn();
    queue = body;
  };
  const draw = DRAW[item.type];
  if (draw) draw(b, { c, d, leaves, palm, front, now, item });
  else b({ u0: 0.2, v0: 0.2, u1: 0.8, v1: 0.8, z1: 28, color: '#6b7280' });
  body.forEach((op) => op());
  if (!fromBack) fronts.forEach((op) => op());

  // Vetrina: la carta sta in piedi sul piedistallo, rivolta verso chi guarda.
  if (item.type === 'card_pedestal' && item.card) {
    const img = cardImage(item.card, onImageLoad);
    const color = getRarityColor(item.card.rarity);
    const p = P(0.5, 0.5, 36);
    const cx = Math.round(p.x) - 10;
    const cy = Math.round(p.y) - 30;
    ctx.fillStyle = color;
    ctx.fillRect(cx - 2, cy - 2, 24, 32);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - 1, cy - 1, 1, 30);
    if (img) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, cx, cy, 20, 28);
      ctx.imageSmoothingEnabled = false;
    }
  }

  // L'acqua della piscina non ha contorno: le caselle vicine si fondono in una vasca unica.
  if (item.type !== 'pool_water') outline(ctx, width, height);
  return { canvas: bake(canvas), anchorX: ox, anchorY: oy };
}

/**
 * Animazioni dei mobili: ogni quanti ms cambia il disegno e dopo quanti passi si ripete.
 * Il motore mette in cache uno sprite per passo, non per istante: dopo il primo giro le luci
 * del jukebox o della pista non si ridisegnano piu', si pescano dalla cache.
 */
const ANIMATIONS = {
  jukebox: { period: 300, steps: 5 },
  dj_booth: { period: 250, steps: 2 },
  arcade: { period: 400, steps: 2 },
  neon_sign: { period: 1800, steps: 7 },
  pool_water: { period: 600, steps: 4 },
  aquarium: { period: 300, steps: 6 },
  fireplace: { period: 150, steps: 4 },
  fountain: { period: 250, steps: 4 }
};
const DANCE_COLORS = 6;

/**
 * Stato visivo del mobile in questo istante: la chiave per la cache e il `now` da passare a
 * furniSprite per ottenere proprio quel disegno. Due piastrelle dello stesso colore
 * condividono lo sprite.
 */
export function animationState(item, now, { playing = false, still = false } = {}) {
  if (item.type === 'dance_tile') {
    if (!playing) return { key: 'off', now: 0, colorIndex: -1 };
    const step = still ? 0 : Math.floor(now / 400);
    const colorIndex = (item.x * 3 + item.y * 5 + step) % DANCE_COLORS;
    return { key: `c${colorIndex}`, now: 0, colorIndex };
  }
  const anim = ANIMATIONS[item.type];
  if (!anim || still) return { key: '0', now: 0 };
  const step = Math.floor(now / anim.period) % anim.steps;
  return { key: String(step), now: step * anim.period };
}
