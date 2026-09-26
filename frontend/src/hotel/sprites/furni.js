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
/** Onde del mare e della battigia: passi dell'animazione e ms per passo. */
const SEA_STEPS = 8;
const SEA_PERIOD = 260;
/** Film sullo schermo del cinema: sei fotogrammi, due scene che si alternano. */
const SCREEN_STEPS = 6;
const SCREEN_PERIOD = 600;

function lerpColor(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const k = Math.max(0, Math.min(1, t));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * k)).join(',')})`;
}

/**
 * Un pixel del film: x lungo lo schermo, z in altezza. Scena 0 un tramonto con il sole che
 * scende dietro le montagne, scena 1 un vinile che gira sotto la luce.
 */
function filmPixel(x, z, step, scene) {
  const h = (z - 28) / 102;
  if (scene === 0) {
    const ridge = 0.24 + Math.sin(x * 0.07) * 0.08 + Math.sin(x * 0.23 + 1) * 0.04;
    if (h < ridge) return h < ridge - 0.03 ? '#241336' : '#3b1f52';
    const sunX = 60 + step * 12;
    const sunH = 0.62 - step * 0.05;
    if ((x - sunX) ** 2 + ((h - sunH) * 102) ** 2 < 150) return '#fde68a';
    return lerpColor('#f97316', '#4c1d95', (h - 0.2) / 0.8);
  }
  const dx = x - 96;
  const dz = (h - 0.5) * 102;
  const radius = Math.hypot(dx, dz);
  if (radius > 44) return (x + z) % 7 === 0 ? '#1b1330' : '#0b0716';
  if (radius < 2) return '#0b0716';
  if (radius < 11) return radius < 9 ? '#ec4899' : '#f9a8d4';
  const angle = Math.atan2(dz, dx);
  const spin = ((step * 1.05) % (Math.PI * 2)) - Math.PI;
  const diff = Math.abs(((angle - spin + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
  if (diff < 0.22) return '#5b5378';
  return Math.floor(radius) % 3 === 0 ? '#211c33' : '#111018';
}

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
  pizza_oven(b, { c, d, now, front }) {
    // Forno a legna a cupola: base in mattoni, bocca con il fuoco che si muove.
    b({ u0: 0.04, v0: 0.12, u1: 1.96, v1: 0.88, z1: 34, color: '#9a4a32', tex: 'stone' });
    b({ u0: 0.02, v0: 0.1, u1: 1.98, v1: 0.9, z0: 34, z1: 38, color: '#c9b79c', tex: 'stone' });
    c({ u: 1, v: 0.5, r: 0.66, z0: 38, z1: 58, color: '#b8a38a', top: '#cdbba4', tex: 'stone' });
    c({ u: 1, v: 0.5, r: 0.44, z0: 58, z1: 68, color: '#b8a38a', top: '#cdbba4', tex: 'stone' });
    c({ u: 1.3, v: 0.3, r: 0.1, z0: 66, z1: 96, color: '#7a6c60', tex: 'stone' });
    front(() => {
      const step = Math.floor((now || 0) / 150) % 4;
      d(0.78, 0.9, 56, '#1a1210', 28, 16);
      const flames = ['#f97316', '#fbbf24', '#ef4444', '#fde68a'];
      for (let i = 0; i < 5; i += 1) {
        const h = 6 + ((i * 5 + step * 3) % 8);
        d(0.82 + i * 0.1, 0.9, 42 + h, flames[(i + step) % 4], 3, h);
      }
      d(0.2, 0.9, 30, '#6b3e1f', 8, 18);
      d(0.24, 0.9, 30, '#8a5a3b', 4, 18);
    });
  },
  pool_table(b, { c }) {
    [[0.12, 0.2], [0.12, 0.74], [1.82, 0.2], [1.82, 0.74]].forEach(([u, v]) => b({ u0: u, v0: v, u1: u + 0.08, v1: v + 0.08, z1: 26, color: '#4a2511' }));
    b({ u0: 0.06, v0: 0.14, u1: 1.94, v1: 0.86, z0: 26, z1: 34, color: '#6b3e1f', tex: 'wood' });
    b({ u0: 0.14, v0: 0.22, u1: 1.86, v1: 0.78, z0: 34, z1: 35, color: '#15803d', tex: 'fabric' });
    [[0.14, 0.22], [1.0, 0.22], [1.86, 0.22], [0.14, 0.78], [1.0, 0.78], [1.86, 0.78]].forEach(([u, v]) => c({ u, v, r: 0.04, z0: 35, z1: 35, color: '#111018', top: '#111018' }));
    [[0.5, 0.5, '#f5f5f5'], [1.3, 0.4, '#ef4444'], [1.4, 0.55, '#fbbf24'], [1.5, 0.45, '#3b82f6'], [1.4, 0.34, '#111018']].forEach(([u, v, color]) => c({ u, v, r: 0.035, z0: 35, z1: 38, color, top: color }));
    b({ u0: 0.3, v0: 0.62, u1: 1.2, v1: 0.66, z0: 38, z1: 39, color: '#d9b77c' });
  },
  claw_machine(b, { c, d, now, front }) {
    const step = Math.floor((now || 0) / 300) % 4;
    b({ u0: 0.14, v0: 0.18, u1: 0.86, v1: 0.82, z1: 36, color: '#ec4899' });
    b({ u0: 0.14, v0: 0.18, u1: 0.86, v1: 0.82, z0: 36, z1: 86, color: '#bae6fd', left: '#7dd3fc', right: '#38bdf8', top: '#e0f2fe' });
    b({ u0: 0.12, v0: 0.16, u1: 0.88, v1: 0.84, z0: 86, z1: 96, color: '#ec4899', glow: true });
    ['#fbbf24', '#8b5cf6', '#22c55e', '#f97316'].forEach((color, i) => c({ u: 0.3 + (i % 2) * 0.35, v: 0.35 + Math.floor(i / 2) * 0.3, r: 0.1, z0: 36, z1: 44, color }));
    b({ u0: 0.44, v0: 0.44, u1: 0.5, v1: 0.5, z0: 64 + step * 3, z1: 86, color: '#9ca3af' });
    front(() => {
      for (let i = 0; i < 5; i += 1) d(0.2 + i * 0.13, 0.82, 94, (i + step) % 2 ? '#fde68a' : '#ffffff', 2, 2);
      d(0.3, 0.82, 26, '#1f1f2e', 14, 8);
      d(0.36, 0.82, 22, '#ef4444', 4, 3);
    });
  },
  globe(b, { c }) {
    c({ u: 0.5, v: 0.5, r: 0.18, z0: 0, z1: 4, color: '#6b3e1f' });
    c({ u: 0.5, v: 0.5, r: 0.03, z0: 4, z1: 34, color: '#d4a017', tex: 'metal' });
    [[0.14, 34, 38], [0.24, 38, 44], [0.28, 44, 52], [0.24, 52, 58], [0.14, 58, 62]].forEach(([r, z0, z1], i) => {
      c({ u: 0.5, v: 0.5, r, z0, z1, color: i % 2 ? '#3b82f6' : '#22c55e' });
    });
    b({ u0: 0.18, v0: 0.46, u1: 0.22, v1: 0.54, z0: 34, z1: 62, color: '#d4a017' });
  },
  fire_pit(b, { c, d, now }) {
    const step = Math.floor((now || 0) / 150) % 4;
    c({ u: 0.5, v: 0.5, r: 0.36, z0: 0, z1: 12, color: '#57534e', top: '#1c1917', tex: 'stone' });
    const flames = ['#f97316', '#fbbf24', '#ef4444', '#fde68a'];
    for (let i = 0; i < 6; i += 1) {
      const h = 6 + ((i * 7 + step * 4) % 12);
      d(0.3 + (i % 3) * 0.14, 0.5 + Math.floor(i / 3) * 0.12 - 0.06, 12 + h, flames[(i + step) % 4], 3, h);
    }
    d(0.44, 0.5, 34 + step * 2, 'rgba(203, 213, 225, 0.5)', 3, 3);
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
  // ---------------------------------------------------------------- spiaggia

  sea_water(b, { d, now }) {
    // Mare aperto: niente contorno, creste di onda che corrono verso riva (verso u = 0). Le
    // creste distano una casella, cosi' continuano da un riquadro all'altro senza cuciture.
    const phase = ((now || 0) / SEA_PERIOD) % SEA_STEPS / SEA_STEPS;
    b({ u0: 0, v0: 0, u1: 2, v1: 2, z1: 0, color: '#1f7fb6' });
    for (let k = 0; k < 2; k += 1) {
      const crest = k + 1 - phase;
      for (let v = 0.02; v < 2; v += 0.035) {
        const u = crest + Math.sin(v * Math.PI * 2) * 0.06;
        if (u <= 0.02 || u >= 1.98) continue;
        d(u, v, 0, '#e6f7ff', 3, 1);
        d(u + 0.06, v, 0, '#7cc8ec', 3, 1);
        d(u - 0.1, v, 0, '#1a6d9e', 2, 1);
      }
    }
    [[0.4, 0.5], [1.3, 1.6], [0.8, 1.2], [1.7, 0.3]].forEach(([u, v], i) => {
      d(u - phase * 0.3, v, 0, i % 2 ? '#bfe9ff' : '#ffffff', 4, 1);
    });
  },
  sea_foam(b, { d, now }) {
    // Battigia: sabbia bagnata e l'acqua che sale e scende, con la schiuma sul bordo.
    const phase = ((now || 0) / SEA_PERIOD) % SEA_STEPS / SEA_STEPS;
    const reach = 0.25 + (Math.sin(phase * Math.PI * 2) + 1) * 0.28;
    b({ u0: 0, v0: 0, u1: 1, v1: 1, z1: 0, color: '#c9a86a' });
    for (let v = 0.02; v < 1; v += 0.035) {
      const edge = 1 - reach + Math.sin(v * Math.PI * 4 + phase * 6) * 0.05;
      for (let u = Math.max(0.02, edge); u < 0.99; u += 0.06) d(u, v, 0, u - edge < 0.12 ? '#9fd6ee' : '#56aedb', 2, 1);
      if (edge > 0.02 && edge < 0.98) d(edge - 0.03, v, 0, '#ffffff', 3, 1);
    }
  },
  beach_towel(b, { d }) {
    b({ u0: 0.12, v0: 0.06, u1: 0.88, v1: 1.94, z1: 1, color: '#f43f5e' });
    for (let i = 0; i < 6; i += 1) b({ u0: 0.12, v0: 0.2 + i * 0.3, u1: 0.88, v1: 0.32 + i * 0.3, z0: 1, z1: 1, color: '#fef3c7' });
    b({ u0: 0.3, v0: 0.1, u1: 0.7, v1: 0.34, z0: 1, z1: 5, color: '#fef3c7', tex: 'fabric' });
    d(0.5, 1.3, 1, '#fbbf24', 4, 2);
  },
  sand_castle(b, { c, d }) {
    b({ u0: 0.14, v0: 0.14, u1: 0.86, v1: 0.86, z1: 16, color: '#e2c07f', tex: 'stone' });
    [[0.24, 0.24], [0.76, 0.24], [0.24, 0.76], [0.76, 0.76]].forEach(([u, v]) => c({ u, v, r: 0.1, z0: 16, z1: 30, color: '#d9b36c', tex: 'stone' }));
    c({ u: 0.5, v: 0.5, r: 0.16, z0: 16, z1: 42, color: '#e8c98c', tex: 'stone' });
    b({ u0: 0.49, v0: 0.49, u1: 0.51, v1: 0.51, z0: 42, z1: 56, color: '#6b4a2a' });
    d(0.52, 0.5, 56, '#ef4444', 6, 4);
  },
  beach_bar(b, { c, d, front }) {
    // Chiosco con il bancone in legno chiaro e il tetto di paglia su quattro pali.
    b({ u0: 0.04, v0: 0.3, u1: 1.96, v1: 0.9, z1: 40, color: '#c08a4e', tex: 'wood' });
    b({ u0: 0, v0: 0.26, u1: 2, v1: 0.94, z0: 40, z1: 44, color: '#8a5a3b', tex: 'wood' });
    [[0.06, 0.06], [1.86, 0.06]].forEach(([u, v]) => b({ u0: u, v0: v, u1: u + 0.08, v1: v + 0.08, z1: 104, color: '#6b4a2a', tex: 'wood' }));
    ['#f97316', '#22d3ee', '#fbbf24'].forEach((col, i) => c({ u: 0.5 + i * 0.5, v: 0.6, r: 0.06, z0: 44, z1: 56, color: '#e0f2fe', top: col }));
    b({ u0: -0.08, v0: -0.08, u1: 2.08, v1: 0.9, z0: 104, z1: 112, color: '#d9b36c', left: '#c9a35c', right: '#a8843f', tex: 'fabric' });
    b({ u0: 0.2, v0: 0.1, u1: 1.8, v1: 0.6, z0: 112, z1: 122, color: '#e2c07f', tex: 'fabric' });
    front(() => {
      for (let i = 0; i < 20; i += 1) d(-0.06 + i * 0.11, 0.9, 104 - (i % 3), '#b8913f', 2, 6 + (i % 3) * 2);
      for (let i = 0; i < 5; i += 1) d(0.14 + i * 0.36, 0.9, 30, '#8a5a3b', 6, 22);
      d(0.7, 0.94, 38, '#22d3ee', 22, 3);
    });
  },
  palm_tree(b, { c, palm }) {
    c({ u: 0.5, v: 0.5, r: 0.22, z0: 0, z1: 3, color: '#d9b36c' });
    for (let z = 0; z < 118; z += 7) {
      const lean = z / 118;
      c({ u: 0.5 + lean * 0.18, v: 0.5 - lean * 0.18, r: 0.07 - lean * 0.015, z0: z, z1: z + 6, color: '#8a6433', top: '#a07a45', tex: 'wood' });
    }
    palm({ u: 0.68, v: 0.32, z: 122, length: 44, color: '#1f9d55', seed: 7 });
    c({ u: 0.66, v: 0.34, r: 0.05, z0: 110, z1: 116, color: '#6b4a2a' });
  },
  volley_net(b, { d }) {
    [[0.1, 0.46], [2.84, 0.46]].forEach(([u, v]) => b({ u0: u, v0: v, u1: u + 0.06, v1: v + 0.08, z1: 76, color: '#e5e7eb', tex: 'metal' }));
    b({ u0: 0.12, v0: 0.48, u1: 2.88, v1: 0.52, z0: 72, z1: 76, color: '#f5f5f5' });
    for (let u = 0.2; u < 2.85; u += 0.1) {
      for (let z = 46; z < 72; z += 4) d(u, 0.5, z, 'rgba(245, 245, 245, 0.75)', 1, 1);
    }
    for (let z = 46; z <= 70; z += 6) {
      for (let u = 0.16; u < 2.86; u += 0.035) d(u, 0.5, z, 'rgba(245, 245, 245, 0.75)', 1, 1);
    }
  },

  // ---------------------------------------------------------------- edicola

  newsstand(b, { d, front }) {
    // Chiosco dell'edicola: bancone verde, riviste in esposizione, pile di giornali e la tenda.
    b({ u0: 0.02, v0: 0.3, u1: 2.98, v1: 0.9, z1: 40, color: '#166534', left: '#15803d', right: '#0f4d27' });
    b({ u0: 0, v0: 0.26, u1: 3, v1: 0.94, z0: 40, z1: 44, color: '#d4d4d8', tex: 'metal' });
    [[0.3, '#f5f5f5'], [1.1, '#fef3c7'], [2.0, '#f5f5f5']].forEach(([u, col]) => {
      b({ u0: u, v0: 0.4, u1: u + 0.5, v1: 0.8, z0: 44, z1: 52, color: col });
      d(u + 0.05, 0.8, 50, '#1f2937', 10, 1);
    });
    [[0.06, 0.06], [2.86, 0.06]].forEach(([u, v]) => b({ u0: u, v0: v, u1: u + 0.08, v1: v + 0.08, z1: 110, color: '#14532d' }));
    for (let i = 0; i < 12; i += 1) {
      b({ u0: i * 0.25, v0: -0.04, u1: (i + 1) * 0.25, v1: 0.5, z0: 108, z1: 114, color: i % 2 ? '#f5f5f5' : '#16a34a' });
    }
    front(() => {
      const covers = ['#ef4444', '#3b82f6', '#fbbf24', '#8b5cf6', '#ec4899', '#22c55e', '#f97316', '#14b8a6'];
      for (let i = 0; i < 8; i += 1) {
        d(0.1 + i * 0.36, 0.9, 36, covers[i], 9, 12);
        d(0.14 + i * 0.36, 0.9, 32, '#ffffff', 5, 2);
      }
      for (let i = 0; i < 8; i += 1) d(0.14 + i * 0.36, 0.9, 18, covers[(i + 3) % 8], 8, 10);
      d(0.9, 0.5, 106, '#fbbf24', 40, 5);
    });
  },
  pack_display(b, { d, front }) {
    // Espositore girevole dei pacchetti VinylDex: base, fusto e tre ripiani con le bustine.
    b({ u0: 0.2, v0: 0.2, u1: 0.8, v1: 0.8, z1: 6, color: '#27272a' });
    b({ u0: 0.44, v0: 0.44, u1: 0.56, v1: 0.56, z0: 6, z1: 96, color: '#a1a1aa', tex: 'metal' });
    const packs = [['#8b5cf6', '#ec4899'], ['#3b82f6', '#22d3ee'], ['#f59e0b', '#fde68a']];
    [30, 56, 82].forEach((z, i) => {
      b({ u0: 0.16, v0: 0.16, u1: 0.84, v1: 0.84, z0: z - 2, z1: z, color: '#52525b' });
      const [a, c2] = packs[i];
      b({ u0: 0.2, v0: 0.3, u1: 0.4, v1: 0.7, z0: z, z1: z + 18, color: a, top: c2 });
      b({ u0: 0.6, v0: 0.3, u1: 0.8, v1: 0.7, z0: z, z1: z + 18, color: a, top: c2 });
    });
    front(() => {
      [30, 56, 82].forEach((z, i) => {
        d(0.26, 0.7, z + 14, packs[i][1], 4, 2);
        d(0.66, 0.7, z + 14, packs[i][1], 4, 2);
      });
      d(0.34, 0.84, 104, '#fbbf24', 12, 6);
      d(0.38, 0.84, 102, '#1a1030', 6, 1);
    });
  },
  magazine_rack(b, { d, front }) {
    b({ u0: 0.14, v0: 0.3, u1: 0.86, v1: 0.8, z1: 72, color: '#3f3f46', tex: 'metal' });
    front(() => {
      const covers = ['#ef4444', '#3b82f6', '#fbbf24', '#8b5cf6', '#22c55e', '#ec4899'];
      [8, 30, 52].forEach((z, row) => {
        for (let i = 0; i < 2; i += 1) {
          d(0.2 + i * 0.34, 0.8, z + 18, covers[(row * 2 + i) % covers.length], 9, 16);
          d(0.24 + i * 0.34, 0.8, z + 14, '#ffffff', 5, 2);
          d(0.24 + i * 0.34, 0.8, z + 8, '#1f2937', 6, 1);
        }
      });
    });
  },
  street_lamp(b, { c }) {
    c({ u: 0.5, v: 0.5, r: 0.14, z0: 0, z1: 10, color: '#1f2937' });
    c({ u: 0.5, v: 0.5, r: 0.04, z0: 10, z1: 124, color: '#374151', tex: 'metal' });
    c({ u: 0.5, v: 0.5, r: 0.16, z0: 124, z1: 142, color: '#fde68a', top: '#1f2937' });
    c({ u: 0.5, v: 0.5, r: 0.2, z0: 142, z1: 146, color: '#1f2937' });
  },

  // ---------------------------------------------------------------- cinema

  cinema_screen(b, { d, now, front }) {
    // Schermo grande su due gambe, con la cornice nera e un film che scorre.
    [[0.3, 0.4], [5.6, 0.4]].forEach(([u, v]) => b({ u0: u, v0: v, u1: u + 0.1, v1: v + 0.1, z1: 20, color: '#111018' }));
    b({ u0: 0, v0: 0.36, u1: 6, v1: 0.56, z0: 20, z1: 136, color: '#111018' });
    front(() => {
      const step = Math.floor((now || 0) / SCREEN_PERIOD) % SCREEN_STEPS;
      const scene = Math.floor(step / 3) % 2;
      const cols = 6 * 32;
      for (let i = 4; i < cols - 4; i += 1) {
        const u = i / 32;
        for (let z = 28; z < 130; z += 2) {
          d(u, 0.56, z, filmPixel(i, z, step, scene), 1, 2);
        }
      }
    });
  },
  cinema_seat(b) {
    // Poltroncina rossa con lo schienale verso chi guarda: si guarda lo schermo (verso -v).
    [[0.14, 0.2], [0.8, 0.2]].forEach(([u, v]) => b({ u0: u, v0: v, u1: u + 0.06, v1: v + 0.6, z1: 34, color: '#27272a' }));
    b({ u0: 0.2, v0: 0.16, u1: 0.8, v1: 0.76, z0: 14, z1: 22, color: '#b91c1c', tex: 'fabric' });
    b({ u0: 0.18, v0: 0.72, u1: 0.82, v1: 0.88, z0: 14, z1: 56, color: '#991b1b', tex: 'fabric' });
    b({ u0: 0.18, v0: 0.72, u1: 0.82, v1: 0.88, z0: 56, z1: 58, color: '#fbbf24' });
  },
  popcorn_machine(b, { d, front }) {
    b({ u0: 0.14, v0: 0.2, u1: 0.86, v1: 0.8, z1: 36, color: '#b91c1c', tex: 'metal' });
    b({ u0: 0.16, v0: 0.22, u1: 0.84, v1: 0.78, z0: 36, z1: 84, color: '#fee2e2', left: '#fecaca', right: '#fca5a5', top: '#fef2f2' });
    b({ u0: 0.14, v0: 0.2, u1: 0.86, v1: 0.8, z0: 84, z1: 96, color: '#dc2626', glow: true });
    b({ u0: 0.18, v0: 0.24, u1: 0.82, v1: 0.76, z0: 36, z1: 52, color: '#fde68a', top: '#fef3c7' });
    front(() => {
      for (let i = 0; i < 14; i += 1) d(0.2 + (i % 7) * 0.09, 0.78, 58 + Math.floor(i / 7) * 6 + (i % 3), '#fffbeb', 2, 2);
      d(0.3, 0.8, 94, '#fbbf24', 14, 5);
      d(0.26, 0.8, 26, '#fbbf24', 18, 3);
    });
  },

  // ---------------------------------------------------------------- palestra

  treadmill(b, { d, now, front }) {
    const step = Math.floor((now || 0) / 200) % 4;
    b({ u0: 0.14, v0: 0.1, u1: 0.86, v1: 1.9, z1: 10, color: '#27272a' });
    b({ u0: 0.2, v0: 0.2, u1: 0.8, v1: 1.8, z0: 10, z1: 12, color: '#3f3f46' });
    for (let v = 0.24 + step * 0.05; v < 1.78; v += 0.2) b({ u0: 0.22, v0: v, u1: 0.78, v1: v + 0.03, z0: 12, z1: 12, color: '#52525b' });
    [[0.14, 0.1], [0.8, 0.1]].forEach(([u, v]) => b({ u0: u, v0: v, u1: u + 0.06, v1: v + 0.08, z0: 10, z1: 64, color: '#a1a1aa', tex: 'metal' }));
    b({ u0: 0.14, v0: 0.06, u1: 0.86, v1: 0.24, z0: 62, z1: 72, color: '#18181b' });
    front(() => {
      d(0.34, 0.24, 72, step % 2 ? '#22d3ee' : '#22c55e', 10, 3);
      d(0.3, 0.24, 66, '#ef4444', 2, 2);
    });
  },
  weight_bench(b, { c }) {
    [[0.2, 0.3], [0.2, 0.66], [1.74, 0.3], [1.74, 0.66]].forEach(([u, v]) => b({ u0: u, v0: v, u1: u + 0.06, v1: v + 0.06, z1: 18, color: '#27272a' }));
    b({ u0: 0.12, v0: 0.3, u1: 1.88, v1: 0.72, z0: 18, z1: 24, color: '#1f2937', tex: 'fabric' });
    [[0.2, 0.18], [0.2, 0.84]].forEach(([u, v]) => b({ u0: u, v0: v, u1: u + 0.06, v1: v + 0.06, z1: 50, color: '#a1a1aa', tex: 'metal' }));
    b({ u0: 0.22, v0: -0.1, u1: 0.26, v1: 1.1, z0: 50, z1: 52, color: '#d4d4d8', tex: 'metal' });
    [-0.06, 1.04].forEach((v) => c({ u: 0.24, v, r: 0.12, z0: 44, z1: 58, color: '#111018' }));
  },
  punching_bag(b, { c }) {
    c({ u: 0.5, v: 0.5, r: 0.2, z0: 0, z1: 4, color: '#27272a' });
    c({ u: 0.5, v: 0.5, r: 0.03, z0: 4, z1: 128, color: '#6b7280', tex: 'metal' });
    b({ u0: 0.48, v0: 0.2, u1: 0.52, v1: 0.52, z0: 124, z1: 128, color: '#6b7280' });
    c({ u: 0.5, v: 0.2, r: 0.01, z0: 104, z1: 124, color: '#9ca3af' });
    c({ u: 0.5, v: 0.2, r: 0.18, z0: 40, z1: 104, color: '#b91c1c', top: '#7f1d1d', tex: 'fabric' });
    c({ u: 0.5, v: 0.2, r: 0.185, z0: 70, z1: 74, color: '#111018' });
  },
  yoga_mat(b) {
    b({ u0: 0.16, v0: 0.06, u1: 0.84, v1: 1.94, z1: 1, color: '#14b8a6' });
    b({ u0: 0.16, v0: 0.06, u1: 0.84, v1: 0.22, z0: 1, z1: 7, color: '#0d9488', tex: 'fabric' });
  },
  dumbbell_rack(b, { c }) {
    b({ u0: 0.08, v0: 0.3, u1: 1.92, v1: 0.74, z1: 22, color: '#27272a', tex: 'metal' });
    b({ u0: 0.08, v0: 0.2, u1: 1.92, v1: 0.3, z0: 16, z1: 44, color: '#3f3f46', tex: 'metal' });
    ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6'].forEach((color, i) => {
      const u = 0.2 + i * 0.36;
      c({ u, v: 0.4, r: 0.07, z0: 22, z1: 30, color });
      c({ u, v: 0.64, r: 0.07, z0: 22, z1: 30, color });
      b({ u0: u - 0.02, v0: 0.4, u1: u + 0.02, v1: 0.64, z0: 25, z1: 27, color: '#9ca3af' });
    });
  },
  water_cooler(b, { c, d, front }) {
    b({ u0: 0.2, v0: 0.2, u1: 0.8, v1: 0.8, z1: 54, color: '#f5f5f5', left: '#e5e7eb', right: '#cbd5e1' });
    c({ u: 0.5, v: 0.5, r: 0.24, z0: 54, z1: 92, color: '#7dd3fc', top: '#bae6fd' });
    c({ u: 0.5, v: 0.5, r: 0.08, z0: 92, z1: 96, color: '#2563eb' });
    front(() => {
      d(0.3, 0.8, 40, '#2563eb', 4, 4);
      d(0.56, 0.8, 40, '#ef4444', 4, 4);
      d(0.34, 0.8, 30, '#1f2937', 14, 3);
    });
  },

  // ---------------------------------------------------------------- decorazioni della stagione

  decor_leaves(b, { d }) {
    const colors = ['#b45309', '#d97706', '#dc2626', '#a16207', '#65a30d'];
    for (let i = 0; i < 9; i += 1) d(0.1 + hash(i, 3) * 0.8, 0.1 + hash(i, 5) * 0.8, 0, colors[i % colors.length], 3, 2);
  },
  decor_petals(b, { d }) {
    const colors = ['#f9a8d4', '#fbcfe8', '#fde68a', '#ffffff', '#c4b5fd'];
    for (let i = 0; i < 10; i += 1) d(0.1 + hash(i, 7) * 0.8, 0.1 + hash(i, 9) * 0.8, 0, colors[i % colors.length], 2, 1);
  },
  decor_snow(b, { d }) {
    for (let i = 0; i < 26; i += 1) d(0.05 + hash(i, 11) * 0.9, 0.05 + hash(i, 13) * 0.9, 0, i % 3 ? '#f8fafc' : '#e2e8f0', 5, 2);
  },
  decor_pumpkin(b, { c, d, front }) {
    c({ u: 0.5, v: 0.5, r: 0.26, z0: 0, z1: 24, color: '#ea580c', top: '#f97316' });
    c({ u: 0.5, v: 0.5, r: 0.04, z0: 24, z1: 30, color: '#3f6212' });
    front(() => {
      d(0.52, 0.76, 17, '#fde047', 3, 3);
      d(0.74, 0.76, 17, '#fde047', 3, 3);
      d(0.56, 0.78, 9, '#fde047', 8, 2);
    });
  },
  decor_tree(b, { c, d }) {
    c({ u: 0.5, v: 0.5, r: 0.14, z0: 0, z1: 10, color: '#7f1d1d' });
    [[10, 0.42], [34, 0.34], [56, 0.26], [76, 0.17]].forEach(([z, r]) => c({ u: 0.5, v: 0.5, r, z0: z, z1: z + 26, color: '#166534', top: '#15803d' }));
    const lights = ['#facc15', '#ef4444', '#3b82f6', '#f472b6'];
    for (let i = 0; i < 14; i += 1) d(0.2 + hash(i, 21) * 0.6, 0.72, 18 + hash(i, 23) * 70, lights[i % lights.length], 2, 2);
    d(0.5, 0.5, 106, '#fde047', 5, 5);
  },
  decor_gifts(b) {
    b({ u0: 0.15, v0: 0.2, u1: 0.55, v1: 0.6, z1: 18, color: '#dc2626' });
    b({ u0: 0.31, v0: 0.2, u1: 0.39, v1: 0.6, z0: 18, z1: 19, color: '#facc15' });
    b({ u0: 0.5, v0: 0.5, u1: 0.85, v1: 0.85, z1: 12, color: '#2563eb' });
    b({ u0: 0.5, v0: 0.64, u1: 0.85, v1: 0.71, z0: 12, z1: 13, color: '#f8fafc' });
  },
  decor_snowman(b, { c, d, front }) {
    c({ u: 0.5, v: 0.5, r: 0.3, z0: 0, z1: 28, color: '#f8fafc', top: '#ffffff' });
    c({ u: 0.5, v: 0.5, r: 0.22, z0: 28, z1: 48, color: '#f8fafc', top: '#ffffff' });
    c({ u: 0.5, v: 0.5, r: 0.16, z0: 48, z1: 62, color: '#f8fafc', top: '#ffffff' });
    c({ u: 0.5, v: 0.5, r: 0.13, z0: 62, z1: 74, color: '#111827' });
    front(() => {
      d(0.62, 0.66, 56, '#111827', 2, 2);
      d(0.74, 0.66, 56, '#111827', 2, 2);
      d(0.68, 0.7, 52, '#f97316', 5, 2);
      d(0.56, 0.7, 46, '#dc2626', 14, 3);
    });
  },

  // ---------------------------------------------------------------- stadio

  football_goal(b, { d }) {
    // Porta: pali e traversa bianchi a meta' casella, rete a maglie che chiude la gabbia.
    const net = 'rgba(241, 245, 249, 0.22)';
    b({ u0: 0.1, v0: 0.06, u1: 0.9, v1: 2.94, z1: 58, color: net, left: net, right: 'rgba(203, 213, 225, 0.28)', top: 'rgba(241, 245, 249, 0.16)' });
    for (let v = 0.12; v < 2.92; v += 0.16) {
      for (let z = 4; z < 58; z += 6) d(0.9, v, z, 'rgba(255, 255, 255, 0.7)', 1, 1);
    }
    for (let u = 0.14; u < 0.9; u += 0.12) {
      for (let v = 0.12; v < 2.92; v += 0.16) d(u, v, 58, 'rgba(255, 255, 255, 0.6)', 1, 1);
    }
    [[0.44, 0.04], [0.44, 2.86]].forEach(([u, v]) => b({ u0: u, v0: v, u1: u + 0.12, v1: v + 0.1, z1: 64, color: '#f8fafc', tex: 'metal' }));
    b({ u0: 0.44, v0: 0.04, u1: 0.56, v1: 2.96, z0: 58, z1: 64, color: '#f8fafc', tex: 'metal' });
  },
  corner_flag(b, { c, d }) {
    c({ u: 0.5, v: 0.5, r: 0.03, z0: 0, z1: 74, color: '#f8fafc' });
    for (let i = 0; i < 12; i += 1) d(0.52, 0.5, 72 - i, i % 4 < 2 ? '#facc15' : '#ef4444', 12 - i, 1);
  },
  floodlight(b, { c, d, front }) {
    // Torre faro: traliccio grigio e un pannello di fari accesi in cima.
    c({ u: 0.5, v: 0.5, r: 0.22, z0: 0, z1: 6, color: '#374151' });
    c({ u: 0.5, v: 0.5, r: 0.07, z0: 6, z1: 124, color: '#9ca3af', tex: 'metal' });
    b({ u0: 0.12, v0: 0.4, u1: 0.88, v1: 0.6, z0: 118, z1: 146, color: '#4b5563', tex: 'metal' });
    front(() => {
      for (let row = 0; row < 3; row += 1) {
        for (let i = 0; i < 4; i += 1) d(0.16 + i * 0.18, 0.6, 142 - row * 8, '#fef9c3', 7, 5);
      }
    });
  },

  basket_hoop(b, { c, d, front }) {
    // Canestro: base zavorrata, palo, tabellone bianco con il quadrato rosso e il ferro arancione.
    b({ u0: 0.2, v0: 0.1, u1: 0.8, v1: 0.5, z1: 12, color: '#1f2937' });
    c({ u: 0.5, v: 0.3, r: 0.06, z0: 12, z1: 118, color: '#6b7280', tex: 'metal' });
    b({ u0: 0.1, v0: 0.36, u1: 0.9, v1: 0.44, z0: 96, z1: 140, color: '#f8fafc', right: '#cbd5e1' });
    front(() => {
      d(0.36, 0.44, 124, '#dc2626', 14, 2);
      d(0.36, 0.44, 112, '#dc2626', 2, 12);
      d(0.6, 0.44, 112, '#dc2626', 2, 12);
      c({ u: 0.5, v: 0.62, r: 0.16, z0: 100, z1: 102, color: '#f97316', open: true });
      for (let i = 0; i < 5; i += 1) d(0.38 + i * 0.06, 0.66, 99 - (i % 2) * 2, '#f1f5f9', 1, 12);
    });
  },

  // ---------------------------------------------------------------- bowling

  bowling_lane(b, { d }) {
    // Pista lunga otto caselle (lungo v): legno chiaro lucido, canaline scure ai lati, linea di
    // lancio, frecce e il fondo piu' chiaro dove stanno i birilli (li disegna il motore, cosi' cadono).
    b({ u0: 0, v0: 0, u1: 1, v1: 8, z1: 2, color: '#1f2937' });
    b({ u0: 0.02, v0: 0, u1: 0.12, v1: 8, z0: 2, z1: 2, color: '#4b5563' });
    b({ u0: 0.88, v0: 0, u1: 0.98, v1: 8, z0: 2, z1: 2, color: '#4b5563' });
    b({ u0: 0.14, v0: 0, u1: 0.86, v1: 8, z0: 2, z1: 4, color: '#f1d3a1', tex: 'wood' });
    for (let v = 0.3; v < 6.5; v += 0.4) d(0.5, v, 4, 'rgba(255, 255, 255, 0.35)', 1, 1);
    d(0.14, 0.35, 4, '#dc2626', 30, 1);
    [0.3, 0.4, 0.5, 0.6, 0.7].forEach((u) => d(u, 2.4 + Math.abs(u - 0.5) * 2, 4, '#1e3a8a', 3, 2));
    b({ u0: 0.14, v0: 6.6, u1: 0.86, v1: 7.95, z0: 4, z1: 4, color: '#fde7c3' });
    b({ u0: 0, v0: 7.95, u1: 1, v1: 8, z0: 0, z1: 6, color: '#111827' });
  },
  bowling_rack(b, { c }) {
    b({ u0: 0.15, v0: 0.2, u1: 0.85, v1: 0.8, z1: 36, color: '#3f3f46', tex: 'metal' });
    ['#dc2626', '#2563eb', '#16a34a', '#9333ea'].forEach((color, i) => {
      c({ u: 0.3 + (i % 2) * 0.4, v: 0.5, r: 0.14, z0: 36 + Math.floor(i / 2) * 14, z1: 48 + Math.floor(i / 2) * 14, color, top: shade(color, 0.3) });
    });
  },
  shoe_counter(b, { d, front }) {
    b({ u0: 0.04, v0: 0.3, u1: 1.96, v1: 0.9, z1: 40, color: '#7c3aed', left: '#6d28d9', right: '#4c1d95' });
    b({ u0: 0, v0: 0.26, u1: 2, v1: 0.94, z0: 40, z1: 44, color: '#18181b' });
    [[0.2, '#ef4444'], [0.9, '#3b82f6'], [1.5, '#f5f5f5']].forEach(([u, color]) => {
      b({ u0: u, v0: 0.45, u1: u + 0.3, v1: 0.75, z0: 44, z1: 50, color });
    });
    front(() => d(0.4, 0.9, 30, '#fbbf24', 28, 5));
  },

  // ---------------------------------------------------------------- minigolf

  ...Object.fromEntries([1, 2, 3, 4, 5, 6].map((n) => [`golf_hole_${n}`, (b, { c, d, now }) => golfHole(n, b, c, d, now)])),

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

/**
 * Buca del minigolf (3x2): prato sintetico con il bordo in legno, la buca con la bandierina e
 * l'ostacolo della buca: muretto, mulino a vento, respingenti, ponticello, giro della morte.
 */
function golfHole(n, b, c, d, now) {
  const flags = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];
  b({ u0: 0, v0: 0, u1: 3, v1: 2, z1: 5, color: '#8a5a3b', tex: 'wood' });
  b({ u0: 0.1, v0: 0.1, u1: 2.9, v1: 1.9, z0: 5, z1: 6, color: '#22c55e' });
  for (let i = 0; i < 18; i += 1) d(0.2 + hash(i, n) * 2.6, 0.2 + hash(n, i) * 1.6, 6, '#16a34a', 2, 1);
  // Partenza a sinistra, buca a destra.
  d(0.35, 1.0, 6, '#f8fafc', 3, 3);
  c({ u: 2.55, v: 1.0, r: 0.09, z0: 6, z1: 6, color: '#111827', top: '#111827' });
  c({ u: 2.55, v: 1.0, r: 0.012, z0: 6, z1: 58, color: '#e5e7eb' });
  for (let i = 0; i < 8; i += 1) d(2.57, 1.0, 57 - i, flags[n - 1], 10 - i, 1);
  if (n === 2) b({ u0: 1.4, v0: 0.1, u1: 1.6, v1: 1.3, z0: 6, z1: 16, color: '#8a5a3b', tex: 'wood' });
  if (n === 3) {
    // Mulino: torretta rossa e pale che girano.
    b({ u0: 1.25, v0: 0.7, u1: 1.75, v1: 1.3, z0: 6, z1: 50, color: '#dc2626', top: '#991b1b' });
    const angle = ((now || 0) / 500) % (Math.PI * 2);
    for (let k = 0; k < 4; k += 1) {
      const a = angle + (k * Math.PI) / 2;
      for (let r = 2; r < 22; r += 1) d(1.5 + Math.cos(a) * 0.012 * r, 1.3, 42 + Math.sin(a) * r, k % 2 ? '#f8fafc' : '#fde68a', 2, 2);
    }
  }
  if (n === 4) [[1.1, 0.6], [1.6, 1.3], [2.0, 0.7]].forEach(([u, v]) => c({ u, v, r: 0.13, z0: 6, z1: 16, color: '#f472b6', top: '#fbcfe8' }));
  if (n === 5) {
    // Ponticello: una gobba di legno a meta'.
    for (let i = 0; i < 6; i += 1) b({ u0: 1.1 + i * 0.13, v0: 0.7, u1: 1.23 + i * 0.13, v1: 1.3, z0: 6, z1: 6 + Math.round(Math.sin(((i + 0.5) / 6) * Math.PI) * 12), color: '#a16207', tex: 'wood' });
    b({ u0: 1.1, v0: 0.1, u1: 1.9, v1: 0.6, z0: 5, z1: 5, color: '#38bdf8' });
    b({ u0: 1.1, v0: 1.4, u1: 1.9, v1: 1.9, z0: 5, z1: 5, color: '#38bdf8' });
  }
  if (n === 6) {
    // Giro della morte: un anello in verticale sul percorso.
    for (let a = 0; a < Math.PI * 2; a += 0.12) d(1.5 + Math.cos(a) * 0.3, 1.0, 22 + Math.sin(a) * 16, '#3b82f6', 3, 3);
  }
}

/** Mobili senza contorno, che si fondono con i vicini dello stesso tipo. */
const SEAMLESS = new Set(['pool_water', 'sea_water', 'sea_foam', 'decor_leaves', 'decor_petals', 'decor_snow']);

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
  } else if (type === 'movie_poster') {
    // Locandina di un film: cornice dorata, titolo e un vinile che brilla.
    R(5, 28, 36, 100, '#b8872e');
    R(7, 26, 38, 98, (a, h) => lerpColor('#1e1b4b', '#be185d', (h - 38) / 60));
    R(10, 23, 84, 90, '#fde68a');
    R(12, 21, 52, 72, '#111018');
    R(15, 18, 60, 64, '#ec4899');
    R(10, 23, 42, 44, '#fde68a');
    R(10, 17, 46, 47, '#f5f5f5');
  } else if (type === 'scoreboard') {
    // Tabellone: pannello nero con le due squadre e i numeri a led (il punteggio vero sta in alto nella pagina).
    R(1, 32, 44, 100, '#111827');
    R(3, 30, 46, 98, '#030712');
    R(5, 14, 82, 94, '#2563eb');
    R(19, 28, 82, 94, '#dc2626');
    R(6, 13, 54, 76, (a, h) => ((a + h) % 3 === 0 ? '#facc15' : '#1f2937'));
    R(20, 27, 54, 76, (a, h) => ((a + h) % 3 === 0 ? '#facc15' : '#1f2937'));
    R(15, 18, 62, 68, '#facc15');
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
    // Le carte EA FC 27 le disegna gia' il backend: non passano dal proxy delle immagini esterne.
    const proxied = /^https?:\/\//.test(src) && !src.includes('/fc-card.svg');
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

  // L'acqua della piscina e il mare non hanno contorno: le caselle vicine si fondono insieme.
  if (!SEAMLESS.has(item.type)) outline(ctx, width, height);
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
  sea_water: { period: SEA_PERIOD, steps: SEA_STEPS },
  sea_foam: { period: SEA_PERIOD, steps: SEA_STEPS },
  cinema_screen: { period: SCREEN_PERIOD, steps: SCREEN_STEPS },
  treadmill: { period: 200, steps: 4 },
  aquarium: { period: 300, steps: 6 },
  fireplace: { period: 150, steps: 4 },
  fountain: { period: 250, steps: 4 },
  pizza_oven: { period: 150, steps: 4 },
  claw_machine: { period: 300, steps: 4 },
  fire_pit: { period: 150, steps: 4 },
  golf_hole_3: { period: 250, steps: 8 }
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
