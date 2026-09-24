import { HALF_H, HALF_W, LEVEL_H, TILE_H, TILE_W, WALL_H, tileTop } from '../iso.js';
import { createCanvas, px } from './pixel.js';

/**
 * Pavimento e pareti di una stanza, disegnati una volta in un'immagine sola.
 *
 * Come su Habbo ogni pixel ha la sua texture: assi di parquet con le venature, mattoni,
 * moquette, vetrate. Il colore di ogni pixel si calcola dalle coordinate del mondo, cosi' le
 * assi e i mattoni continuano da una casella all'altra senza cuciture. Si scrive tutto in
 * un'ImageData e la si copia una volta: niente migliaia di fillRect.
 */

// ------------------------------------------------------------------ colori e rumore

function rgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** Schiarisce (k > 0) o scurisce (k < 0) un colore gia' in forma [r, g, b]. */
function tint([r, g, b], k) {
  if (k >= 0) return [r + (255 - r) * k, g + (255 - g) * k, b + (255 - b) * k];
  return [r * (1 + k), g * (1 + k), b * (1 + k)];
}

function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Rumore intero deterministico: stesso punto, stesso valore, in [0, 1). */
function noise(a, b = 0, c = 0) {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const frac = (v) => v - Math.floor(v);

/** Rumore "morbido": valori casuali su una griglia, interpolati. Serve per venature e macchie. */
function smoothNoise(x, y, seed = 0) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = noise(x0, y0, seed);
  const b = noise(x0 + 1, y0, seed);
  const c = noise(x0, y0 + 1, seed);
  const d = noise(x0 + 1, y0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Piu' ottave di rumore morbido sommate: forme irregolari come nella pietra vera. */
function fbm(x, y, seed = 0) {
  return smoothNoise(x, y, seed) * 0.55 + smoothNoise(x * 2.1, y * 2.1, seed + 1) * 0.3
    + smoothNoise(x * 4.3, y * 4.3, seed + 2) * 0.15;
}

// ------------------------------------------------------------------ pavimenti

/**
 * Ogni pavimento e' una funzione (X, Y, sx, sy) -> colore: X e Y sono coordinate del mondo in
 * caselle (con i decimali), sx e sy il pixel sullo schermo per il rumore fine.
 */
const FLOORS = {
  // Piastrelle scure con le fughe al neon: lo stile VinylDex di sempre, con piu' dettaglio.
  neon: (() => {
    const a = rgb('#262a4d');
    const b = rgb('#2b3056');
    const line = rgb('#4a4f9a');
    const glow = rgb('#8b5cf6');
    return (X, Y, sx, sy) => {
      const u = frac(X);
      const v = frac(Y);
      if (u < 0.025 || v < 0.025) return (Math.floor(X) + Math.floor(Y)) % 4 === 0 ? glow : line;
      const base = (Math.floor(X) + Math.floor(Y)) % 2 ? a : b;
      const n = noise(sx, sy) * 0.06 - 0.03;
      // Riflesso morbido verso l'angolo in alto di ogni piastrella.
      return tint(base, n + (u + v < 0.35 ? 0.05 : 0));
    };
  })(),

  // Parquet scuro come la caffetteria di Habbo: assi lunghe con venature e giunti sfalsati.
  parquet: (() => {
    const woods = ['#4a2f22', '#553626', '#3f281d', '#5b3b29', '#46301f'].map(rgb);
    const seam = rgb('#1f130d');
    const PLANKS = 4;
    return (X, Y, sx, sy) => {
      const row = Math.floor(Y * PLANKS);
      const inRow = frac(Y * PLANKS);
      if (inRow < 0.07) return seam;
      const length = 1.6 + noise(row, 7) * 0.9;
      const offset = noise(row, 3) * length;
      const along = (X + offset) / length;
      const plank = Math.floor(along);
      if (frac(along) < 0.012) return seam;
      const base = woods[Math.floor(noise(row, plank) * woods.length)];
      // Venatura: onde lungo l'asse, piu' scure a tratti, piu' un filo di rumore.
      const grain = Math.sin(X * 26 + noise(row, plank, 5) * 20 + Math.sin(inRow * 9) * 1.5);
      let k = grain > 0.82 ? -0.14 : grain < -0.9 ? 0.06 : 0;
      k += noise(sx, sy) * 0.05 - 0.025;
      // Bordo superiore dell'asse appena piu' chiaro: da' volume.
      if (inRow < 0.16) k += 0.07;
      return tint(base, k);
    };
  })(),

  // Moquette viola: trama fitta, qualche macchia di colore piu' caldo e un rombo ogni casella.
  carpet: (() => {
    const base = rgb('#3b2a66');
    const warm = rgb('#4a2f6e');
    const motif = rgb('#5a45a0');
    return (X, Y, sx, sy) => {
      const du = Math.abs(frac(X) - 0.5);
      const dv = Math.abs(frac(Y) - 0.5);
      const onMotif = Math.abs(du + dv - 0.2) < 0.025;
      const color = mix(base, warm, smoothNoise(X * 1.5, Y * 1.5, 11));
      // Trama: pixel alterni appena piu' chiari, come il pelo della moquette.
      const weave = (sx + sy) % 2 === 0 ? 0.03 : -0.02;
      return tint(onMotif ? motif : color, weave + (noise(sx, sy) - 0.5) * 0.06);
    };
  })(),

  // Scacchiera da sala giochi, bianco e nero con le fughe.
  checker: (() => {
    const light = rgb('#e6e1f2');
    const dark = rgb('#1b1729');
    const grout = rgb('#8a84a3');
    return (X, Y, sx, sy) => {
      const cu = frac(X * 2);
      const cv = frac(Y * 2);
      if (cu < 0.04 || cv < 0.04) return grout;
      const isLight = (Math.floor(X * 2) + Math.floor(Y * 2)) % 2 === 0;
      const n = (noise(sx, sy) - 0.5) * 0.05;
      return tint(isLight ? light : dark, n + (cu + cv < 0.4 ? 0.05 : 0));
    };
  })(),

  // Marmo chiaro a lastre grandi, con venature irregolari che cambiano da lastra a lastra.
  marble: (() => {
    const slab = rgb('#ece6f1');
    const cloud = rgb('#d9d0e6');
    const vein = rgb('#9d93b5');
    const grout = rgb('#bdb3cf');
    return (X, Y, sx, sy) => {
      if (frac(X) < 0.015 || frac(Y) < 0.015) return grout;
      const seed = Math.floor(X) * 31 + Math.floor(Y) * 17;
      const f = fbm(X * 0.8, Y * 0.8, seed % 97);
      const n = (noise(sx, sy) - 0.5) * 0.03;
      const d = Math.abs(f - 0.5);
      if (d < 0.006) return vein;
      if (d < 0.016) return mix(slab, vein, 0.3);
      return tint(mix(slab, cloud, smoothNoise(X * 3, Y * 3, 5) * 0.8), n);
    };
  })(),

  // Prato: fili d'erba in tre verdi, qualche macchia piu' chiara e un fiorellino ogni tanto.
  grass: (() => {
    const greens = ['#3f8f3a', '#4a9e42', '#357a31'].map(rgb);
    const light = rgb('#6cc04a');
    const flowers = ['#f5f5f5', '#fbbf24', '#ec4899'].map(rgb);
    return (X, Y, sx, sy) => {
      const n = noise(sx, sy);
      if (n > 0.9985) return flowers[Math.floor(noise(sy, sx) * flowers.length)];
      const patch = smoothNoise(X * 1.2, Y * 1.2, 31);
      const base = greens[Math.floor(noise(sx >> 1, sy) * greens.length)];
      const blade = (sx + Math.floor(sy / 2)) % 5 === 0 && n > 0.6 ? 0.12 : 0;
      return tint(patch > 0.62 ? mix(base, light, 0.35) : base, blade + (n - 0.5) * 0.08);
    };
  })(),

  // Bordo piscina: piastrelle chiare con le fughe azzurre, antiscivolo a puntini.
  pooldeck: (() => {
    const tile = rgb('#e9eef2');
    const alt = rgb('#dfe7ed');
    const grout = rgb('#9cc9da');
    return (X, Y, sx, sy) => {
      const cu = frac(X * 2);
      const cv = frac(Y * 2);
      if (cu < 0.035 || cv < 0.035) return grout;
      const base = (Math.floor(X * 2) + Math.floor(Y * 2)) % 2 ? tile : alt;
      const dot = (sx % 4 === 0 && sy % 3 === 0) ? -0.05 : 0;
      return tint(base, dot + (noise(sx, sy) - 0.5) * 0.03);
    };
  })(),

  // Cotto: piastrelle quadrate color terracotta, sfumate una per una.
  terracotta: (() => {
    const tones = ['#b5583a', '#a84f33', '#c0643f', '#9e4a30'].map(rgb);
    const grout = rgb('#6e3a28');
    return (X, Y, sx, sy) => {
      const cu = frac(X * 2);
      const cv = frac(Y * 2);
      if (cu < 0.05 || cv < 0.05) return grout;
      const base = tones[Math.floor(noise(Math.floor(X * 2), Math.floor(Y * 2), 5) * tones.length)];
      return tint(base, (noise(sx, sy) - 0.5) * 0.08 + (cu + cv < 0.35 ? 0.06 : 0));
    };
  })(),

  // Pedana in legno da esterno: doghe strette con le viti in fila.
  wooddeck: (() => {
    const woods = ['#8a6a4a', '#7c5e40', '#957453'].map(rgb);
    const gap = rgb('#3b2a1e');
    return (X, Y, sx, sy) => {
      const row = Math.floor(Y * 5);
      const inRow = frac(Y * 5);
      if (inRow < 0.1) return gap;
      const base = woods[Math.floor(noise(row, 9) * woods.length)];
      const screw = Math.abs(frac(X * 2) - 0.5) < 0.02 && Math.abs(inRow - 0.5) < 0.08;
      if (screw) return rgb('#2a2a2a');
      const grain = Math.sin(X * 30 + noise(row, 4) * 10) > 0.9 ? -0.1 : 0;
      return tint(base, grain + (noise(sx, sy) - 0.5) * 0.05);
    };
  })(),

  // Tappeto da ring: gomma rossa con le corde dorate ai bordi di ogni quadrato.
  arena: (() => {
    const mat = rgb('#5e1f2b');
    const alt = rgb('#6b2533');
    const gold = rgb('#e0a82e');
    return (X, Y, sx, sy) => {
      const u = frac(X);
      const v = frac(Y);
      if (u < 0.03 || v < 0.03) return gold;
      const n = (noise(sx, sy) - 0.5) * 0.08;
      return tint((Math.floor(X) + Math.floor(Y)) % 2 ? mat : alt, n);
    };
  })()
};

// ------------------------------------------------------------------ pareti

/**
 * Ogni parete e' una funzione (col, h, height, side) -> colore: col e' la colonna di pixel
 * lungo il muro (continua da una casella all'altra), h l'altezza dal pavimento, height l'altezza
 * totale, side 'left' o 'right'. Il lato destro riceve meno luce e viene scurito dopo.
 */
const baseboard = (h, colors) => {
  if (h < 2) return colors.shadow;
  if (h < 9) return colors.board;
  if (h < 10) return colors.trim;
  return null;
};

const WALLS = {
  neon: (() => {
    const paper = rgb('#2a1f55');
    const stripe = rgb('#31255f');
    const board = { shadow: rgb('#0c0816'), board: rgb('#171030'), trim: rgb('#ec4899') };
    const band = rgb('#8b5cf6');
    return (col, h, height, side, sy) => {
      const bb = baseboard(h, board);
      if (bb) return bb;
      if (h > height - 14 && h < height - 11) return band;
      const onStripe = Math.floor(col / 8) % 2 === 0;
      const n = (noise(col, sy) - 0.5) * 0.04;
      // Piccoli rombi di carta da parati sulle strisce chiare.
      const motif = onStripe && ((col % 8) + (h % 16) === 8) ? 0.12 : 0;
      return tint(onStripe ? stripe : paper, n + motif);
    };
  })(),

  // Mattoni rossi sfalsati, con la malta e qualche mattone piu' scuro.
  brick: (() => {
    const bricks = ['#8a3b2e', '#7d3428', '#94432f', '#6f2f25'].map(rgb);
    const mortar = rgb('#3a2622');
    const board = { shadow: rgb('#140b09'), board: rgb('#2b1a16'), trim: rgb('#5a3a2e') };
    return (col, h, height, side, sy) => {
      const bb = baseboard(h, board);
      if (bb) return bb;
      const row = Math.floor(h / 8);
      const shift = row % 2 ? 8 : 0;
      const bx = Math.floor((col + shift) / 16);
      if (h % 8 === 0 || (col + shift) % 16 === 0) return mortar;
      const base = bricks[Math.floor(noise(bx, row) * bricks.length)];
      const n = (noise(col, sy) - 0.5) * 0.1;
      // Spigolo alto del mattone illuminato.
      return tint(base, n + (h % 8 === 7 ? 0.1 : 0));
    };
  })(),

  // Verde petrolio della caffetteria, con la modanatura in alto e lo zoccolo in legno.
  teal: (() => {
    const paint = rgb('#2f5d63');
    const molding = rgb('#244a4f');
    const board = { shadow: rgb('#0f1d1f'), board: rgb('#4a2f22'), trim: rgb('#6b4631') };
    return (col, h, height, side, sy) => {
      const bb = baseboard(h, board);
      if (bb) return bb;
      if (h > height - 8) return h > height - 3 ? tint(molding, 0.15) : molding;
      const n = (noise(col, sy) - 0.5) * 0.035;
      return tint(paint, n);
    };
  })(),

  // Boiserie: doghe verticali in legno, zoccolatura piu' scura e il corrimano a meta'.
  wood: (() => {
    const planks = ['#6b4631', '#734c35', '#62402d'].map(rgb);
    const lower = rgb('#4a2f22');
    const rail = rgb('#8a5e3f');
    const board = { shadow: rgb('#140c08'), board: rgb('#2e1d14'), trim: rgb('#8a5e3f') };
    return (col, h, height, side, sy) => {
      const bb = baseboard(h, board);
      if (bb) return bb;
      if (h >= 40 && h < 44) return h === 43 ? tint(rail, 0.2) : rail;
      if (h < 40) {
        const panel = col % 24;
        if (panel === 0 || h === 14 || h === 36) return tint(lower, -0.3);
        return tint(lower, (noise(col, sy) - 0.5) * 0.06);
      }
      const plank = Math.floor(col / 8);
      if (col % 8 === 0) return tint(planks[0], -0.35);
      const grain = Math.sin(h * 0.45 + noise(plank, 1) * 12) > 0.85 ? -0.12 : 0;
      return tint(planks[plank % planks.length], grain + (noise(col, sy) - 0.5) * 0.05);
    };
  })(),

  // Vetrate a tutta altezza: telai scuri, vetro azzurro con i riflessi in diagonale.
  windows: (() => {
    const sill = rgb('#2b2340');
    const frame = rgb('#3a3350');
    const glassTop = rgb('#6fb3c8');
    const glassBottom = rgb('#3f7d93');
    const glint = rgb('#d6f4ff');
    const board = { shadow: rgb('#0c0a14'), board: rgb('#1e1830'), trim: rgb('#ec4899') };
    return (col, h, height, side, sy) => {
      const bb = baseboard(h, board);
      if (bb) return bb;
      if (h < 26) return h === 25 ? tint(sill, 0.25) : tint(sill, (noise(col, sy) - 0.5) * 0.05);
      if (h > height - 7) return frame;
      const pane = col % 64;
      if (pane < 4 || (pane > 30 && pane < 34)) return pane === 1 || pane === 32 ? tint(frame, 0.2) : frame;
      const transom = Math.round((height - 26) * 0.68) + 26;
      if (h >= transom && h < transom + 3) return frame;
      const t = (h - 26) / (height - 32);
      let color = mix(glassBottom, glassTop, t);
      // Riflessi: bande diagonali chiare che attraversano i vetri.
      const diag = (col + h * 1.1) % 90;
      if (diag < 3) color = mix(color, glint, 0.55);
      else if (diag > 10 && diag < 12) color = mix(color, glint, 0.3);
      return color;
    };
  })(),

  // Siepe: foglie fitte a ciuffi, piu' scure in basso, con la cima potata.
  hedge: (() => {
    const leaves = ['#2f7d32', '#3a8f3c', '#276b2a', '#46a047'].map(rgb);
    const dark = rgb('#1e4f20');
    return (col, h, height, side, sy) => {
      if (h < 3) return dark;
      const clump = noise(Math.floor(col / 3), Math.floor(h / 3));
      let color = leaves[Math.floor(clump * leaves.length)];
      if (noise(col, sy) > 0.8) color = tint(color, 0.15);
      if (h < 30) color = tint(color, -0.15 * (1 - h / 30));
      if (h > height - 5) color = tint(color, 0.1);
      return color;
    };
  })(),

  // Piastrelle da piscina: quadratini azzurri e bianchi, con una fascia di mosaico blu.
  pooltile: (() => {
    const blue = rgb('#7cc6e0');
    const white = rgb('#eef6fa');
    const deep = rgb('#2a7fa8');
    const grout = rgb('#b8d9e6');
    const board = { shadow: rgb('#1b4a60'), board: rgb('#2a7fa8'), trim: rgb('#eef6fa') };
    return (col, h, height, side, sy) => {
      const bb = baseboard(h, board);
      if (bb) return bb;
      if (col % 8 === 0 || h % 8 === 0) return grout;
      const cx = Math.floor(col / 8);
      const cy = Math.floor(h / 8);
      if (h > 40 && h < 56) return (cx + cy) % 2 ? deep : blue;
      return tint((cx + cy) % 3 === 0 ? blue : white, (noise(col, sy) - 0.5) * 0.04);
    };
  })(),

  // Skyline: parapetto in vetro e dietro la citta' di notte, con le finestre accese e le stelle.
  skyline: (() => {
    const sky = ['#0b0620', '#170b35', '#2a114f', '#4a1765'].map(rgb);
    const building = rgb('#140d2c');
    const lights = ['#ffd76a', '#ff7ad9', '#7ae8ff'].map(rgb);
    const rail = rgb('#9ca3af');
    const glass = rgb('#7dd3fc');
    return (col, h, height, side, sy) => {
      if (h < 3) return rgb('#1f1f2e');
      // Parapetto: corrimano metallico e vetro appena azzurrato in basso.
      if (h >= 34 && h < 37) return h === 36 ? tint(rail, 0.3) : rail;
      if (h < 34) return mix(tint(building, 0.1), glass, 0.18);
      const bx = Math.floor(col / 14);
      const top = 50 + Math.floor(noise(bx, 3) * 70);
      if (h < top) {
        const lit = (col % 4 === 1) && (h % 6 === 2) && noise(col, h) > 0.45;
        return lit ? lights[Math.floor(noise(h, col) * lights.length)] : tint(building, (noise(col, sy) - 0.5) * 0.06);
      }
      const t = (h - 37) / (height - 37);
      const color = sky[Math.min(sky.length - 1, Math.floor((1 - t) * sky.length))];
      return noise(col, h) > 0.996 ? rgb('#ffffff') : color;
    };
  })(),

  // Arena: pannelli rosso scuro con una fascia dorata.
  arena: (() => {
    const panel = rgb('#3b1d2c');
    const panelAlt = rgb('#43212f');
    const gold = rgb('#ffd700');
    const board = { shadow: rgb('#0d060a'), board: rgb('#20121b'), trim: rgb('#ff6b35') };
    return (col, h, height, side, sy) => {
      const bb = baseboard(h, board);
      if (bb) return bb;
      if (h > 48 && h < 54) return h === 49 || h === 53 ? tint(gold, -0.3) : gold;
      const n = (noise(col, sy) - 0.5) * 0.05;
      return tint(Math.floor(col / 32) % 2 ? panel : panelAlt, n);
    };
  })()
};

export const FLOOR_STYLES = Object.keys(FLOORS);
export const WALL_STYLES = Object.keys(WALLS);

// ------------------------------------------------------------------ immagine della stanza

/**
 * @returns {{ canvas, originX, originY }} immagine della stanza e posizione, al suo interno,
 * del vertice alto della casella (0, 0).
 */
export function renderRoom(layout, floorName, door, wallName = floorName) {
  const floor = FLOORS[floorName] || FLOORS.neon;
  const wallPaint = WALLS[wallName] || WALLS.neon;
  const isDoor = (x, y) => door && door.x === x && door.y === y;

  // Ingombro in pixel base, pareti e dislivelli compresi.
  let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
  for (let y = 0; y < layout.height; y += 1) {
    for (let x = 0; x < layout.width; x += 1) {
      const z = layout.heightAt(x, y);
      if (z < 0) continue;
      const t = tileTop(x, y, z);
      minX = Math.min(minX, t.x - HALF_W - 4);
      maxX = Math.max(maxX, t.x + HALF_W + 4);
      minY = Math.min(minY, t.y + z * LEVEL_H - WALL_H - 6);
      maxY = Math.max(maxY, t.y + TILE_H + z * LEVEL_H + 2);
    }
  }
  const originX = -minX + 2;
  const originY = -minY + 2;
  const width = Math.ceil(maxX - minX) + 4;
  const height = Math.ceil(maxY - minY) + 4;
  const { canvas, ctx } = createCanvas(width, height);
  const image = ctx.createImageData(width, height);
  const data = image.data;
  const put = (x, y, c, alpha = 255) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = (y * width + x) * 4;
    data[i] = c[0];
    data[i + 1] = c[1];
    data[i + 2] = c[2];
    data[i + 3] = alpha;
  };

  // Pareti: dietro a tutto, lungo i lati che confinano con il vuoto. La porta resta aperta.
  const topCap = rgb('#6a5a96');
  for (let y = 0; y < layout.height; y += 1) {
    for (let x = 0; x < layout.width; x += 1) {
      const z = layout.heightAt(x, y);
      if (z < 0 || isDoor(x, y)) continue;
      const t = tileTop(x, y, z);
      const tx = originX + t.x;
      const ty = originY + t.y;
      const wallTop = WALL_H - z * LEVEL_H;
      const sides = [];
      if (!layout.isTile(x - 1, y) && !isDoor(x - 1, y)) sides.push('left');
      if (!layout.isTile(x, y - 1) && !isDoor(x, y - 1)) sides.push('right');
      sides.forEach((side) => {
        for (let c = 0; c < HALF_W; c += 1) {
          const sx = side === 'left' ? tx - HALF_W + c : tx + c;
          const baseY = side === 'left' ? ty + HALF_H - Math.floor(c / 2) : ty + Math.floor(c / 2);
          // Colonna continua lungo il muro: a sinistra si corre lungo y, a destra lungo x.
          const col = side === 'left' ? (y + 1) * HALF_W - c : x * HALF_W + c;
          for (let h = 0; h < wallTop; h += 1) {
            const hAbs = h + z * LEVEL_H;
            let color = wallPaint(col, hAbs, WALL_H, side, baseY - h);
            if (side === 'right') color = tint(color, -0.18);
            put(sx, baseY - 1 - h, color);
          }
          // Spessore del muro in cima, come la cornice chiara delle pareti di Habbo.
          for (let k = 0; k < 4; k += 1) put(sx, baseY - wallTop - 1 - k, k === 3 ? tint(topCap, 0.3) : topCap);
        }
      });
    }
  }

  // Caselle in ordine di profondita': quelle davanti coprono i fianchi di quelle dietro.
  const tiles = [];
  for (let y = 0; y < layout.height; y += 1) {
    for (let x = 0; x < layout.width; x += 1) {
      if (layout.isTile(x, y)) tiles.push({ x, y, z: layout.heightAt(x, y) });
    }
  }
  tiles.sort((a, b) => (a.x + a.y) - (b.x + b.y) || a.z - b.z);

  const doorColor = rgb('#07050d');
  tiles.forEach(({ x, y, z }) => {
    const t = tileTop(x, y, z);
    const tx = originX + t.x;
    const ty = originY + t.y;
    const below = (nx, ny) => Math.max(0, layout.heightAt(nx, ny));

    // Fianchi dei gradini: stessa texture del pavimento, molto piu' scura.
    const leftDrop = (z - below(x, y + 1)) * LEVEL_H;
    const rightDrop = (z - below(x + 1, y)) * LEVEL_H;
    for (let c = 0; c < HALF_W; c += 1) {
      if (leftDrop > 0) {
        const yTop = ty + HALF_H + Math.floor(c / 2);
        for (let d = 0; d < leftDrop; d += 1) put(tx - HALF_W + c, yTop + d, tint(floor(x + c / HALF_W, y + 1, c, d), d === 0 ? -0.1 : -0.35));
      }
      if (rightDrop > 0) {
        const yTop = ty + TILE_H - 1 - Math.floor(c / 2);
        for (let d = 0; d < rightDrop; d += 1) put(tx + c, yTop + d, tint(floor(x + 1, y + c / HALF_W, c, d), d === 0 ? -0.2 : -0.5));
      }
    }

    const wallLeft = !layout.isTile(x - 1, y);
    const wallRight = !layout.isTile(x, y - 1);
    for (let row = 0; row < TILE_H; row += 1) {
      const r = row < HALF_H ? row : TILE_H - 1 - row;
      const half = 2 * (r + 1);
      const b = (row + 0.5) / HALF_H;
      for (let dx = -half; dx < half; dx += 1) {
        const a = (dx + 0.5) / HALF_W;
        const u = (b + a) / 2;
        const v = (b - a) / 2;
        const sx = tx + dx;
        const sy = ty + row;
        if (isDoor(x, y)) {
          put(sx, sy, doorColor);
          continue;
        }
        let color = floor(x + u, y + v, sx, sy);
        // Ombra morbida ai piedi delle pareti, come l'occlusione ambientale di Habbo.
        let shadow = 0;
        if (wallLeft && u < 0.22) shadow = Math.max(shadow, (0.22 - u) / 0.22);
        if (wallRight && v < 0.22) shadow = Math.max(shadow, (0.22 - v) / 0.22);
        if (shadow > 0) color = tint(color, -0.35 * shadow);
        put(sx, sy, color);
      }
    }
  });

  ctx.putImageData(image, 0, 0);
  return { canvas, originX, originY };
}

let hoverSprite = null;

/** Contorno della casella sotto il puntatore, come il riquadro di selezione di Habbo. */
export function hoverTileSprite() {
  if (hoverSprite) return hoverSprite;
  const { canvas, ctx } = createCanvas(TILE_W, TILE_H);
  for (let row = 0; row < TILE_H; row += 1) {
    const r = row < HALF_H ? row : TILE_H - 1 - row;
    const half = 2 * (r + 1);
    px(ctx, HALF_W - half, row, 2, 1, '#ffffff');
    px(ctx, HALF_W + half - 2, row, 2, 1, '#ffffff');
  }
  hoverSprite = canvas;
  return canvas;
}
