import { HALF_H, HALF_W } from '../iso.js';
import { drawBuilding } from './cityBuildings.js';
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


// ---------------------------------------------------------------- quartiere: parti comuni

/** Mobili piu' alti del solito (palazzi del quartiere): spazio in piu' sopra lo sprite. */
const TALL = {
  building: 280,
  facade_atelier: 170, facade_watches: 170, facade_skate: 150, facade_bikes: 150, facade_cars: 160, facade_cafe: 160,
  arena_hockey: 200, arena_basket: 200, villa: 150, facade_rock: 170, facade_guitars: 160
};

/** Bancone di un negozio (2x1): mobile, piano e una fascia colorata davanti. */
function shopCounter(b, { body, top, accent }) {
  b({ u0: 0.05, v0: 0.2, u1: 1.95, v1: 0.9, z1: 30, color: body, tex: 'wood' });
  b({ u0: 0.02, v0: 0.16, u1: 1.98, v1: 0.94, z0: 30, z1: 33, color: top });
  b({ u0: 0.05, v0: 0.9, u1: 1.95, v1: 0.92, z0: 12, z1: 16, color: accent, left: accent, glow: true });
}

/**
 * Facciata di un negozio: muro, cornicione, insegna (il nome lo scrive il motore), vetrina con
 * la merce, porta e tenda a righe. Il davanti guarda verso +v, come tutti i mobili.
 */
function shopFront(b, d, front, o) {
  const { W, L, h } = o;
  const face = L - 0.3;
  b({ u0: 0.05, v0: 0.05, u1: W - 0.05, v1: face, z1: h, color: o.wall, tex: o.tex });
  b({ u0: 0, v0: 0, u1: W, v1: face + 0.06, z0: h, z1: h + 8, color: o.trim });
  front(() => {
    b({ u0: 0.3, v0: face, u1: W - 0.3, v1: face + 0.05, z0: h - 34, z1: h - 12, color: o.sign, left: o.sign });
    const doorU = W - 1.05;
    const winU1 = doorU - 0.15;
    b({ u0: 0.2, v0: face, u1: winU1 + 0.05, v1: face + 0.06, z0: 2, z1: 8, color: o.trim });
    b({ u0: 0.25, v0: face, u1: winU1, v1: face + 0.04, z0: 8, z1: h - 44, color: o.glass, left: o.glass });
    // Luce calda dentro la vetrina e la merce esposta.
    if (o.warm) for (let z = 14; z < h - 50; z += 10) d(0.35, face + 0.04, z, 'rgba(255, 214, 140, 0.25)', Math.round((winU1 - 0.45) * 32), 5);
    o.goods?.(0.45, 22);
    // Riflesso diagonale sul vetro.
    for (let i = 0; i < 12; i += 1) d(0.35 + i * 0.05, face + 0.04, h - 50 - i * 3, 'rgba(255, 255, 255, 0.35)', 2, 1);
    b({ u0: doorU, v0: face, u1: doorU + 0.6, v1: face + 0.05, z0: 0, z1: 54, color: o.door, left: o.door });
    b({ u0: doorU + 0.08, v0: face + 0.05, u1: doorU + 0.52, v1: face + 0.06, z0: 6, z1: 48, color: 'rgba(191, 227, 255, 0.35)', left: 'rgba(191, 227, 255, 0.35)' });
    d(doorU + 0.46, face + 0.06, 28, '#fbbf24', 2, 3);
    if (o.awning) {
      const n = Math.round((W - 0.4) / 0.25);
      for (let i = 0; i < n; i += 1) {
        b({ u0: 0.2 + i * 0.25, v0: face, u1: 0.2 + (i + 1) * 0.25, v1: face + 0.34, z0: h - 42, z1: h - 37, color: o.awning[i % 2] });
      }
    }
  });
}

/** Facciata di un'arena (7x3): muro, fascia di vetro, tetto a gradoni, insegna, ingressi, logo. */
function arenaFront(b, c, d, front, o) {
  const { W, L } = o;
  const face = L - 0.25;
  b({ u0: 0.05, v0: 0.05, u1: W - 0.05, v1: face, z1: 72, color: o.wall, tex: 'stone' });
  b({ u0: 0.3, v0: 0.2, u1: W - 0.3, v1: face - 0.15, z0: 72, z1: 120, color: o.glass, left: shade(o.glass, 0.12), right: shade(o.glass, -0.2) });
  b({ u0: 0.2, v0: 0.1, u1: W - 0.2, v1: face - 0.05, z0: 120, z1: 128, color: o.trim });
  b({ u0: 0.7, v0: 0.4, u1: W - 0.7, v1: face - 0.5, z0: 128, z1: 140, color: o.roof, tex: 'metal' });
  b({ u0: 1.4, v0: 0.8, u1: W - 1.4, v1: face - 0.9, z0: 140, z1: 150, color: shade(o.roof, 0.12), tex: 'metal' });
  // Bandiere sul tetto.
  [1.0, W / 2, W - 1.0].forEach((u, i) => {
    c({ u, v: 0.3, r: 0.02, z0: 128, z1: 172, color: '#e5e7eb' });
    for (let k = 0; k < 8; k += 1) d(u + 0.02, 0.3, 170 - k, i % 2 ? o.sign : o.trim, 14 - k, 1);
  });
  front(() => {
    // Montanti della vetrata.
    for (let u = 0.6; u < W - 0.4; u += 0.5) b({ u0: u, v0: face - 0.15, u1: u + 0.04, v1: face - 0.12, z0: 72, z1: 120, color: shade(o.trim, 0.1) });
    // Insegna lunga (il nome lo scrive il motore) e ingressi a vetri.
    b({ u0: 0.6, v0: face, u1: W - 0.6, v1: face + 0.05, z0: 44, z1: 66, color: o.sign, left: o.sign });
    for (let i = 0; i < 4; i += 1) {
      const u = 1.2 + i * 1.3;
      b({ u0: u, v0: face, u1: u + 0.8, v1: face + 0.05, z0: 0, z1: 38, color: 'rgba(191, 227, 255, 0.55)', left: 'rgba(191, 227, 255, 0.5)' });
      b({ u0: u + 0.39, v0: face + 0.05, u1: u + 0.41, v1: face + 0.06, z0: 0, z1: 38, color: '#27272a' });
    }
    // Logo sopra l'insegna.
    const lu = W / 2 - 0.2;
    if (o.logo === 'hockey') {
      for (let k = 0; k < 16; k += 1) {
        d(lu - 0.4 + k * 0.05, face + 0.05, 100 - k * 1.4, '#8a5a3b', 2, 2);
        d(lu + 0.4 - k * 0.05, face + 0.05, 100 - k * 1.4, '#8a5a3b', 2, 2);
      }
      d(lu - 0.1, face + 0.05, 78, '#0a0a0a', 8, 3);
    } else {
      for (let k = 0; k < 40; k += 1) {
        const a = (k / 40) * Math.PI * 2;
        for (let r = 0; r < 10; r += 2) d(lu + Math.cos(a) * r * 0.028, face + 0.05, 90 + Math.sin(a) * r, '#ea580c', 2, 2);
      }
      for (let k = -10; k <= 10; k += 1) {
        d(lu + k * 0.028, face + 0.05, 90, '#431407', 1, 1);
        d(lu, face + 0.05, 90 + k, '#431407', 1, 1);
      }
    }
  });
}

const WOOD = '#8a5a3b';
const WOOD_DARK = '#5b3a26';

/** Numeri rossi della roulette (gli altri, tranne lo zero, sono neri). */
const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

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
  // ---------------------------------------------------------------- quartiere: negozi

  // Banconi dei negozi (2x1): il clic apre il negozio. Colore e merce cambiano con il negozio.
  atelier_counter(b, { c, d, front }) {
    shopCounter(b, { body: '#2b2118', top: '#f3ead8', accent: '#c9a24a' });
    // Registratore dorato, metro da sarto e rotoli di stoffa.
    b({ u0: 1.4, v0: 0.3, u1: 1.8, v1: 0.6, z0: 33, z1: 42, color: '#c9a24a', tex: 'metal' });
    [['#1e2a4a', 0.2], ['#b3122e', 0.45], ['#c19a6b', 0.7]].forEach(([color, u]) => c({ u, v: 0.5, r: 0.09, z0: 33, z1: 37, color, tex: 'fabric' }));
    front(() => { for (let i = 0; i < 14; i += 1) d(0.1 + i * 0.13, 0.9, 20, i % 2 ? '#f5f5f5' : '#fbbf24', 3, 1); });
  },
  watch_counter(b, { d }) {
    shopCounter(b, { body: '#111114', top: '#bfe3ff', accent: '#c9a24a' });
    // Orologi sotto il vetro del bancone.
    ['#15803d', '#d4a017', '#1e3a8a', '#e8a488', '#9ca3af', '#27272a'].forEach((color, i) => {
      d(0.18 + i * 0.28, 0.55, 33, '#e5e7eb', 5, 3);
      d(0.2 + i * 0.28, 0.55, 33, color, 3, 2);
    });
  },
  skate_counter(b, { d, front }) {
    shopCounter(b, { body: '#1f2937', top: '#f97316', accent: '#22d3ee' });
    b({ u0: 1.3, v0: 0.3, u1: 1.85, v1: 0.5, z0: 33, z1: 35, color: '#ec4899' });
    front(() => { ['#ec4899', '#22d3ee', '#fde047', '#22c55e'].forEach((c, i) => d(0.2 + i * 0.4, 0.9, 22, c, 6, 5)); });
  },
  bike_counter(b, { c }) {
    shopCounter(b, { body: '#14532d', top: '#e5e7eb', accent: '#e11d48' });
    // Casco sul bancone.
    c({ u: 1.5, v: 0.5, r: 0.18, z0: 33, z1: 42, color: '#e11d48', top: '#fb7185' });
  },
  car_counter(b, { front, d }) {
    // Scrivania del concessionario: piano bianco, monitor e le chiavi.
    shopCounter(b, { body: '#18181b', top: '#f4f4f5', accent: '#e11d48' });
    b({ u0: 0.3, v0: 0.3, u1: 0.35, v1: 0.8, z0: 33, z1: 52, color: '#27272a' });
    b({ u0: 0.3, v0: 0.3, u1: 0.33, v1: 0.8, z0: 38, z1: 52, color: '#38bdf8', left: '#0ea5e9' });
    b({ u0: 1.4, v0: 0.5, u1: 1.5, v1: 0.56, z0: 33, z1: 34, color: '#fbbf24' });
    front(() => d(0.9, 0.9, 20, '#e11d48', 6, 3));
  },

  mannequin_suit(b, { c }) {
    c({ u: 0.5, v: 0.5, r: 0.24, z0: 0, z1: 3, color: '#27272a' });
    c({ u: 0.5, v: 0.5, r: 0.03, z0: 3, z1: 30, color: '#9ca3af', tex: 'metal' });
    b({ u0: 0.32, v0: 0.36, u1: 0.68, v1: 0.64, z0: 30, z1: 44, color: '#1e2a4a' });
    b({ u0: 0.3, v0: 0.34, u1: 0.7, v1: 0.66, z0: 44, z1: 66, color: '#1e2a4a', tex: 'fabric' });
    b({ u0: 0.45, v0: 0.62, u1: 0.55, v1: 0.67, z0: 52, z1: 66, color: '#f8fafc' });
    b({ u0: 0.48, v0: 0.66, u1: 0.52, v1: 0.68, z0: 50, z1: 64, color: '#b91c1c' });
    c({ u: 0.5, v: 0.5, r: 0.05, z0: 66, z1: 70, color: '#e7d7c1' });
    c({ u: 0.5, v: 0.5, r: 0.12, z0: 70, z1: 82, color: '#e7d7c1', top: '#f1e6d6' });
  },
  mannequin_gown(b, { c }) {
    c({ u: 0.5, v: 0.5, r: 0.24, z0: 0, z1: 3, color: '#27272a' });
    c({ u: 0.5, v: 0.5, r: 0.3, z0: 3, z1: 18, color: '#b3122e', tex: 'fabric' });
    c({ u: 0.5, v: 0.5, r: 0.24, z0: 18, z1: 40, color: '#b3122e', tex: 'fabric' });
    c({ u: 0.5, v: 0.5, r: 0.16, z0: 40, z1: 64, color: '#c81e3a', tex: 'fabric' });
    c({ u: 0.5, v: 0.5, r: 0.05, z0: 64, z1: 68, color: '#e7d7c1' });
    c({ u: 0.5, v: 0.5, r: 0.12, z0: 68, z1: 80, color: '#e7d7c1', top: '#f1e6d6' });
  },
  clothes_rack(b, { c }) {
    [0.12, 1.88].forEach((u) => {
      c({ u, v: 0.5, r: 0.08, z0: 0, z1: 3, color: '#27272a' });
      c({ u, v: 0.5, r: 0.025, z0: 3, z1: 70, color: '#c9a24a', tex: 'metal' });
    });
    b({ u0: 0.1, v0: 0.48, u1: 1.9, v1: 0.52, z0: 68, z1: 71, color: '#c9a24a', tex: 'metal' });
    ['#1e2a4a', '#f5f3ea', '#b3122e', '#c19a6b', '#111114', '#6d28d9', '#d4a017'].forEach((color, i) => {
      const u = 0.22 + i * 0.23;
      b({ u0: u, v0: 0.3, u1: u + 0.16, v1: 0.7, z0: 30 + (i % 2) * 6, z1: 66, color, tex: 'fabric' });
    });
  },
  tailor_mirror(b) {
    b({ u0: 0.2, v0: 0.3, u1: 0.8, v1: 0.42, z0: 0, z1: 4, color: '#6b5638' });
    b({ u0: 0.22, v0: 0.34, u1: 0.78, v1: 0.4, z0: 4, z1: 96, color: '#c9a24a', tex: 'metal' });
    b({ u0: 0.27, v0: 0.4, u1: 0.73, v1: 0.42, z0: 10, z1: 90, color: '#cbd5e1', left: '#dbe4ee' });
    b({ u0: 0.3, v0: 0.42, u1: 0.36, v1: 0.43, z0: 30, z1: 80, color: '#ffffff', left: '#ffffff' });
  },
  watch_vitrine(b, { d }) {
    b({ u0: 0.14, v0: 0.14, u1: 0.86, v1: 0.86, z1: 30, color: '#2b2118', tex: 'wood' });
    b({ u0: 0.14, v0: 0.14, u1: 0.86, v1: 0.86, z0: 30, z1: 32, color: '#c9a24a' });
    // Campana di vetro e tre orologi sul cuscino.
    b({ u0: 0.2, v0: 0.2, u1: 0.8, v1: 0.8, z0: 32, z1: 60, color: 'rgba(191, 227, 255, 0.35)', left: 'rgba(191, 227, 255, 0.3)', right: 'rgba(150, 190, 220, 0.35)', top: 'rgba(230, 245, 255, 0.4)' });
    b({ u0: 0.3, v0: 0.3, u1: 0.7, v1: 0.7, z0: 32, z1: 36, color: '#7f1d1d', tex: 'fabric' });
    [['#d4a017', 0.34], ['#1e3a8a', 0.5], ['#15803d', 0.66]].forEach(([color, u]) => {
      d(u, 0.5, 38, '#e5e7eb', 4, 3);
      d(u + 0.02, 0.5, 38, color, 2, 2);
    });
  },
  skate_rack(b) {
    b({ u0: 0.05, v0: 0.1, u1: 1.95, v1: 0.24, z1: 80, color: '#8a5a3b', tex: 'wood' });
    ['#ec4899', '#22d3ee', '#fde047', '#22c55e', '#f97316', '#8b5cf6', '#ef4444'].forEach((color, i) => {
      const u = 0.12 + i * 0.26;
      b({ u0: u, v0: 0.24, u1: u + 0.18, v1: 0.3, z0: 10, z1: 72, color, left: shade(color, -0.1) });
      b({ u0: u + 0.04, v0: 0.3, u1: u + 0.14, v1: 0.34, z0: 16, z1: 20, color: '#e5e7eb' });
      b({ u0: u + 0.04, v0: 0.3, u1: u + 0.14, v1: 0.34, z0: 62, z1: 66, color: '#e5e7eb' });
    });
  },
  bike_display(b, { d }) {
    b({ u0: 0.05, v0: 0.2, u1: 1.95, v1: 0.8, z1: 4, color: '#3f3f46' });
    // Bici di profilo: due ruote, telaio rosso, sella e manubrio.
    const ring = (uc) => {
      for (let i = 0; i < 28; i += 1) {
        const a = (i / 28) * Math.PI * 2;
        d(uc + Math.cos(a) * 0.3, 0.5, 20 + Math.sin(a) * 14, '#111827', 2, 2);
      }
    };
    ring(0.5);
    ring(1.5);
    for (let i = 0; i <= 10; i += 1) {
      d(0.5 + i * 0.05, 0.5, 20 + i * 1.6, '#e11d48', 2, 2);
      d(1.0 + i * 0.05, 0.5, 20 + i * 1.6, '#e11d48', 2, 2);
      d(0.8 + i * 0.07, 0.5, 36, '#e11d48', 2, 2);
    }
    d(0.72, 0.5, 40, '#111827', 6, 2);
    d(1.42, 0.5, 42, '#111827', 5, 2);
  },
  // Pedana girevole: l'auto sopra la disegna il motore (e gira piano). Le showcar_N sono le
  // pedane del garage di casa, con l'auto N del giocatore.
  car_display(b, { c }) {
    c({ u: 1.5, v: 1.5, r: 1.35, z0: 0, z1: 5, color: '#27272a', top: '#3f3f46', tex: 'metal' });
    c({ u: 1.5, v: 1.5, r: 1.2, z0: 5, z1: 6, color: '#52525b', top: '#e4e4e7' });
  },

  // ---------------------------------------------------------------- quartiere: facciate

  facade_atelier(b, { d, front }) {
    shopFront(b, d, front, {
      W: 4, L: 2, h: 128, wall: '#efe6d4', tex: 'stone', trim: '#c9a24a', sign: '#111114', glass: '#2b3a4a',
      awning: ['#111114', '#f3ead8'], door: '#111114',
      goods: (u, z) => ['#1e2a4a', '#b3122e', '#c19a6b'].forEach((color, i) => d(u + i * 0.35, 1.72, z, color, 5, 18))
    });
  },
  facade_watches(b, { d, front }) {
    shopFront(b, d, front, {
      W: 4, L: 2, h: 132, wall: '#1f2937', tex: 'stone', trim: '#d4a017', sign: '#0b3d2e', glass: '#1c2733',
      awning: ['#0b3d2e', '#d4a017'], door: '#d4a017',
      goods: (u, z) => ['#d4a017', '#1e3a8a', '#15803d', '#e8a488'].forEach((color, i) => {
        d(u + i * 0.28, 1.72, z, '#e5e7eb', 4, 4);
        d(u + i * 0.28 + 0.02, 1.72, z + 1, color, 2, 2);
      })
    });
  },
  facade_skate(b, { d, front }) {
    shopFront(b, d, front, {
      W: 3, L: 2, h: 108, wall: '#374151', tex: 'stone', trim: '#f97316', sign: '#ec4899', glass: '#1f2937',
      awning: ['#22d3ee', '#1f2937'], door: '#f97316',
      goods: (u, z) => ['#ec4899', '#22d3ee', '#fde047'].forEach((color, i) => d(u + i * 0.28, 1.72, z - 6, color, 4, 22))
    });
    // Graffiti sul muro.
    front(() => ['#ec4899', '#22d3ee', '#fde047', '#22c55e'].forEach((c, i) => d(2.3 + i * 0.1, 1.72, 30 + (i % 2) * 8, c, 6, 4)));
  },
  facade_bikes(b, { d, front }) {
    shopFront(b, d, front, {
      W: 3, L: 2, h: 110, wall: '#dfe7df', tex: 'stone', trim: '#14532d', sign: '#14532d', glass: '#23343a',
      awning: ['#14532d', '#f5f5f5'], door: '#14532d',
      goods: (u, z) => {
        for (let i = 0; i < 16; i += 1) {
          const a = (i / 16) * Math.PI * 2;
          d(u + 0.2 + Math.cos(a) * 0.14, 1.72, z + 6 + Math.sin(a) * 7, '#111827', 1, 1);
          d(u + 0.6 + Math.cos(a) * 0.14, 1.72, z + 6 + Math.sin(a) * 7, '#111827', 1, 1);
        }
        d(u + 0.24, 1.72, z + 12, '#e11d48', 12, 2);
      }
    });
  },
  facade_cars(b, { d, front }) {
    // Concessionaria: vetrata a tutta altezza, l'auto esposta dietro, il marchio rosso.
    shopFront(b, d, front, {
      W: 5, L: 2, h: 120, wall: '#e4e4e7', tex: 'stone', trim: '#111114', sign: '#e11d48', glass: '#2a4a5c',
      door: '#111114', wideWindow: true,
      goods: (u, z) => {
        d(u + 0.2, 1.72, z + 2, '#d91a1a', 30, 9);
        d(u + 0.4, 1.72, z + 9, '#8f0f0f', 16, 5);
        d(u + 0.25, 1.72, z - 1, '#111827', 5, 4);
        d(u + 0.95, 1.72, z - 1, '#111827', 5, 4);
      }
    });
  },
  facade_cafe(b, { d, front }) {
    shopFront(b, d, front, {
      W: 4, L: 2, h: 116, wall: '#8a5a3b', tex: 'wood', trim: '#1f4b3a', sign: '#1f4b3a', glass: '#3a2a1c',
      awning: ['#1f4b3a', '#f5f1e6'], door: '#1f4b3a', warm: true,
      goods: (u, z) => ['#f5f1e6', '#6b3e1f', '#f5f1e6'].forEach((color, i) => d(u + i * 0.3, 1.72, z, color, 4, 6))
    });
    // Tavolini fuori, sul marciapiede.
    front(() => d(0.4, 1.95, 18, '#1f4b3a', 8, 2));
  },

  arena_hockey(b, { c, d, front }) {
    arenaFront(b, c, d, front, { W: 7, L: 3, wall: '#dbe7f3', glass: '#5aa9e6', roof: '#9fb7cc', trim: '#1f5fbf', sign: '#d62839', logo: 'hockey' });
  },
  arena_basket(b, { c, d, front }) {
    arenaFront(b, c, d, front, { W: 7, L: 3, wall: '#f3e1cf', glass: '#e9823a', roof: '#c9ab8c', trim: '#7c2d12', sign: '#ea580c', logo: 'basket' });
  },

  villa(b, { d, front, leaves }) {
    // Villa moderna: due volumi bianchi, vetrate, tetto piano con il bordo di legno, garage.
    b({ u0: 0.1, v0: 0.1, u1: 3.9, v1: 2.4, z1: 52, color: '#f4f2ec', tex: 'stone' });
    b({ u0: 0.1, v0: 0.1, u1: 3.9, v1: 2.4, z0: 52, z1: 56, color: '#8a5a3b', tex: 'wood' });
    b({ u0: 0.8, v0: 0.2, u1: 3.4, v1: 1.9, z0: 56, z1: 96, color: '#ffffff', tex: 'stone' });
    b({ u0: 0.7, v0: 0.1, u1: 3.5, v1: 2.0, z0: 96, z1: 101, color: '#5b3a26', tex: 'wood' });
    front(() => {
      // Vetrate del piano terra e del primo piano, porta e garage.
      b({ u0: 0.3, v0: 2.4, u1: 1.9, v1: 2.44, z0: 6, z1: 44, color: '#7fb6d9', left: '#8cc3e3' });
      b({ u0: 1.0, v0: 1.9, u1: 3.2, v1: 1.94, z0: 62, z1: 90, color: '#7fb6d9', left: '#8cc3e3' });
      b({ u0: 2.1, v0: 2.4, u1: 2.6, v1: 2.44, z0: 0, z1: 44, color: '#5b3a26', left: '#6b4631' });
      b({ u0: 2.8, v0: 2.4, u1: 3.8, v1: 2.44, z0: 0, z1: 36, color: '#d4d4d8', left: '#c4c4c8' });
      for (let z = 6; z < 36; z += 6) d(2.82, 2.44, z, '#a1a1aa', 30, 1);
      d(2.3, 2.44, 24, '#fbbf24', 2, 2);
    });
    leaves({ u: 0.25, v: 2.7, z: 18, r: 0.5, color: '#2f7d32', seed: 4 });
    leaves({ u: 3.8, v: 0.3, z: 60, r: 0.35, color: '#3a8f3c', seed: 9 });
  },
  traffic_light(b, { c, now }) {
    c({ u: 0.5, v: 0.5, r: 0.04, z0: 0, z1: 80, color: '#27272a', tex: 'metal' });
    b({ u0: 0.4, v0: 0.44, u1: 0.6, v1: 0.6, z0: 80, z1: 116, color: '#18181b' });
    const phase = Math.floor((now || 0) / 1500) % 3;
    [['#ef4444', 108], ['#fbbf24', 98], ['#22c55e', 88]].forEach(([color, z], i) => {
      b({ u0: 0.44, v0: 0.6, u1: 0.56, v1: 0.62, z0: z - 4, z1: z + 4, color: i === phase ? color : shade(color, -0.65), glow: i === phase });
    });
  },
  bus_stop(b) {
    b({ u0: 0.1, v0: 0.12, u1: 1.9, v1: 0.2, z1: 70, color: 'rgba(191, 227, 255, 0.45)', left: 'rgba(191, 227, 255, 0.4)' });
    [0.1, 1.84].forEach((u) => b({ u0: u, v0: 0.12, u1: u + 0.06, v1: 0.9, z1: 74, color: '#374151', tex: 'metal' }));
    b({ u0: 0.05, v0: 0.08, u1: 1.95, v1: 0.95, z0: 74, z1: 78, color: '#374151' });
    b({ u0: 0.3, v0: 0.3, u1: 1.7, v1: 0.6, z0: 14, z1: 18, color: '#e11d48' });
    b({ u0: 1.2, v0: 0.2, u1: 1.7, v1: 0.24, z0: 30, z1: 64, color: '#fef3c7', left: '#fde68a' });
  },
  hydrant(b, { c }) {
    c({ u: 0.5, v: 0.5, r: 0.14, z0: 0, z1: 22, color: '#dc2626' });
    c({ u: 0.5, v: 0.5, r: 0.11, z0: 22, z1: 28, color: '#b91c1c', top: '#f87171' });
    b({ u0: 0.3, v0: 0.44, u1: 0.7, v1: 0.56, z0: 12, z1: 16, color: '#dc2626' });
  },
  street_tree(b, { c, leaves }) {
    c({ u: 0.5, v: 0.5, r: 0.3, z0: 0, z1: 2, color: '#57534e' });
    c({ u: 0.5, v: 0.5, r: 0.07, z0: 2, z1: 60, color: '#6b4631', tex: 'wood' });
    leaves({ u: 0.5, v: 0.5, z: 76, r: 0.9, color: '#3a8f3c', seed: 12 });
    leaves({ u: 0.5, v: 0.5, z: 96, r: 0.6, color: '#46a047', seed: 13 });
  },

  // ---------------------------------------------------------------- caffetteria

  espresso_bar(b, { c, d, front }) {
    // Bancone lungo: legno scuro, piano chiaro, due macchine dell'espresso, i bicchieri verdi.
    b({ u0: 0.05, v0: 0.2, u1: 2.95, v1: 0.9, z1: 34, color: '#5b3a26', tex: 'wood' });
    b({ u0: 0.02, v0: 0.16, u1: 2.98, v1: 0.94, z0: 34, z1: 37, color: '#ece6da' });
    [0.4, 1.4].forEach((u) => {
      b({ u0: u, v0: 0.26, u1: u + 0.5, v1: 0.6, z0: 37, z1: 58, color: '#c0c4cc', tex: 'metal' });
      b({ u0: u + 0.05, v0: 0.6, u1: u + 0.12, v1: 0.66, z0: 42, z1: 48, color: '#27272a' });
      b({ u0: u + 0.3, v0: 0.6, u1: u + 0.37, v1: 0.66, z0: 42, z1: 48, color: '#27272a' });
    });
    [2.2, 2.4, 2.6].forEach((u, i) => c({ u, v: 0.55, r: 0.06, z0: 37, z1: 46, color: i % 2 ? '#f5f5f5' : '#1f4b3a', top: '#f5f1e6' }));
    front(() => {
      d(0.2, 0.94, 28, '#1f4b3a', 90, 4);
      for (let i = 0; i < 6; i += 1) d(0.3 + i * 0.45, 0.94, 18, '#c9a24a', 2, 2);
    });
  },
  pastry_case(b, { d }) {
    b({ u0: 0.05, v0: 0.2, u1: 1.95, v1: 0.9, z1: 26, color: '#1f4b3a', tex: 'wood' });
    b({ u0: 0.08, v0: 0.24, u1: 1.92, v1: 0.86, z0: 26, z1: 50, color: 'rgba(214, 238, 255, 0.35)', left: 'rgba(214, 238, 255, 0.3)', top: 'rgba(240, 250, 255, 0.35)' });
    ['#e8b45a', '#7c3f1d', '#f9a8d4', '#e8b45a', '#fde68a', '#7c3f1d'].forEach((color, i) => {
      d(0.2 + i * 0.28, 0.55, 30, color, 5, 3);
      d(0.2 + i * 0.28, 0.55, 40, i % 2 ? '#e8b45a' : '#f5f1e6', 5, 3);
    });
  },
  armchair_green(b) {
    b({ u0: 0.1, v0: 0.1, u1: 0.9, v1: 0.9, z1: 12, color: '#3e2718' });
    b({ u0: 0.26, v0: 0.18, u1: 0.84, v1: 0.84, z0: 12, z1: 22, color: '#2f6b4f', tex: 'fabric' });
    b({ u0: 0.1, v0: 0.1, u1: 0.28, v1: 0.9, z0: 12, z1: 50, color: '#245a41', tex: 'fabric' });
    b({ u0: 0.1, v0: 0.1, u1: 0.9, v1: 0.24, z0: 12, z1: 34, color: '#245a41', tex: 'fabric' });
    b({ u0: 0.1, v0: 0.76, u1: 0.9, v1: 0.9, z0: 12, z1: 34, color: '#245a41', tex: 'fabric' });
  },

  // ---------------------------------------------------------------- palaghiaccio

  hockey_goal(b, { d }) {
    const net = 'rgba(241, 245, 249, 0.25)';
    b({ u0: 0.15, v0: 0.1, u1: 0.85, v1: 1.9, z1: 36, color: net, left: net, right: 'rgba(203, 213, 225, 0.3)', top: 'rgba(241, 245, 249, 0.18)' });
    for (let v = 0.14; v < 1.88; v += 0.14) for (let z = 4; z < 36; z += 5) d(0.85, v, z, 'rgba(255, 255, 255, 0.7)', 1, 1);
    [[0.44, 0.06], [0.44, 1.84]].forEach(([u, v]) => b({ u0: u, v0: v, u1: u + 0.1, v1: v + 0.1, z1: 40, color: '#d62839', tex: 'metal' }));
    b({ u0: 0.44, v0: 0.06, u1: 0.54, v1: 1.94, z0: 36, z1: 40, color: '#d62839', tex: 'metal' });
  },
  hockey_target(b, { c, d }) {
    // Pannello con quattro buchi negli angoli: si tira il disco dentro.
    b({ u0: 0.05, v0: 0.4, u1: 1.95, v1: 0.55, z1: 46, color: '#1f5fbf' });
    [[0.3, 36], [1.62, 36], [0.3, 10], [1.62, 10]].forEach(([u, z]) => d(u, 0.55, z, '#0a0a0a', 9, 7));
    d(0.9, 0.55, 24, '#f5f5f5', 14, 3);
    c({ u: 1.0, v: 0.9, r: 0.08, z0: 0, z1: 2, color: '#0a0a0a' });
  },
  team_bench(b) {
    b({ u0: 0.05, v0: 0.1, u1: 2.95, v1: 0.2, z1: 60, color: 'rgba(214, 238, 255, 0.35)', left: 'rgba(214, 238, 255, 0.3)' });
    b({ u0: 0.05, v0: 0.3, u1: 2.95, v1: 0.8, z0: 16, z1: 20, color: '#1f5fbf' });
    [0.2, 1.4, 2.7].forEach((u) => b({ u0: u, v0: 0.4, u1: u + 0.1, v1: 0.7, z1: 16, color: '#27272a' }));
  },

  // ---------------------------------------------------------------- locale rock e Rock Store

  // Palco (6x3, si calpesta): pedana nera con il bordo di luci e la moquette consumata.
  rock_stage(b, { d, now, front }) {
    b({ u0: 0.02, v0: 0.02, u1: 5.98, v1: 2.98, z1: 10, color: '#1c1917', left: '#292524', right: '#0c0a09', tex: 'wood' });
    b({ u0: 0.1, v0: 0.1, u1: 5.9, v1: 2.9, z0: 10, z1: 10, color: '#27201c', tex: 'fabric' });
    const step = Math.floor((now || 0) / 250) % 4;
    front(() => {
      for (let i = 0; i < 22; i += 1) d(0.12 + i * 0.27, 2.98, 6, (i + step) % 4 === 0 ? '#fde047' : (i % 2 ? '#ef4444' : '#f97316'), 3, 3);
    });
  },
  drum_kit(b, { c }) {
    // Grancassa di fronte, rullante, tom, timpano, due piatti dorati e lo sgabello.
    c({ u: 1.0, v: 1.5, r: 0.36, z0: 0, z1: 26, color: '#b91c1c', top: '#e5e7eb' });
    c({ u: 1.0, v: 1.5, r: 0.2, z0: 13, z1: 13, color: '#f5f5f5', top: '#f5f5f5' });
    c({ u: 0.55, v: 1.0, r: 0.16, z0: 0, z1: 22, color: '#9ca3af', top: '#e5e7eb', tex: 'metal' });
    c({ u: 1.45, v: 1.0, r: 0.2, z0: 0, z1: 18, color: '#b91c1c', top: '#e5e7eb' });
    c({ u: 0.85, v: 1.0, r: 0.13, z0: 28, z1: 36, color: '#b91c1c', top: '#e5e7eb' });
    c({ u: 1.2, v: 1.0, r: 0.13, z0: 28, z1: 36, color: '#b91c1c', top: '#e5e7eb' });
    [[0.35, 0.6, 46], [1.7, 0.6, 50]].forEach(([u, v, z]) => {
      c({ u, v, r: 0.02, z0: 0, z1: z, color: '#9ca3af' });
      c({ u, v, r: 0.24, z0: z, z1: z + 1, color: '#ca8a04', top: '#fde047' });
    });
    c({ u: 1.0, v: 0.45, r: 0.14, z0: 0, z1: 18, color: '#27272a', top: '#3f3f46' });
  },
  amp_stack(b, { d, front }) {
    // Testata e cassa 4x12 nere con la griglia e le manopole.
    b({ u0: 0.1, v0: 0.2, u1: 0.9, v1: 0.8, z1: 50, color: '#18181b', tex: 'fabric' });
    b({ u0: 0.08, v0: 0.18, u1: 0.92, v1: 0.82, z0: 50, z1: 64, color: '#111114' });
    front(() => {
      d(0.15, 0.8, 46, '#3f3f46', 20, 38);
      for (let i = 0; i < 4; i += 1) d(0.2 + (i % 2) * 0.32, 0.8, 42 - Math.floor(i / 2) * 18, '#27272a', 9, 9);
      d(0.18, 0.82, 61, '#d4a017', 22, 2);
      for (let i = 0; i < 5; i += 1) d(0.22 + i * 0.12, 0.82, 57, '#e5e7eb', 2, 2);
    });
  },
  mic_stand(b, { c }) {
    c({ u: 0.5, v: 0.5, r: 0.16, z0: 0, z1: 2, color: '#27272a' });
    c({ u: 0.5, v: 0.5, r: 0.025, z0: 2, z1: 52, color: '#a1a1aa', tex: 'metal' });
    c({ u: 0.5, v: 0.5, r: 0.06, z0: 52, z1: 60, color: '#3f3f46', top: '#9ca3af' });
  },
  // Pedana della gara rock (2x2): i tasti colorati della chitarra sul piano, luci a tempo.
  guitar_duel(b, { d, now, front }) {
    b({ u0: 0.02, v0: 0.02, u1: 1.98, v1: 1.98, z1: 12, color: '#18181b', left: '#27272a', right: '#0c0a09', tex: 'metal' });
    const colors = ['#22c55e', '#ef4444', '#facc15', '#3b82f6', '#f97316'];
    const lit = Math.floor((now || 0) / 200) % 5;
    colors.forEach((color, i) => {
      b({ u0: 0.2 + i * 0.33, v0: 0.3, u1: 0.44 + i * 0.33, v1: 1.7, z0: 12, z1: 13, color: i === lit ? color : shade(color, -0.45), glow: i === lit });
    });
    front(() => {
      for (let i = 0; i < 12; i += 1) d(0.08 + i * 0.16, 1.98, 7, (i + lit) % 3 === 0 ? '#fde047' : '#f97316', 3, 3);
    });
  },
  // Partenza della gara in citta': portale con la bandiera a scacchi e le luci rosse.
  race_start(b, { c, d, now }) {
    c({ u: 0.2, v: 0.5, r: 0.05, z0: 0, z1: 96, color: '#27272a', tex: 'metal' });
    c({ u: 0.8, v: 0.5, r: 0.05, z0: 0, z1: 96, color: '#27272a', tex: 'metal' });
    b({ u0: 0.14, v0: 0.44, u1: 0.86, v1: 0.56, z0: 84, z1: 100, color: '#111' });
    for (let i = 0; i < 8; i += 1) for (let j = 0; j < 2; j += 1) d(0.18 + i * 0.08, 0.56, 98 - j * 7, (i + j) % 2 ? '#fff' : '#111', 3, 6);
    const on = Math.floor((now || 0) / 700) % 4;
    [0.3, 0.5, 0.7].forEach((u, i) => c({ u, v: 0.56, r: 0.05, z0: 76, z1: 82, color: i < on ? '#ef4444' : '#3f3f46', top: i < on ? '#fca5a5' : '#52525b' }));
  },
  // Posteggio dei taxi: palina gialla e un taxi fermo.
  taxi_stand(b, { c, d }) {
    c({ u: 0.2, v: 0.2, r: 0.03, z0: 0, z1: 70, color: '#52525b' });
    b({ u0: 0.08, v0: 0.18, u1: 0.34, v1: 0.24, z0: 60, z1: 76, color: '#facc15', left: '#eab308' });
    d(0.12, 0.24, 72, '#111', 7, 3);
    b({ u0: 0.3, v0: 0.35, u1: 0.95, v1: 0.9, z0: 3, z1: 14, color: '#facc15', left: '#eab308', right: '#ca8a04' });
    b({ u0: 0.45, v0: 0.42, u1: 0.8, v1: 0.83, z0: 14, z1: 22, color: '#1e3a5f' });
    b({ u0: 0.55, v0: 0.55, u1: 0.7, v1: 0.7, z0: 22, z1: 25, color: '#111' });
    [[0.4, 0.38], [0.4, 0.87], [0.85, 0.38], [0.85, 0.87]].forEach(([u, v]) => c({ u, v, r: 0.07, z0: 0, z1: 6, color: '#111' }));
  },
  // Pedana della gara di batteria (2x2): quattro pad colorati e una piccola batteria elettronica.
  drum_duel(b, { c, d, now, front }) {
    b({ u0: 0.02, v0: 0.02, u1: 1.98, v1: 1.98, z1: 12, color: '#18181b', left: '#27272a', right: '#0c0a09', tex: 'metal' });
    const colors = ['#f97316', '#ef4444', '#facc15', '#3b82f6'];
    const lit = Math.floor((now || 0) / 250) % 4;
    [[0.5, 0.6], [1.4, 0.6], [0.5, 1.4], [1.4, 1.4]].forEach(([u, v], i) => {
      c({ u, v, r: 0.26, z0: 12, z1: 16, color: i === lit ? colors[i] : shade(colors[i], -0.45), top: i === lit ? shade(colors[i], 0.3) : shade(colors[i], -0.3) });
    });
    front(() => {
      for (let i = 0; i < 12; i += 1) d(0.08 + i * 0.16, 1.98, 7, (i + lit) % 3 === 0 ? '#fde047' : '#3b82f6', 3, 3);
    });
  },
  guitar_wall(b, { d }) {
    // Pannello di legno con sei chitarre appese.
    b({ u0: 0.05, v0: 0.1, u1: 1.95, v1: 0.2, z1: 96, color: '#5b3a26', tex: 'wood' });
    ['#c81e1e', '#e0902e', '#f4f4f5', '#18181b', '#1d4ed8', '#c8904f'].forEach((color, i) => {
      const u = 0.18 + i * 0.3;
      for (let z = 60; z < 88; z += 2) d(u + 0.06, 0.22, z, '#7c4a1e', 2, 2);
      d(u + 0.03, 0.22, 90, '#27272a', 4, 3);
      d(u, 0.22, 58, color, 9, 14);
      d(u + 0.02, 0.22, 46, color, 7, 8);
    });
  },
  guitar_stand(b, { c, d }) {
    // Chitarra elettrica su un supporto a treppiede.
    c({ u: 0.5, v: 0.5, r: 0.18, z0: 0, z1: 2, color: '#27272a' });
    c({ u: 0.5, v: 0.5, r: 0.02, z0: 2, z1: 20, color: '#52525b' });
    d(0.38, 0.52, 34, '#c81e1e', 10, 16);
    d(0.42, 0.52, 20, '#c81e1e', 8, 6);
    d(0.44, 0.54, 28, '#f5f5f5', 4, 4);
    for (let z = 36; z < 62; z += 2) d(0.48, 0.52, z, '#7c4a1e', 2, 2);
    d(0.46, 0.52, 64, '#27272a', 4, 4);
  },
  guitar_counter(b, { d, front }) {
    shopCounter(b, { body: '#3f2a14', top: '#1c1917', accent: '#f97316' });
    // Plettri colorati e un accordatore sul banco.
    ['#ef4444', '#facc15', '#3b82f6', '#22c55e'].forEach((color, i) => d(0.3 + i * 0.2, 0.55, 33, color, 3, 2));
    b({ u0: 1.4, v0: 0.3, u1: 1.8, v1: 0.55, z0: 33, z1: 37, color: '#18181b' });
    front(() => d(0.3, 0.9, 22, '#f97316', 20, 4));
  },
  rock_counter(b, { d, front }) {
    shopCounter(b, { body: '#111114', top: '#27272a', accent: '#dc2626' });
    // Magliette piegate sul banco.
    ['#111114', '#b91c1c', '#e5e7eb'].forEach((color, i) => b({ u0: 0.2 + i * 0.5, v0: 0.3, u1: 0.6 + i * 0.5, v1: 0.7, z0: 33, z1: 36, color, tex: 'fabric' }));
    front(() => d(0.4, 0.9, 22, '#dc2626', 18, 4));
  },
  facade_rock(b, { c, d, front }) {
    // Locale rock: mattoni neri, tavola dell'insegna, porta rossa, locandine dei concerti.
    shopFront(b, d, front, {
      W: 5, L: 2, h: 124, wall: '#27201c', tex: 'stone', trim: '#dc2626', sign: '#111114', glass: '#1a0628',
      door: '#b91c1c',
      goods: (u, z) => ['#f97316', '#22c55e', '#ef4444'].forEach((color, i) => d(u + i * 0.5, 1.72, z, color, 9, 14))
    });
    front(() => {
      // Chitarra gigante al neon sopra l'ingresso.
      for (let k = 0; k < 14; k += 1) d(3.9 + k * 0.05, 1.72, 76 + k * 1.6, '#f97316', 2, 2);
      d(3.75, 1.72, 70, '#ef4444', 10, 8);
    });
    c({ u: 4.6, v: 0.4, r: 0.02, z0: 124, z1: 150, color: '#e5e7eb' });
  },
  facade_guitars(b, { d, front }) {
    shopFront(b, d, front, {
      W: 4, L: 2, h: 116, wall: '#5b3a26', tex: 'wood', trim: '#f97316', sign: '#18181b', glass: '#24160e', warm: true,
      door: '#18181b', awning: ['#18181b', '#f97316'],
      goods: (u, z) => ['#c81e1e', '#e0902e', '#f4f4f5', '#1d4ed8'].forEach((color, i) => {
        for (let k = 0; k < 8; k += 1) d(u + i * 0.34 + 0.04, 1.72, z + 10 + k * 2, '#7c4a1e', 1, 2);
        d(u + i * 0.34, 1.72, z + 8, color, 6, 9);
      })
    });
  },

  // Piastrella della Disco anni 80: vetro colorato illuminato da sotto, come in Saturday Night Fever.
  fever_tile(b, { item }) {
    const colors = ['#ff3b6b', '#ffd23f', '#3bc9ff', '#7cff6b', '#ff7bd5', '#b26bff'];
    const color = colors[Math.max(0, item?.colorIndex ?? 0) % colors.length];
    const lit = !!item?.lit;
    const glass = lit ? color : shade(color, -0.55);
    b({ u0: 0.02, v0: 0.02, u1: 0.98, v1: 0.98, z1: 2, color: '#0b0910' });
    b({ u0: 0.08, v0: 0.08, u1: 0.92, v1: 0.92, z0: 2, z1: 2, color: glass, glow: lit });
    // Riflesso chiaro al centro del vetro: da acceso sembra la lampadina sotto.
    b({ u0: 0.32, v0: 0.32, u1: 0.68, v1: 0.68, z0: 2, z1: 2, color: lit ? shade(color, 0.55) : shade(glass, 0.15) });
  },
  // Pedana della gara di ballo (2x2): gradino cromato, piano a quadri luminosi e lampadine sul bordo.
  dance_contest(b, { d, now, front }) {
    const step = Math.floor((now || 0) / 300) % 4;
    const colors = ['#ff3b6b', '#ffd23f', '#3bc9ff', '#ff7bd5'];
    b({ u0: 0.02, v0: 0.02, u1: 1.98, v1: 1.98, z1: 12, color: '#c9c6d8', left: '#8f8ba8', right: '#6a6682', tex: 'metal' });
    for (let i = 0; i < 4; i += 1) {
      for (let j = 0; j < 4; j += 1) {
        const color = colors[(i + j + step) % colors.length];
        b({ u0: 0.06 + i * 0.48, v0: 0.06 + j * 0.48, u1: 0.5 + i * 0.48, v1: 0.5 + j * 0.48, z0: 12, z1: 13, color, glow: (i + j + step) % 2 === 0 });
      }
    }
    front(() => {
      for (let i = 0; i < 12; i += 1) d(0.08 + i * 0.16, 1.98, 8, (i + step) % 3 === 0 ? '#fff7c2' : '#ffd23f', 3, 3);
    });
  },
  trophy(b, { c }) {
    b({ u0: 0.24, v0: 0.24, u1: 0.76, v1: 0.76, z1: 16, color: '#1f1f2e', tex: 'stone' });
    c({ u: 0.5, v: 0.5, r: 0.06, z0: 16, z1: 30, color: '#d4a017', tex: 'metal' });
    b({ u0: 0.2, v0: 0.46, u1: 0.28, v1: 0.54, z0: 38, z1: 48, color: '#ffd700' });
    c({ u: 0.5, v: 0.5, r: 0.22, z0: 30, z1: 52, color: '#ffd700', top: '#fff3b0', open: true });
    b({ u0: 0.72, v0: 0.46, u1: 0.8, v1: 0.54, z0: 38, z1: 48, color: '#ffd700' });
  },
  // Teca 3D: basamento scuro con bordo d'oro; la carta che gira e il vetro li disegna il motore.
  card_case(b) {
    b({ u0: 0.2, v0: 0.2, u1: 0.8, v1: 0.8, z1: 22, color: '#1e1b3a', left: '#15122b', right: '#0e0c1f', tex: 'stone' });
    b({ u0: 0.16, v0: 0.16, u1: 0.84, v1: 0.84, z0: 22, z1: 26, color: '#fbbf24', glow: true });
    b({ u0: 0.3, v0: 0.3, u1: 0.7, v1: 0.7, z0: 26, z1: 28, color: '#8b5cf6', glow: true });
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
  },
  billiard_table(b, { c }) {
    // Tavolo grande 4x2: gambe torniti, fascia in legno, sponde verde scuro, panno e sei buche.
    [[0.25, 0.25], [0.25, 1.65], [3.65, 0.25], [3.65, 1.65], [1.95, 0.25], [1.95, 1.65]]
      .forEach(([u, v]) => b({ u0: u, v0: v, u1: u + 0.12, v1: v + 0.12, z1: 30, color: '#3f1d0b', tex: 'wood' }));
    b({ u0: 0.08, v0: 0.08, u1: 3.92, v1: 1.92, z0: 30, z1: 40, color: '#6b3e1f', tex: 'wood' });
    b({ u0: 0.2, v0: 0.2, u1: 3.8, v1: 1.8, z0: 40, z1: 42, color: '#14532d' });
    b({ u0: 0.3, v0: 0.3, u1: 3.7, v1: 1.7, z0: 41, z1: 41, color: '#15803d', tex: 'fabric' });
    [[0.3, 0.3], [2.0, 0.26], [3.7, 0.3], [0.3, 1.7], [2.0, 1.74], [3.7, 1.7]]
      .forEach(([u, v]) => c({ u, v, r: 0.07, z0: 41, z1: 41, color: '#0a0a0a', top: '#0a0a0a' }));
    [[1.0, 0.08], [3.0, 0.08]].forEach(([u, v]) => b({ u0: u, v0: v, u1: u + 0.05, v1: v + 0.03, z0: 40, z1: 40, color: '#f5f5f4' }));
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
  // ---------------------------------------------------------------- casino

  slot_machine(b, { c, d, now, front }) {
    // Cabinato della slot: mobile rosso e oro, tre rulli dietro il vetro, insegna luminosa e leva.
    const step = Math.floor((now || 0) / 220) % 6;
    b({ u0: 0.12, v0: 0.16, u1: 0.88, v1: 0.84, z1: 30, color: '#7a0f1c', left: '#8f1424', right: '#5a0a14' });
    b({ u0: 0.1, v0: 0.14, u1: 0.9, v1: 0.86, z0: 30, z1: 33, color: '#d4a537' });
    b({ u0: 0.14, v0: 0.24, u1: 0.86, v1: 0.84, z0: 33, z1: 76, color: '#8f1424', left: '#a3182b', right: '#5a0a14' });
    b({ u0: 0.12, v0: 0.22, u1: 0.88, v1: 0.86, z0: 76, z1: 90, color: '#d4a537', glow: true });
    c({ u: 0.88, v: 0.55, r: 0.03, z0: 46, z1: 70, color: '#c0c0c0', tex: 'metal' });
    c({ u: 0.88, v: 0.55, r: 0.06, z0: 70, z1: 76, color: '#ef4444', top: '#f87171' });
    front(() => {
      // Vetro con i tre rulli: simboli che scorrono.
      d(0.2, 0.84, 70, '#111018', 22, 22);
      const symbols = ['#ef4444', '#fbbf24', '#22c55e', '#8b5cf6', '#f97316', '#ffffff'];
      for (let r = 0; r < 3; r += 1) {
        d(0.22 + r * 0.2, 0.84, 68, '#f8f5ec', 6, 18);
        d(0.23 + r * 0.2, 0.84, 61, symbols[(step + r * 2) % 6], 4, 4);
      }
      d(0.2, 0.84, 59, '#ef4444', 22, 1);
      // Insegna con le lucine che si rincorrono.
      for (let i = 0; i < 6; i += 1) d(0.16 + i * 0.12, 0.86, 88, (i + step) % 2 ? '#fff7d1' : '#f59e0b', 2, 2);
      d(0.3, 0.86, 84, '#7a0f1c', 12, 5);
      // Pulsanti e vassoio delle monete.
      d(0.24, 0.84, 38, '#22c55e', 3, 2);
      d(0.44, 0.84, 38, '#fbbf24', 3, 2);
      d(0.64, 0.84, 38, '#ef4444', 3, 2);
      d(0.3, 0.84, 24, '#2a1408', 12, 5);
      d(0.34, 0.84, 21, '#d4a537', 6, 1);
    });
  },
  poker_machine(b, { d, now, front }) {
    // Video poker: mobile blu notte e oro, schermo con cinque carte e la tabella delle vincite.
    const step = Math.floor((now || 0) / 900) % 5;
    b({ u0: 0.12, v0: 0.16, u1: 0.88, v1: 0.84, z1: 32, color: '#1b2350', left: '#232d66', right: '#141a3c' });
    b({ u0: 0.1, v0: 0.14, u1: 0.9, v1: 0.86, z0: 32, z1: 35, color: '#d4a537' });
    b({ u0: 0.14, v0: 0.3, u1: 0.86, v1: 0.84, z0: 35, z1: 80, color: '#232d66', left: '#2b3780', right: '#141a3c' });
    b({ u0: 0.12, v0: 0.28, u1: 0.88, v1: 0.86, z0: 80, z1: 86, color: '#d4a537', glow: true });
    front(() => {
      d(0.18, 0.84, 76, '#0b3d1e', 22, 34);
      // Tabella delle vincite in alto, cinque carte in basso (una "tenuta" si illumina).
      for (let i = 0; i < 4; i += 1) d(0.2, 0.84, 73 - i * 3, '#fde68a', 14 - i * 2, 1);
      for (let i = 0; i < 5; i += 1) {
        d(0.2 + i * 0.13, 0.84, 58, i === step ? '#fff7d1' : '#ffffff', 3, 6);
        d(0.21 + i * 0.13, 0.84, 56, i % 2 ? '#ef4444' : '#111018', 1, 2);
      }
      d(0.2, 0.84, 46, '#22c55e', 20, 2);
      for (let i = 0; i < 5; i += 1) d(0.2 + i * 0.13, 0.84, 40, '#fbbf24', 3, 2);
    });
  },
  roulette_table(b, { c, d, now }) {
    // Tavolo della roulette 3x2: panno verde con il tappeto delle puntate rosse e nere, la ruota
    // in mogano a sinistra che gira, bordo imbottito nero.
    [[0.2, 0.25], [0.2, 1.6], [2.65, 0.25], [2.65, 1.6]].forEach(([u, v]) => b({ u0: u, v0: v, u1: u + 0.14, v1: v + 0.14, z1: 28, color: '#2a140c', tex: 'wood' }));
    b({ u0: 0.08, v0: 0.12, u1: 2.92, v1: 1.88, z0: 28, z1: 36, color: '#4a2511', tex: 'wood' });
    b({ u0: 0.06, v0: 0.1, u1: 2.94, v1: 1.9, z0: 36, z1: 38, color: '#111018' });
    b({ u0: 0.14, v0: 0.18, u1: 2.86, v1: 1.82, z0: 38, z1: 38, color: '#0d6b34', tex: 'fabric' });
    // Tappeto delle puntate: tre file di numeri rossi e neri, lo zero verde in testa.
    for (let col = 0; col < 12; col += 1) {
      for (let row = 0; row < 3; row += 1) {
        const n = col * 3 + row + 1;
        const red = RED_NUMBERS.includes(n);
        b({ u0: 1.2 + col * 0.13, v0: 0.4 + row * 0.38, u1: 1.31 + col * 0.13, v1: 0.75 + row * 0.38, z0: 38, z1: 38, color: red ? '#b91c1c' : '#111018' });
      }
    }
    b({ u0: 1.04, v0: 0.4, u1: 1.17, v1: 1.51, z0: 38, z1: 38, color: '#15803d' });
    // Ruota: catino di mogano, cerchio dei numeri, piatto che gira con la croce dorata.
    c({ u: 0.58, v: 0.98, r: 0.46, z0: 38, z1: 44, color: '#5c2e15', top: '#3f1d0b', tex: 'wood' });
    c({ u: 0.58, v: 0.98, r: 0.38, z0: 44, z1: 44, color: '#111018', top: '#111018' });
    const turn = ((Math.floor((now || 0) / 120) % 24) / 24) * Math.PI * 2;
    for (let i = 0; i < 18; i += 1) {
      const a = turn + (i / 18) * Math.PI * 2;
      d(0.58 + Math.cos(a) * 0.32, 0.98 + Math.sin(a) * 0.32, 44, i % 2 ? '#b91c1c' : '#111018', 3, 1);
    }
    c({ u: 0.58, v: 0.98, r: 0.2, z0: 44, z1: 46, color: '#7a4a24', top: '#9a6232' });
    c({ u: 0.58, v: 0.98, r: 0.04, z0: 46, z1: 52, color: '#d4a537', top: '#fde68a' });
    d(0.58 + Math.cos(-turn * 2) * 0.36, 0.98 + Math.sin(-turn * 2) * 0.36, 45, '#ffffff', 2, 2);
    // Pile di fiches del croupier.
    ['#ffffff', '#ef4444', '#16a34a', '#111018'].forEach((color, i) => c({ u: 2.4 + (i % 2) * 0.16, v: 0.36 + Math.floor(i / 2) * 0.18, r: 0.07, z0: 38, z1: 44, color, top: color }));
  },
  blackjack_table(b, { c, d }) {
    // Tavolo del blackjack 3x2: mezzaluna di panno verde con l'arco dorato, i posti con le carte,
    // il sabot e il rack delle fiches del banco.
    [[0.3, 0.3], [0.3, 1.5], [2.55, 0.3], [2.55, 1.5]].forEach(([u, v]) => b({ u0: u, v0: v, u1: u + 0.14, v1: v + 0.14, z1: 28, color: '#2a140c', tex: 'wood' }));
    b({ u0: 0.08, v0: 0.12, u1: 2.92, v1: 1.88, z0: 28, z1: 35, color: '#4a2511', tex: 'wood' });
    b({ u0: 0.06, v0: 1.62, u1: 2.94, v1: 1.92, z0: 35, z1: 38, color: '#111018' });
    b({ u0: 0.14, v0: 0.18, u1: 2.86, v1: 1.62, z0: 35, z1: 35, color: '#0d6b34', tex: 'fabric' });
    for (let i = 0; i < 24; i += 1) {
      const a = Math.PI * (0.1 + 0.8 * (i / 23));
      d(1.5 - Math.cos(a) * 1.05, 0.55 + Math.sin(a) * 0.62, 35, '#d4a537', 2, 1);
    }
    for (let i = 0; i < 5; i += 1) {
      const a = Math.PI * (0.18 + 0.64 * (i / 4));
      const u = 1.5 - Math.cos(a) * 1.15;
      const v = 0.55 + Math.sin(a) * 0.82;
      b({ u0: u - 0.07, v0: v - 0.05, u1: u + 0.07, v1: v + 0.05, z0: 35, z1: 35, color: '#f8f5ec' });
      d(u - 0.02, v, 35, i % 2 ? '#b91c1c' : '#111018', 1, 1);
      c({ u: u + 0.12, v: v + 0.02, r: 0.05, z0: 35, z1: 38 + (i % 3) * 2, color: ['#ef4444', '#16a34a', '#111018'][i % 3] });
    }
    b({ u0: 1.1, v0: 0.22, u1: 1.9, v1: 0.42, z0: 35, z1: 38, color: '#2a140c' });
    ['#ffffff', '#ef4444', '#16a34a', '#111018', '#7c3aed'].forEach((color, i) => b({ u0: 1.14 + i * 0.15, v0: 0.24, u1: 1.26 + i * 0.15, v1: 0.4, z0: 38, z1: 40, color }));
    b({ u0: 2.2, v0: 0.25, u1: 2.5, v1: 0.45, z0: 35, z1: 42, color: '#111018', top: '#1f2937' });
  },
  baccarat_table(b, { c, d }) {
    // Tavolo del baccarat 3x2: panno bordeaux con i riquadri di PUNTO (blu), BANCO (rosso) e
    // PAREGGIO (verde) per ogni posto, la scatola delle carte e le fiches.
    [[0.3, 0.3], [0.3, 1.5], [2.55, 0.3], [2.55, 1.5]].forEach(([u, v]) => b({ u0: u, v0: v, u1: u + 0.14, v1: v + 0.14, z1: 28, color: '#2a140c', tex: 'wood' }));
    b({ u0: 0.08, v0: 0.12, u1: 2.92, v1: 1.88, z0: 28, z1: 35, color: '#4a2511', tex: 'wood' });
    b({ u0: 0.06, v0: 0.1, u1: 2.94, v1: 1.9, z0: 35, z1: 37, color: '#d4a537' });
    b({ u0: 0.14, v0: 0.18, u1: 2.86, v1: 1.82, z0: 37, z1: 37, color: '#6b0f1d', tex: 'fabric' });
    for (let i = 0; i < 4; i += 1) {
      const u = 0.35 + i * 0.6;
      b({ u0: u, v0: 1.12, u1: u + 0.42, v1: 1.28, z0: 37, z1: 37, color: '#1d4ed8' });
      b({ u0: u, v0: 1.32, u1: u + 0.42, v1: 1.48, z0: 37, z1: 37, color: '#b91c1c' });
      b({ u0: u + 0.12, v0: 0.92, u1: u + 0.3, v1: 1.06, z0: 37, z1: 37, color: '#15803d' });
      c({ u: u + 0.21, v: 1.6, r: 0.05, z0: 37, z1: 41, color: i % 2 ? '#111018' : '#f8f5ec' });
    }
    b({ u0: 1.3, v0: 0.3, u1: 1.7, v1: 0.5, z0: 37, z1: 37, color: '#f8f5ec' });
    b({ u0: 1.36, v0: 0.33, u1: 1.48, v1: 0.47, z0: 37, z1: 37, color: '#ffffff' });
    d(1.4, 0.4, 37, '#b91c1c', 1, 1);
    b({ u0: 2.2, v0: 0.25, u1: 2.5, v1: 0.45, z0: 37, z1: 44, color: '#111018', top: '#1f2937' });
  },
  craps_table(b, { c, d, now }) {
    // Tavolo dei dadi 3x2: vasca con le sponde alte, panno verde con la "pass line" gialla, i
    // riquadri dei punti e due dadi che rotolano.
    const step = Math.floor((now || 0) / 500) % 6;
    [[0.2, 0.25], [0.2, 1.6], [2.65, 0.25], [2.65, 1.6]].forEach(([u, v]) => b({ u0: u, v0: v, u1: u + 0.14, v1: v + 0.14, z1: 26, color: '#2a140c', tex: 'wood' }));
    b({ u0: 0.06, v0: 0.1, u1: 2.94, v1: 1.9, z0: 26, z1: 30, color: '#4a2511', tex: 'wood' });
    b({ u0: 0.14, v0: 0.18, u1: 2.86, v1: 1.82, z0: 30, z1: 30, color: '#0d6b34', tex: 'fabric' });
    b({ u0: 0.06, v0: 0.1, u1: 2.94, v1: 0.18, z0: 30, z1: 42, color: '#111018' });
    b({ u0: 0.06, v0: 0.1, u1: 0.14, v1: 1.9, z0: 30, z1: 42, color: '#111018' });
    b({ u0: 2.86, v0: 0.1, u1: 2.94, v1: 1.9, z0: 30, z1: 42, color: '#111018' });
    b({ u0: 0.3, v0: 1.55, u1: 2.7, v1: 1.65, z0: 30, z1: 30, color: '#facc15' });
    for (let i = 0; i < 6; i += 1) b({ u0: 0.55 + i * 0.32, v0: 0.4, u1: 0.8 + i * 0.32, v1: 0.62, z0: 30, z1: 30, color: '#f8f5ec' });
    b({ u0: 1.2, v0: 0.9, u1: 1.8, v1: 1.2, z0: 30, z1: 30, color: '#b91c1c' });
    const du = 1.1 + (step % 3) * 0.25;
    b({ u0: du, v0: 1.25, u1: du + 0.1, v1: 1.35, z0: 30, z1: 33, color: '#f8f5ec' });
    b({ u0: du + 0.16, v0: 1.3, u1: du + 0.26, v1: 1.4, z0: 30, z1: 33, color: '#f8f5ec' });
    d(du + 0.04, 1.3, 33, '#b91c1c', 1, 1);
    d(du + 0.2, 1.35, 33, '#b91c1c', 1, 1);
    c({ u: 2.5, v: 0.45, r: 0.06, z0: 30, z1: 36, color: '#ef4444' });
    c({ u: 2.65, v: 0.45, r: 0.06, z0: 30, z1: 34, color: '#16a34a' });
  },
  casino_cashier(b, { c, d, front }) {
    // Cassa delle fiches 2x1: bancone in mogano e oro, vetro, fiches incolonnate.
    b({ u0: 0.05, v0: 0.2, u1: 1.95, v1: 0.9, z1: 38, color: '#4a2511', left: '#5c2e15', right: '#2e170a', tex: 'wood' });
    b({ u0: 0.02, v0: 0.16, u1: 1.98, v1: 0.94, z0: 38, z1: 42, color: '#d4a537' });
    b({ u0: 0.05, v0: 0.2, u1: 1.95, v1: 0.3, z0: 42, z1: 86, color: 'rgba(191, 227, 255, 0.35)', left: 'rgba(191, 227, 255, 0.35)' });
    b({ u0: 0.02, v0: 0.16, u1: 1.98, v1: 0.34, z0: 86, z1: 94, color: '#d4a537', glow: true });
    ['#ffffff', '#ef4444', '#16a34a', '#111018', '#7c3aed', '#facc15'].forEach((color, i) => c({ u: 0.25 + i * 0.28, v: 0.62, r: 0.08, z0: 42, z1: 50 + (i % 3) * 4, color, top: color }));
    front(() => {
      for (let i = 0; i < 10; i += 1) d(0.1 + i * 0.18, 0.9, 20, i % 2 ? '#d4a537' : '#fde68a', 3, 2);
      d(0.7, 0.9, 32, '#7a0f1c', 18, 5);
    });
  },
  poker_table(b, { c, d }) {
    // Tavolo del Texas Hold'em 4x2: ovale con il bordo imbottito nero, la fascia di legno, il panno
    // verde, le cinque carte comuni al centro, le fiches davanti ai sei posti e il bottone del mazziere.
    [[0.5, 0.45], [0.5, 1.4], [3.35, 0.45], [3.35, 1.4], [1.9, 0.3], [1.9, 1.55]].forEach(([u, v]) => b({ u0: u, v0: v, u1: u + 0.14, v1: v + 0.14, z1: 26, color: '#2a140c', tex: 'wood' }));
    c({ u: 1.0, v: 1.0, r: 0.92, z0: 26, z1: 34, color: '#4a2511', top: '#5c2e15', tex: 'wood' });
    c({ u: 3.0, v: 1.0, r: 0.92, z0: 26, z1: 34, color: '#4a2511', top: '#5c2e15', tex: 'wood' });
    b({ u0: 1.0, v0: 0.08, u1: 3.0, v1: 1.92, z0: 26, z1: 34, color: '#4a2511', tex: 'wood' });
    c({ u: 1.0, v: 1.0, r: 0.86, z0: 34, z1: 36, color: '#111018', top: '#111018' });
    c({ u: 3.0, v: 1.0, r: 0.86, z0: 34, z1: 36, color: '#111018', top: '#111018' });
    b({ u0: 1.0, v0: 0.14, u1: 3.0, v1: 1.86, z0: 34, z1: 36, color: '#111018' });
    c({ u: 1.0, v: 1.0, r: 0.72, z0: 36, z1: 36, color: '#0d6b34', top: '#0d6b34' });
    c({ u: 3.0, v: 1.0, r: 0.72, z0: 36, z1: 36, color: '#0d6b34', top: '#0d6b34' });
    b({ u0: 1.0, v0: 0.28, u1: 3.0, v1: 1.72, z0: 36, z1: 36, color: '#0d6b34', tex: 'fabric' });
    // Riga dorata del tavolo e le cinque carte comuni.
    for (let i = 0; i < 30; i += 1) d(0.6 + i * 0.095, 1.0 + Math.sin(i / 4.6) * 0.05 - 0.38, 36, '#d4a537', 2, 1);
    for (let i = 0; i < 5; i += 1) {
      b({ u0: 1.45 + i * 0.24, v0: 0.86, u1: 1.63 + i * 0.24, v1: 1.12, z0: 36, z1: 36, color: '#fdfbf5' });
      d(1.5 + i * 0.24, 0.95, 36, i % 2 ? '#b91c1c' : '#111018', 2, 2);
    }
    // Fiches davanti ai posti.
    [[0.55, 1.0, '#ef4444'], [1.4, 0.45, '#16a34a'], [2.6, 0.45, '#111018'], [3.45, 1.0, '#7c3aed'], [2.6, 1.55, '#ffffff'], [1.4, 1.55, '#facc15']]
      .forEach(([u, v, color]) => c({ u, v, r: 0.07, z0: 36, z1: 40, color, top: color }));
    // Bottone del mazziere.
    c({ u: 3.2, v: 1.35, r: 0.06, z0: 36, z1: 37, color: '#fdfbf5', top: '#fdfbf5' });
    d(3.19, 1.35, 37, '#111018', 1, 1);
  },
  bingo_table(b, { c, d, now }) {
    // Banco del Bingo 3x2: mobile rosso e oro con il tabellone luminoso dei numeri sul davanti, la
    // gabbia delle palline che gira in cima e le cartelle sul piano.
    const step = Math.floor((now || 0) / 200) % 8;
    b({ u0: 0.1, v0: 0.15, u1: 2.9, v1: 1.85, z1: 32, color: '#7a0f1c', left: '#8f1424', right: '#5a0a14' });
    b({ u0: 0.06, v0: 0.1, u1: 2.94, v1: 1.9, z0: 32, z1: 36, color: '#d4a537' });
    b({ u0: 0.14, v0: 0.18, u1: 2.86, v1: 1.82, z0: 36, z1: 36, color: '#0d6b34', tex: 'fabric' });
    // Tabellone sul fianco davanti: file di lucine accese e spente.
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 14; col += 1) {
        const on = (row * 14 + col + step * 3) % 5 === 0;
        d(0.25 + col * 0.18, 1.85, 26 - row * 6, on ? '#fde68a' : '#3d0710', 3, 3);
      }
    }
    // Cartelle sul piano.
    [[0.4, 0.5], [0.95, 1.1], [1.9, 0.45]].forEach(([u, v]) => {
      b({ u0: u, v0: v, u1: u + 0.5, v1: v + 0.3, z0: 36, z1: 36, color: '#fdfbf5' });
      for (let i = 0; i < 4; i += 1) d(u + 0.06 + i * 0.11, v + 0.12, 36, '#c1121f', 2, 2);
    });
    // Gabbia delle palline: supporto dorato e sfera di fili che gira.
    c({ u: 2.35, v: 1.2, r: 0.05, z0: 36, z1: 52, color: '#d4a537', tex: 'metal' });
    c({ u: 2.35, v: 1.2, r: 0.32, z0: 52, z1: 74, color: 'rgba(255, 255, 255, 0.12)', top: 'rgba(255, 255, 255, 0.18)' });
    const colors = ['#ef4444', '#fbbf24', '#22c55e', '#3b82f6', '#a855f7', '#f97316'];
    for (let i = 0; i < 6; i += 1) {
      const a = ((i + step) / 8) * Math.PI * 2;
      d(2.35 + Math.cos(a) * 0.2, 1.2 + Math.sin(a) * 0.2, 58 + (i % 3) * 4, colors[i], 3, 3);
    }
    for (let i = 0; i < 8; i += 1) {
      const a = ((i + step * 0.5) / 8) * Math.PI * 2;
      d(2.35 + Math.cos(a) * 0.32, 1.2 + Math.sin(a) * 0.32, 63, '#d4a537', 2, 2);
    }
    // Pallina appena uscita sullo scivolo.
    c({ u: 1.85, v: 1.45, r: 0.07, z0: 36, z1: 40, color: '#fdfbf5', top: '#fdfbf5' });
    d(1.84, 1.45, 40, '#c1121f', 1, 1);
  },
  building: drawBuilding,
  stock_board(b, { d, now }) {
    // Tabellone della borsa 4x1: schermo nero su due gambe, grafico a candele verdi e rosse che
    // scorre e il nastro delle quotazioni in basso.
    const step = Math.floor((now || 0) / 400) % 8;
    [0.3, 3.7].forEach((u) => b({ u0: u - 0.08, v0: 0.35, u1: u + 0.08, v1: 0.55, z1: 30, color: '#1f2937', tex: 'metal' }));
    b({ u0: 0.05, v0: 0.4, u1: 3.95, v1: 0.6, z0: 30, z1: 96, color: '#0b1020', left: '#111827', right: '#030712' });
    b({ u0: 0.02, v0: 0.38, u1: 3.98, v1: 0.62, z0: 96, z1: 99, color: '#d4a537' });
    let level = 62;
    for (let k = 0; k < 18; k += 1) {
      const up = ((k * 7 + step * 3) % 5) > 1;
      const h = 4 + ((k * 13 + step) % 9);
      level = Math.max(44, Math.min(84, level + (up ? 2 : -2)));
      const u = 0.25 + k * 0.2;
      d(u, 0.62, level + h, up ? '#22c55e' : '#ef4444', 3, h);
      d(u + 0.03, 0.62, level + h + 2, up ? '#86efac' : '#fca5a5', 1, h + 4);
    }
    // Nastro delle quotazioni.
    b({ u0: 0.1, v0: 0.6, u1: 3.9, v1: 0.62, z0: 32, z1: 40, color: '#111827' });
    for (let k = 0; k < 14; k += 1) d(0.2 + ((k * 0.27 + step * 0.1) % 3.6), 0.63, 38, k % 3 ? '#22c55e' : '#fbbf24', 5, 2);
  },
  trading_desk(b, { d, now }) {
    // Postazione 2x1: scrivania scura con tre monitor (grafici, numeri) e la tastiera.
    const blink = Math.floor((now || 0) / 500) % 4;
    b({ u0: 0.05, v0: 0.15, u1: 1.95, v1: 0.85, z1: 26, color: '#1f2937', left: '#111827', right: '#0b1020', tex: 'wood' });
    [0.3, 0.85, 1.4].forEach((u, i) => {
      b({ u0: u, v0: 0.2, u1: u + 0.45, v1: 0.3, z0: 30, z1: 50, color: '#0b1020' });
      d(u + 0.1, 0.31, 46 - ((i + blink) % 3) * 3, i === blink % 3 ? '#ef4444' : '#22c55e', 8, 2);
      d(u + 0.1, 0.31, 40, '#38bdf8', 10, 1);
      d(u + 0.1, 0.31, 36, '#fbbf24', 6, 1);
      b({ u0: u + 0.18, v0: 0.22, u1: u + 0.27, v1: 0.28, z0: 26, z1: 30, color: '#374151' });
    });
    b({ u0: 0.6, v0: 0.5, u1: 1.4, v1: 0.65, z0: 26, z1: 28, color: '#374151' });
    d(1.7, 0.55, 28, '#e5e7eb', 3, 2);
  },
  office_desk(b, { d }) {
    // Scrivania da ufficio 2x1: piano chiaro, cassettiera, monitor, pile di fogli e una tazza.
    b({ u0: 0.05, v0: 0.15, u1: 1.95, v1: 0.85, z0: 22, z1: 26, color: '#e5e7eb' });
    b({ u0: 0.1, v0: 0.2, u1: 0.6, v1: 0.8, z1: 22, color: '#9ca3af', tex: 'metal' });
    b({ u0: 1.85, v0: 0.2, u1: 1.9, v1: 0.8, z1: 22, color: '#6b7280' });
    b({ u0: 0.8, v0: 0.25, u1: 1.3, v1: 0.33, z0: 26, z1: 44, color: '#111827' });
    d(0.9, 0.34, 40, '#60a5fa', 10, 6);
    b({ u0: 1.45, v0: 0.4, u1: 1.75, v1: 0.6, z0: 26, z1: 31, color: '#f8fafc' });
    d(0.4, 0.6, 28, '#b45309', 3, 3);
  },
  office_chair(b, { c }) {
    // Sedia girevole nera con le ruote.
    c({ u: 0.5, v: 0.5, r: 0.04, z0: 2, z1: 16, color: '#4b5563' });
    c({ u: 0.5, v: 0.5, r: 0.3, z0: 0, z1: 2, color: '#111827' });
    b({ u0: 0.22, v0: 0.22, u1: 0.78, v1: 0.78, z0: 16, z1: 20, color: '#111827', tex: 'fabric' });
    b({ u0: 0.22, v0: 0.18, u1: 0.78, v1: 0.28, z0: 20, z1: 40, color: '#1f2937', tex: 'fabric' });
  },
  elevator(b, { d, now }) {
    // Ascensore 2x1: porte d'acciaio, cornice dorata, display del piano e i pulsanti.
    const floor = Math.floor((now || 0) / 1000) % 4;
    b({ u0: 0.05, v0: 0.3, u1: 1.95, v1: 0.7, z1: 92, color: '#d4a537', left: '#b8892a', right: '#8a6416' });
    b({ u0: 0.25, v0: 0.68, u1: 1.0, v1: 0.72, z0: 0, z1: 76, color: '#cbd5e1', left: '#cbd5e1', tex: 'metal' });
    b({ u0: 1.0, v0: 0.68, u1: 1.75, v1: 0.72, z0: 0, z1: 76, color: '#94a3b8', left: '#94a3b8', tex: 'metal' });
    b({ u0: 0.7, v0: 0.69, u1: 1.3, v1: 0.73, z0: 80, z1: 88, color: '#111827' });
    d(0.95, 0.74, 86, '#ef4444', 6, 5);
    d(1.05 + floor * 0.04, 0.74, 84, '#fbbf24', 2, 2);
    d(1.85, 0.72, 40, '#fde68a', 3, 3);
    d(1.85, 0.72, 34, '#fde68a', 3, 3);
  },
  board_table(b, { c }) {
    // Tavolo del consiglio 4x2: legno lucido scuro con il bordo, cartelline e bottiglie d'acqua.
    b({ u0: 0.1, v0: 0.2, u1: 3.9, v1: 1.8, z0: 24, z1: 28, color: '#3f2a14', tex: 'wood' });
    [[0.6, 1], [3.4, 1]].forEach(([u, v]) => c({ u, v, r: 0.2, z0: 0, z1: 24, color: '#1f130a' }));
    b({ u0: 0.2, v0: 0.3, u1: 3.8, v1: 1.7, z0: 28, z1: 28, color: '#5b3a1e' });
    [0.8, 1.6, 2.4, 3.2].forEach((u) => {
      b({ u0: u - 0.15, v0: 0.35, u1: u + 0.15, v1: 0.55, z0: 28, z1: 29, color: '#f8fafc' });
      b({ u0: u - 0.15, v0: 1.45, u1: u + 0.15, v1: 1.65, z0: 28, z1: 29, color: '#f8fafc' });
      c({ u, v: 1, r: 0.05, z0: 28, z1: 38, color: 'rgba(186, 230, 253, 0.8)' });
    });
  },
  ceo_desk(b, { d }) {
    // Scrivania del dirigente 3x1: mogano con il piano di pelle, lampada verde e monitor.
    b({ u0: 0.05, v0: 0.1, u1: 2.95, v1: 0.9, z1: 28, color: '#5b2a0e', left: '#7c3a16', right: '#3f1d0a', tex: 'wood' });
    b({ u0: 0.3, v0: 0.2, u1: 2.7, v1: 0.8, z0: 28, z1: 28, color: '#14532d' });
    b({ u0: 1.2, v0: 0.2, u1: 1.8, v1: 0.3, z0: 28, z1: 48, color: '#111827' });
    d(1.3, 0.31, 44, '#22c55e', 10, 2);
    d(1.3, 0.31, 38, '#ef4444', 6, 2);
    b({ u0: 0.4, v0: 0.3, u1: 0.5, v1: 0.4, z0: 28, z1: 40, color: '#d4a537' });
    b({ u0: 0.3, v0: 0.25, u1: 0.6, v1: 0.45, z0: 40, z1: 44, color: '#15803d' });
    d(2.4, 0.6, 30, '#d4a537', 4, 2);
  },
  bull_statue(b, { c }) {
    // Toro di bronzo di Wall Street 2x2 sul piedistallo di granito, a testa bassa.
    b({ u0: 0.1, v0: 0.3, u1: 1.9, v1: 1.7, z1: 12, color: '#6b7280', tex: 'stone' });
    b({ u0: 0.3, v0: 0.7, u1: 1.5, v1: 1.3, z0: 22, z1: 40, color: '#8a5a2b', left: '#a16b34', right: '#6b4423', tex: 'metal' });
    [[0.4, 0.75], [0.4, 1.25], [1.35, 0.75], [1.35, 1.25]].forEach(([u, v]) => b({ u0: u - 0.06, v0: v - 0.06, u1: u + 0.06, v1: v + 0.06, z0: 12, z1: 24, color: '#6b4423' }));
    b({ u0: 1.45, v0: 0.85, u1: 1.8, v1: 1.15, z0: 18, z1: 34, color: '#8a5a2b', tex: 'metal' });
    c({ u: 1.7, v: 0.78, r: 0.04, z0: 32, z1: 42, color: '#d4a537' });
    c({ u: 1.7, v: 1.22, r: 0.04, z0: 32, z1: 42, color: '#d4a537' });
    b({ u0: 0.2, v0: 0.95, u1: 0.32, v1: 1.05, z0: 30, z1: 46, color: '#6b4423' });
  },
  filing_cabinet(b, { d }) {
    // Archivio d'ufficio grigio a quattro cassetti.
    b({ u0: 0.15, v0: 0.15, u1: 0.85, v1: 0.85, z1: 52, color: '#9ca3af', left: '#d1d5db', right: '#6b7280', tex: 'metal' });
    for (let k = 0; k < 4; k += 1) d(0.5, 0.86, 8 + k * 12, '#374151', 6, 2);
  },
  vault_door(b, { c, d }) {
    // Porta blindata 1x1 del Caveau: lastra d'acciaio rotonda con la ruota e i bulloni, nel telaio.
    b({ u0: 0.05, v0: 0.3, u1: 0.95, v1: 0.7, z1: 76, color: '#374151', left: '#4b5563', right: '#1f2937' });
    c({ u: 0.5, v: 0.72, r: 0.36, z0: 8, z1: 70, color: '#9ca3af', top: '#d1d5db', tex: 'metal' });
    c({ u: 0.5, v: 0.76, r: 0.16, z0: 32, z1: 46, color: '#d4a537', top: '#fde68a', tex: 'metal' });
    for (let k = 0; k < 6; k += 1) {
      const a = (k / 6) * Math.PI * 2;
      d(0.5 + Math.cos(a) * 0.28, 0.78, 39 + Math.sin(a) * 24, '#4b5563', 2, 2);
    }
    d(0.18, 0.72, 66, '#ef4444', 3, 3);
    d(0.82, 0.72, 66, '#22c55e', 3, 3);
  },
  vault_safe(b, { d, now }) {
    // Cassaforte 2x1: grossa, nera e oro, con la manopola della combinazione e la luce che lampeggia.
    const blink = Math.floor((now || 0) / 600) % 2;
    b({ u0: 0.08, v0: 0.12, u1: 1.92, v1: 0.92, z1: 64, color: '#111827', left: '#1f2937', right: '#030712', tex: 'metal' });
    b({ u0: 0.04, v0: 0.08, u1: 1.96, v1: 0.96, z0: 64, z1: 68, color: '#d4a537' });
    b({ u0: 0.2, v0: 0.92, u1: 1.8, v1: 0.94, z0: 8, z1: 58, color: '#1f2937' });
    d(0.6, 0.95, 36, '#d4a537', 12, 12);
    d(0.6, 0.95, 36, '#111827', 6, 6);
    d(1.3, 0.95, 40, '#d4a537', 4, 14);
    d(1.5, 0.95, 52, blink ? '#22c55e' : '#14532d', 3, 3);
    d(1.0, 0.95, 62, '#fde68a', 14, 2);
  },
  cash_pallet(b, { d }) {
    // Bancale 2x2 pieno di mazzette di banconote verdi con la fascetta, a strati.
    b({ u0: 0.1, v0: 0.1, u1: 1.9, v1: 1.9, z1: 6, color: '#a16207', left: '#854d0e', right: '#713f12', tex: 'wood' });
    for (let layer = 0; layer < 5; layer += 1) {
      const inset = 0.15 + layer * 0.05;
      b({ u0: inset, v0: inset, u1: 2 - inset, v1: 2 - inset, z0: 6 + layer * 8, z1: 14 + layer * 8, color: layer % 2 ? '#4d7c0f' : '#65a30d', left: '#3f6212', right: '#365314' });
      for (let k = 0; k < 4; k += 1) d(inset + 0.2 + k * 0.38, 2 - inset, 10 + layer * 8, '#fef3c7', 4, 2);
    }
    d(1, 1, 48, '#fde68a', 6, 2);
  },
  money_pile(b, { d }) {
    // Mazzette di banconote 1x1 impilate un po' storte, con le fascette bianche.
    [[0.2, 0.2, 0], [0.35, 0.3, 6], [0.25, 0.4, 12], [0.4, 0.25, 18]].forEach(([u, v, z], i) => {
      b({ u0: u, v0: v, u1: u + 0.45, v1: v + 0.3, z0: z, z1: z + 6, color: i % 2 ? '#4d7c0f' : '#65a30d', left: '#3f6212', right: '#365314' });
      d(u + 0.22, v + 0.3, z + 3, '#fef3c7', 2, 3);
    });
    d(0.5, 0.5, 26, '#fde68a', 3, 1);
  },
  gold_bars(b, { d, now }) {
    // Lingotti d'oro 1x1 a piramide, con un luccichio che passa.
    const shine = Math.floor((now || 0) / 250) % 8;
    const bar = (u, v, z) => b({ u0: u, v0: v, u1: u + 0.36, v1: v + 0.2, z0: z, z1: z + 7, color: '#facc15', left: '#eab308', right: '#ca8a04', top: '#fde047' });
    bar(0.12, 0.2, 0); bar(0.52, 0.2, 0); bar(0.12, 0.55, 0); bar(0.52, 0.55, 0);
    bar(0.32, 0.38, 7); bar(0.32, 0.6, 7);
    bar(0.32, 0.48, 14);
    if (shine < 3) d(0.3 + shine * 0.15, 0.5, 21, '#ffffff', 2, 2);
  },
  diamond_case(b, { c, d, now }) {
    // Teca 1x1: colonnina nera con il bordo d'oro, cuscino di velluto rosso e tre diamanti grandi
    // che brillano a turno, piu' quattro paletti d'oro agli angoli.
    const twinkle = Math.floor((now || 0) / 200) % 6;
    c({ u: 0.5, v: 0.5, r: 0.3, z0: 0, z1: 30, color: '#111827', top: '#1f2937', tex: 'metal' });
    c({ u: 0.5, v: 0.5, r: 0.32, z0: 28, z1: 31, color: '#d4a537', top: '#fde68a' });
    b({ u0: 0.26, v0: 0.26, u1: 0.74, v1: 0.74, z0: 31, z1: 35, color: '#991b1b', left: '#7f1d1d', right: '#7f1d1d' });
    [[0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]].forEach(([u, v]) => b({ u0: u - 0.03, v0: v - 0.03, u1: u + 0.03, v1: v + 0.03, z0: 31, z1: 50, color: '#d4a537' }));
    [[0.4, 0.42], [0.6, 0.48], [0.48, 0.62]].forEach(([u, v], i) => {
      // Diamante: punta in basso, corona azzurra, riflesso bianco.
      d(u, v, 37, '#0369a1', 4, 3);
      d(u, v, 40, '#7dd3fc', 7, 3);
      d(u, v, 43, '#e0f2fe', 5, 2);
      if (twinkle === i || twinkle === i + 3) {
        d(u, v, 49, '#ffffff', 1, 5);
        d(u, v, 47, '#ffffff', 5, 1);
      }
    });
  },
  chip_tower(b, { c, d }) {
    // Torri di fiches 1x1 di colori diversi, alte e basse.
    [[0.3, 0.3, '#dc2626', 40], [0.68, 0.32, '#111827', 28], [0.32, 0.68, '#2563eb', 22], [0.68, 0.68, '#16a34a', 34]].forEach(([u, v, color, h]) => {
      c({ u, v, r: 0.14, z0: 0, z1: h, color, top: color });
      for (let z = 3; z < h; z += 4) d(u, v + 0.14, z, '#ffffff', 3, 1);
    });
  },
  tobacco_counter(b, { d }) {
    // Bancone del tabaccaio 3x1: legno scuro, piano di vetro e dietro l'espositore delle sigarette
    // con i pacchetti colorati in fila, l'insegna "T" bianca e blu dei tabacchi.
    b({ u0: 0.05, v0: 0.2, u1: 2.95, v1: 0.95, z1: 30, color: '#4a2612', left: '#5b3a1e', right: '#3b2414' });
    b({ u0: 0.02, v0: 0.18, u1: 2.98, v1: 0.97, z0: 30, z1: 32, color: 'rgba(186, 230, 253, 0.6)' });
    b({ u0: 0.1, v0: 0.02, u1: 2.9, v1: 0.16, z0: 0, z1: 62, color: '#3b2414', left: '#4a2612', right: '#2b1d12' });
    const packs = ['#dc2626', '#f8fafc', '#facc15', '#2563eb', '#16a34a', '#111827', '#ea580c'];
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 13; col += 1) d(0.22 + col * 0.205, 0.16, 56 - row * 7, packs[(col + row * 3) % packs.length], 3, 4);
    }
    b({ u0: 1.25, v0: 0.04, u1: 1.75, v1: 0.14, z0: 64, z1: 76, color: '#1e3a8a' });
    d(1.5, 0.15, 72, '#ffffff', 2, 8);
    d(1.5, 0.15, 75, '#ffffff', 6, 2);
    // Accendini e un sigaro sul bancone.
    [0.5, 0.7, 0.9].forEach((u, i) => d(u, 0.6, 33, ['#ef4444', '#22c55e', '#3b82f6'][i], 2, 3));
    b({ u0: 2.1, v0: 0.5, u1: 2.55, v1: 0.6, z0: 32, z1: 34, color: '#7c4a24' });
  },
  cigar_humidor(b, { d }) {
    // Teca dei sigari 1x1: mobiletto di legno con l'anta di vetro e le scatole dentro.
    b({ u0: 0.12, v0: 0.12, u1: 0.88, v1: 0.88, z1: 58, color: '#5b3a1e', left: '#7c4a24', right: '#4a2612' });
    b({ u0: 0.18, v0: 0.86, u1: 0.82, v1: 0.9, z0: 6, z1: 52, color: 'rgba(186, 230, 253, 0.35)' });
    for (let k = 0; k < 4; k += 1) d(0.5, 0.89, 46 - k * 11, k % 2 ? '#a16207' : '#ca8a04', 9, 4);
    d(0.5, 0.89, 54, '#fde68a', 6, 1);
  },
  weed_counter(b, { d }) {
    // Bancone del Green Shop 3x1: legno chiaro dipinto di verde, giallo e rosso, i barattoli di
    // vetro con l'erba sul piano e dietro la mensola con i bong colorati.
    b({ u0: 0.05, v0: 0.2, u1: 2.95, v1: 0.95, z1: 30, color: '#166534', left: '#15803d', right: '#14532d' });
    b({ u0: 0.05, v0: 0.94, u1: 2.95, v1: 0.96, z0: 8, z1: 12, color: '#facc15' });
    b({ u0: 0.05, v0: 0.94, u1: 2.95, v1: 0.96, z0: 14, z1: 18, color: '#dc2626' });
    b({ u0: 0.02, v0: 0.18, u1: 2.98, v1: 0.97, z0: 30, z1: 32, color: '#d6b98c' });
    [0.4, 0.95, 1.5, 2.05, 2.6].forEach((u) => {
      b({ u0: u - 0.12, v0: 0.45, u1: u + 0.12, v1: 0.65, z0: 32, z1: 44, color: 'rgba(224, 242, 254, 0.55)' });
      d(u, 0.62, 38, '#4d7c0f', 4, 4);
      d(u, 0.62, 45, '#111827', 4, 1);
    });
    b({ u0: 0.1, v0: 0.02, u1: 2.9, v1: 0.16, z0: 44, z1: 46, color: '#d6b98c' });
    ['#22c55e', '#a855f7', '#0ea5e9', '#f97316', '#ec4899'].forEach((color, i) => {
      const u = 0.35 + i * 0.55;
      b({ u0: u - 0.06, v0: 0.06, u1: u + 0.06, v1: 0.12, z0: 46, z1: 66, color: 'rgba(255, 255, 255, 0.25)' });
      d(u, 0.13, 50, color, 4, 6);
    });
  },
  weed_plant(b, { d, now }) {
    // Pianta di canapa 1x1 in vaso: fusto e foglie a sette punte che ondeggiano piano.
    const sway = Math.sin((now || 0) / 900) * 0.03;
    b({ u0: 0.3, v0: 0.3, u1: 0.7, v1: 0.7, z1: 14, color: '#9a3412', left: '#b45309', right: '#7c2d12' });
    b({ u0: 0.33, v0: 0.33, u1: 0.67, v1: 0.67, z0: 14, z1: 14, color: '#3f2a14' });
    b({ u0: 0.47, v0: 0.47, u1: 0.53, v1: 0.53, z0: 14, z1: 58, color: '#3f6212' });
    for (let level = 0; level < 4; level += 1) {
      const z = 26 + level * 9;
      const spread = 0.3 - level * 0.05;
      for (let k = 0; k < 7; k += 1) {
        const a = (k / 7) * Math.PI * 2 + level;
        d(0.5 + Math.cos(a) * spread + sway, 0.5 + Math.sin(a) * spread * 0.6, z, k % 2 ? '#16a34a' : '#22c55e', 3, 2);
      }
    }
    d(0.5 + sway, 0.5, 62, '#15803d', 3, 3);
  },
  horse_track(b, { c, d, now }) {
    // Ippodromo 4x2: la corsa dei cavalli in miniatura dei vecchi casino. Mobile di legno con la
    // pista d'erba e le corsie, i cavallini colorati che avanzano, il tabellone delle quote dietro.
    const step = Math.floor((now || 0) / 180) % 16;
    b({ u0: 0.1, v0: 0.1, u1: 3.9, v1: 1.9, z1: 28, color: '#3a1d0e', left: '#4a2612', right: '#2a1408' });
    b({ u0: 0.05, v0: 0.05, u1: 3.95, v1: 1.95, z0: 28, z1: 31, color: '#d4a537' });
    b({ u0: 0.15, v0: 0.5, u1: 3.85, v1: 1.85, z0: 31, z1: 31, color: '#1f7a3a', tex: 'fabric' });
    // Corsie e traguardo a scacchi.
    for (let lane = 1; lane < 6; lane += 1) b({ u0: 0.2, v0: 0.5 + lane * 0.22, u1: 3.8, v1: 0.51 + lane * 0.22, z0: 31, z1: 31, color: '#f6ecd2' });
    for (let k = 0; k < 6; k += 1) d(3.55, 0.6 + k * 0.22, 31, k % 2 ? '#111' : '#fff', 2, 2);
    const silks = ['#dc2626', '#2563eb', '#facc15', '#7c3aed', '#ea580c', '#22c55e'];
    silks.forEach((color, lane) => {
      const u = 0.35 + (((step * (3 + (lane % 3)) + lane * 5) % 32) / 32) * 3.1;
      const v = 0.61 + lane * 0.22;
      b({ u0: u, v0: v - 0.05, u1: u + 0.22, v1: v + 0.05, z0: 31, z1: 36, color: '#5b3a1e' });
      d(u + 0.18, v, 39, '#5b3a1e', 2, 2);
      d(u + 0.08, v, 40, color, 3, 3);
    });
    // Tabellone delle quote sul retro, con le lucine che corrono.
    b({ u0: 0.3, v0: 0.12, u1: 3.7, v1: 0.42, z0: 31, z1: 62, color: '#111827', left: '#1f2937', right: '#0b1020' });
    b({ u0: 0.25, v0: 0.1, u1: 3.75, v1: 0.44, z0: 62, z1: 65, color: '#d4a537' });
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 16; col += 1) {
        const lit = (col + row * 5 + step) % 7 === 0;
        d(0.45 + col * 0.2, 0.43, 54 - row * 7, lit ? '#fde68a' : silks[(col + row) % silks.length], 2, 2);
      }
    }
    c({ u: 3.85, v: 1.8, r: 0.05, z0: 31, z1: 48, color: '#d4a537', tex: 'metal' });
    d(3.85, 1.8, 50, '#ef4444', 4, 3);
  },
  casino_rug(b, { d }) {
    b({ u0: 0.05, v0: 0.05, u1: 2.95, v1: 2.95, z1: 1, color: '#4e0912', tex: 'fabric' });
    b({ u0: 0.2, v0: 0.2, u1: 2.8, v1: 2.8, z0: 1, z1: 1, color: '#7a0f1c', tex: 'fabric' });
    for (let i = 0; i < 20; i += 1) d(0.2 + i * 0.13, 0.2, 1, '#d4a537', 2, 1);
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

  // ---- Tesoro del Caveau (vaultLoot.js): cresce con gli incassi da riscuotere.
  loot_coins(b, { d }) {
    // Monete d'oro sparse sul pavimento.
    [[0.25, 0.3], [0.55, 0.22], [0.7, 0.55], [0.35, 0.65], [0.5, 0.45], [0.8, 0.3], [0.2, 0.8], [0.62, 0.78]].forEach(([u, v], i) => {
      d(u, v, 0, '#b45309', 4, 2);
      d(u, v, 1, i % 3 ? '#facc15' : '#fde047', 3, 2);
    });
  },
  loot_cash(b, { d }) {
    // Banconote sparse e una mazzetta.
    [[0.25, 0.35, 0], [0.6, 0.25, 0], [0.45, 0.6, 0]].forEach(([u, v]) => {
      b({ u0: u - 0.14, v0: v - 0.07, u1: u + 0.14, v1: v + 0.07, z0: 0, z1: 1, color: '#65a30d' });
      d(u, v, 1, '#d9f99d', 3, 1);
    });
    b({ u0: 0.6, v0: 0.62, u1: 0.86, v1: 0.78, z0: 0, z1: 4, color: '#4d7c0f', left: '#3f6212', right: '#365314' });
    d(0.73, 0.78, 2, '#fef3c7', 2, 3);
  },
  loot_gems(b, { d }) {
    // Gemme di colori diversi e qualche moneta.
    [['#38bdf8', 0.3, 0.35], ['#f43f5e', 0.62, 0.3], ['#22c55e', 0.45, 0.62], ['#a855f7', 0.75, 0.68]].forEach(([color, u, v]) => {
      d(u, v, 0, '#0f172a', 4, 3);
      d(u, v, 1, color, 3, 2);
      d(u, v, 3, '#ffffff', 1, 1);
    });
    d(0.2, 0.75, 1, '#facc15', 3, 2);
  },
  loot_heap_s(b, { d }) {
    lootHeap(b, d, 0.32, 10);
  },
  loot_heap_m(b, { d }) {
    lootHeap(b, d, 0.4, 20);
  },
  loot_heap_l(b, { d }) {
    lootHeap(b, d, 0.46, 34);
  },
  loot_bars(b) {
    // Pila di lingotti d'oro a strati incrociati.
    for (let layer = 0; layer < 4; layer += 1) {
      const z = layer * 6;
      for (let k = 0; k < 2; k += 1) {
        const off = 0.18 + k * 0.34;
        if (layer % 2) b({ u0: 0.15, v0: off, u1: 0.85, v1: off + 0.26, z0: z, z1: z + 6, color: '#facc15', left: '#eab308', right: '#ca8a04' });
        else b({ u0: off, v0: 0.15, u1: off + 0.26, v1: 0.85, z0: z, z1: z + 6, color: '#facc15', left: '#eab308', right: '#ca8a04' });
      }
    }
  },
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

  comic_shelf(b, { d, front }) {
    // Scaffale del negozio: tre ripiani con gli albi girati in avanti, copertine colorate.
    b({ u0: 0.08, v0: 0.2, u1: 0.92, v1: 0.8, z1: 104, color: '#5b3a29', tex: 'wood' });
    front(() => {
      const covers = ['#ef4444', '#3b82f6', '#facc15', '#22c55e', '#ec4899', '#f97316', '#a855f7', '#14b8a6'];
      [8, 40, 72].forEach((z, row) => {
        d(0.1, 0.8, z, '#3f2718', 30, 2);
        for (let i = 0; i < 3; i += 1) {
          const color = covers[(row * 3 + i) % covers.length];
          d(0.14 + i * 0.26, 0.8, z + 24, color, 7, 22);
          d(0.16 + i * 0.26, 0.8, z + 20, '#ffffff', 4, 3);
          d(0.16 + i * 0.26, 0.8, z + 10, '#1f2937', 5, 1);
        }
      });
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
  },
  // Palco del karaoke (2x2): pedana nera con il bordo di luci e l'asta del microfono.
  karaoke_stage(b, { c, d, now, front }) {
    b({ u0: 0.02, v0: 0.02, u1: 1.98, v1: 1.98, z1: 10, color: '#1c1830', left: '#231d3d', right: '#120f20', tex: 'metal' });
    b({ u0: 0.02, v0: 0.02, u1: 1.98, v1: 1.98, z0: 10, z1: 12, color: '#3b2f6b', glow: true });
    const step = Math.floor((now || 0) / 300) % 4;
    front(() => {
      for (let i = 0; i < 12; i += 1) d(0.08 + i * 0.16, 1.98, 7, (i + step) % 4 === 0 ? '#fde047' : (i % 2 ? '#ec4899' : '#22d3ee'), 4, 4);
    });
    // Asta e microfono.
    c({ u: 1.0, v: 1.2, r: 0.14, z0: 12, z1: 13, color: '#27272a' });
    c({ u: 1.0, v: 1.2, r: 0.025, z0: 13, z1: 50, color: '#a1a1aa', tex: 'metal' });
    c({ u: 1.0, v: 1.2, r: 0.06, z0: 50, z1: 58, color: '#3f3f46', top: '#71717a' });
  },
  // Paletto da pesca: un palo di legno con la canna appoggiata e un secchio.
  fishing_post(b, { c }) {
    c({ u: 0.5, v: 0.5, r: 0.12, z0: 0, z1: 44, color: '#8a5a3b', top: '#a8754f', tex: 'wood' });
    c({ u: 0.5, v: 0.5, r: 0.14, z0: 30, z1: 34, color: '#d6c3a1' });
    b({ u0: 0.56, v0: 0.46, u1: 0.98, v1: 0.52, z0: 38, z1: 40, color: '#1f2937' });
    b({ u0: 0.2, v0: 0.36, u1: 0.3, v1: 0.46, z0: 20, z1: 24, color: '#9ca3af', tex: 'metal' });
    c({ u: 0.22, v: 0.78, r: 0.12, z0: 0, z1: 12, color: '#3b82f6', top: '#1e3a8a' });
  },
  // Go-kart: telaio basso rosso, quattro ruote grosse, sedile e volante; ci si siede sopra.
  go_kart(b, { c }) {
    [[0.18, 0.2], [0.18, 0.8], [0.82, 0.2], [0.82, 0.8]].forEach(([u, v]) => c({ u, v, r: 0.12, z0: 0, z1: 9, color: '#111827', top: '#374151' }));
    b({ u0: 0.12, v0: 0.3, u1: 0.9, v1: 0.7, z0: 3, z1: 8, color: '#dc2626', tex: 'metal' });
    b({ u0: 0.78, v0: 0.32, u1: 0.98, v1: 0.68, z0: 3, z1: 7, color: '#f59e0b' });
    b({ u0: 0.2, v0: 0.36, u1: 0.4, v1: 0.64, z0: 8, z1: 20, color: '#1f2937', tex: 'fabric' });
    b({ u0: 0.62, v0: 0.46, u1: 0.66, v1: 0.54, z0: 8, z1: 16, color: '#6b7280' });
    b({ u0: 0.6, v0: 0.4, u1: 0.68, v1: 0.6, z0: 16, z1: 18, color: '#111827' });
  },
  // Pila di gomme a righe bianche e rosse, a bordo pista.
  tire_stack(b, { c }) {
    for (let i = 0; i < 4; i += 1) {
      c({ u: 0.5, v: 0.5, r: 0.36, z0: i * 9, z1: i * 9 + 9, color: '#18181b', top: '#27272a' });
      c({ u: 0.5, v: 0.5, r: 0.37, z0: i * 9 + 3, z1: i * 9 + 6, color: i % 2 ? '#ef4444' : '#f4f4f5' });
    }
    c({ u: 0.5, v: 0.5, r: 0.16, z0: 36, z1: 36, color: '#0a0a0a', top: '#0a0a0a' });
  },
  // Semaforo di partenza: cinque luci rosse che si accendono una a una, poi verdi.
  // Tavolo da ping pong (3x2): piano blu con le righe bianche e la rete in mezzo.
  ping_pong_table(b, { c }) {
    [[0.2, 0.2], [0.2, 1.8], [2.8, 0.2], [2.8, 1.8]].forEach(([u, v]) => c({ u, v, r: 0.05, z0: 0, z1: 22, color: '#27272a' }));
    b({ u0: 0.05, v0: 0.1, u1: 2.95, v1: 1.9, z0: 22, z1: 26, color: '#1d4ed8', right: '#1e3a8a' });
    b({ u0: 0.05, v0: 0.97, u1: 2.95, v1: 1.03, z0: 26, z1: 26, color: '#f8fafc' });
    b({ u0: 0.05, v0: 0.1, u1: 0.1, v1: 1.9, z0: 26, z1: 26, color: '#f8fafc' });
    b({ u0: 2.9, v0: 0.1, u1: 2.95, v1: 1.9, z0: 26, z1: 26, color: '#f8fafc' });
    b({ u0: 1.47, v0: 0.05, u1: 1.53, v1: 1.95, z0: 26, z1: 34, color: '#e5e7eb', tex: 'fabric' });
    b({ u0: 0.4, v0: 0.3, u1: 0.62, v1: 0.42, z0: 26, z1: 28, color: '#dc2626' });
    b({ u0: 2.38, v0: 1.58, u1: 2.6, v1: 1.7, z0: 26, z1: 28, color: '#111827' });
  },
  // Bersaglio delle freccette su un cavalletto: anelli rossi e verdi, centro rosso.
  dart_board(b, { c, d, front }) {
    c({ u: 0.5, v: 0.5, r: 0.05, z0: 0, z1: 40, color: '#52525b', tex: 'metal' });
    b({ u0: 0.1, v0: 0.45, u1: 0.9, v1: 0.55, z0: 38, z1: 80, color: '#27272a', tex: 'wood' });
    front(() => {
      [[34, '#111827'], [30, '#ef4444'], [26, '#f5f5dc'], [20, '#22c55e'], [16, '#f5f5dc'], [10, '#ef4444'], [4, '#22c55e']].forEach(([size, color]) => {
        d(0.5 - size / 150, 0.55, 59 + size / 2, color, size, size);
      });
    });
  },
  // Banchetto delle carte: tavolo con la tovaglia a righe, le carte esposte e la tenda.
  card_stall(b, { c, d, front }) {
    b({ u0: 0.08, v0: 0.2, u1: 1.92, v1: 0.8, z1: 26, color: '#8a5a3b', left: '#9a6a48', right: '#5b3a26', tex: 'wood' });
    b({ u0: 0.04, v0: 0.16, u1: 1.96, v1: 0.84, z0: 26, z1: 29, color: '#f4f4f5' });
    front(() => {
      for (let i = 0; i < 12; i += 1) d(0.06 + i * 0.16, 0.84, 24, i % 2 ? '#ef4444' : '#f4f4f5', 5, 10);
    });
    ['#a855f7', '#f59e0b', '#22d3ee', '#ec4899'].forEach((color, i) => {
      b({ u0: 0.22 + i * 0.4, v0: 0.36, u1: 0.5 + i * 0.4, v1: 0.42, z0: 29, z1: 40, color: '#1f1a2e' });
      b({ u0: 0.25 + i * 0.4, v0: 0.42, u1: 0.47 + i * 0.4, v1: 0.43, z0: 31, z1: 38, color, glow: true });
    });
    c({ u: 0.12, v: 0.22, r: 0.03, z0: 0, z1: 70, color: '#71717a', tex: 'metal' });
    c({ u: 1.88, v: 0.22, r: 0.03, z0: 0, z1: 70, color: '#71717a', tex: 'metal' });
    b({ u0: 0.04, v0: 0.12, u1: 1.96, v1: 0.3, z0: 66, z1: 74, color: '#ef4444', tex: 'fabric' });
    front(() => {
      for (let i = 0; i < 12; i += 1) d(0.06 + i * 0.16, 0.3, 66, i % 2 ? '#ef4444' : '#fef3c7', 5, 6);
    });
  },
  race_lights(b, { c, d, now, front }) {
    c({ u: 0.5, v: 0.5, r: 0.05, z0: 0, z1: 60, color: '#52525b', tex: 'metal' });
    b({ u0: 0.1, v0: 0.4, u1: 0.9, v1: 0.6, z0: 60, z1: 76, color: '#18181b' });
    const step = Math.floor((now || 0) / 700) % 7;
    front(() => {
      for (let i = 0; i < 5; i += 1) {
        const on = step >= 5 ? '#22c55e' : i < step + 1 ? '#ef4444' : '#3f3f46';
        d(0.16 + i * 0.15, 0.6, 72, on, 5, 5);
      }
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
/** Cumulo di monete d'oro a cono (raggio r in caselle, alto h), con qualche gemma e banconota. */
function lootHeap(b, d, r, h) {
  const layers = Math.max(2, Math.round(h / 5));
  for (let i = 0; i < layers; i += 1) {
    const rr = r * (1 - i / layers);
    const z0 = (h * i) / layers;
    b({ u0: 0.5 - rr, v0: 0.5 - rr, u1: 0.5 + rr, v1: 0.5 + rr, z0, z1: z0 + h / layers, color: i % 2 ? '#facc15' : '#eab308', left: '#ca8a04', right: '#a16207' });
  }
  [[0.42, 0.62, '#38bdf8'], [0.6, 0.5, '#f43f5e'], [0.5, 0.4, '#22c55e']].forEach(([u, v, color], i) => {
    if (i * 8 < h) d(u, v, h * (0.25 + i * 0.2), color, 3, 3);
  });
  d(0.5, 0.5, h + 1, '#fef9c3', 3, 2);
  if (h > 15) d(0.3, 0.7, 4, '#65a30d', 6, 2);
}

const SEAMLESS = new Set(['pool_water', 'sea_water', 'sea_foam', 'decor_leaves', 'decor_petals', 'decor_snow']);

// ------------------------------------------------------------------ mobili a parete

/**
 * Mobili a parete: disegnati sul piano del muro. Con rot 0 il muro e' quello di destra
 * (lungo x, in discesa verso destra), con rot 2 quello di sinistra. `a` e' la distanza lungo
 * il muro dall'angolo della casella, `h` l'altezza dal pavimento.
 */
export function wallPoint(ox, oy, rot, a, h) {
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
  } else if (type === 'badge_board') {
    // Bacheca di sughero con cornice: i distintivi li appende il motore, uno per uno.
    R(2, 31, 40, 100, '#6b3f16');
    R(4, 29, 42, 98, (a, h) => ((a * 7 + h * 3) % 11 < 2 ? '#a8733c' : '#c08a4a'));
    R(4, 29, 94, 98, '#8b5a2b');
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
    const proxied = /^https?:\/\//.test(src) && !src.includes('/fc-card.svg') && !src.includes('/nba-card.svg');
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
  const top = TALL[item.type] || TOP_ROOM;
  const height = (fx + fy) * HALF_H + top + 24;
  const { canvas, ctx } = createCanvas(width, height, { readable: true });
  const ox = fy * HALF_W + PAD / 2;
  const oy = top;

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
    if (item.card.grade > 0) {
      // Carta gradata: dentro il cofanetto trasparente, con l'etichetta del voto sopra.
      const tone = item.card.grade >= 9 ? '#f5c542' : item.card.grade >= 7 ? '#cbd5e1' : '#c08457';
      ctx.fillStyle = 'rgba(225, 236, 255, 0.55)';
      ctx.fillRect(cx - 3, cy - 10, 26, 41);
      ctx.fillStyle = '#fdfbf5';
      ctx.fillRect(cx - 2, cy - 9, 24, 6);
      ctx.fillStyle = tone;
      ctx.fillRect(cx + 14, cy - 9, 8, 6);
      ctx.fillStyle = '#1f1300';
      ctx.font = 'bold 6px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(item.card.grade), cx + 18, cy - 6);
    }
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
  golf_hole_3: { period: 250, steps: 8 },
  karaoke_stage: { period: 300, steps: 4 },
  race_lights: { period: 700, steps: 7 },
  traffic_light: { period: 1500, steps: 3 },
  dance_contest: { period: 300, steps: 4 },
  rock_stage: { period: 250, steps: 4 },
  guitar_duel: { period: 200, steps: 5 },
  drum_duel: { period: 250, steps: 4 },
  race_start: { period: 700, steps: 4 },
  slot_machine: { period: 220, steps: 6 },
  poker_machine: { period: 900, steps: 5 },
  roulette_table: { period: 120, steps: 24 },
  craps_table: { period: 500, steps: 6 },
  bingo_table: { period: 200, steps: 8 },
  horse_track: { period: 180, steps: 16 },
  weed_plant: { period: 300, steps: 12 },
  vault_safe: { period: 600, steps: 2 },
  gold_bars: { period: 250, steps: 8 },
  diamond_case: { period: 200, steps: 6 },
  stock_board: { period: 400, steps: 8 },
  trading_desk: { period: 500, steps: 4 },
  elevator: { period: 1000, steps: 4 }
};
const DANCE_COLORS = 6;

// Garage di casa: stessa pedana della concessionaria per ogni auto.
[5, 6, 7, 8, 9].forEach((ride) => { DRAW[`showcar_${ride}`] = DRAW.car_display; });

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
  if (item.type === 'fever_tile') {
    // Colore fisso per casella; con la musica le piastrelle si accendono a onde diagonali.
    const colorIndex = (item.x * 2 + item.y * 3) % DANCE_COLORS;
    if (!playing) return { key: `d${colorIndex}`, now: 0, colorIndex, lit: false };
    const step = still ? 0 : Math.floor(now / 460);
    const lit = (item.x + item.y + step) % 3 !== 0;
    return { key: `${lit ? 'l' : 'd'}${colorIndex}`, now: 0, colorIndex, lit };
  }
  const anim = ANIMATIONS[item.type];
  if (!anim || still) return { key: '0', now: 0 };
  const step = Math.floor(now / anim.period) % anim.steps;
  return { key: String(step), now: step * anim.period };
}
