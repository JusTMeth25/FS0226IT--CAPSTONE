import { HALF_H, HALF_W, LEVEL_H, TILE_H, TILE_W, WALL_H, tileTop } from '../iso.js';
import { unitPoint } from '../kartTrack.js';
import { createCanvas, px } from './pixel.js';
import { garlandPaint } from '../weather.js';

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
  // Casino: moquette rossa con il reticolo dorato a rombi dei casino classici, un fiore blu notte
  // al centro di ogni rombo e i rombi alterni appena piu' scuri.
  casino: (() => {
    const red = rgb('#7a0f1c');
    const deep = rgb('#5e0b16');
    const gold = rgb('#c9972f');
    const navy = rgb('#1b2350');
    return (X, Y, sx, sy) => {
      // Coordinate ruotate di 45 gradi: le righe del reticolo sono X+Y e X-Y intere (ogni due caselle).
      const a = (X + Y) / 2;
      const b = (X - Y) / 2;
      const fa = frac(a);
      const fb = frac(b);
      const line = Math.min(fa, 1 - fa) < 0.035 || Math.min(fb, 1 - fb) < 0.035;
      let c = (Math.floor(a) + Math.floor(b)) % 2 === 0 ? red : deep;
      if (line) c = gold;
      else {
        const da = Math.abs(fa - 0.5);
        const db = Math.abs(fb - 0.5);
        if (da + db < 0.12) c = navy;
        else if (da + db < 0.16) c = gold;
      }
      const worn = smoothNoise(X * 0.7, Y * 0.7, 21);
      return tint(c, (noise(sx, sy) - 0.5) * 0.07 - (worn > 0.7 ? 0.05 : 0));
    };
  })(),

  // Locale rock: scacchiera bianca e nera consumata, con le macchie di birra e i graffi.
  rockclub: (() => {
    const white = rgb('#d6d0c4');
    const black = rgb('#1c1a1e');
    const stain = rgb('#5a4630');
    return (X, Y, sx, sy) => {
      const dark = (Math.floor(X) + Math.floor(Y)) % 2 === 0;
      let c = dark ? black : white;
      const wear = smoothNoise(X * 2.1, Y * 2.1, 5);
      if (wear > 0.72) c = mix(c, stain, 0.35);
      if (noise(sx * 3, sy * 7) > 0.985) c = tint(c, dark ? 0.25 : -0.25);
      return tint(c, (noise(sx, sy) - 0.5) * 0.07 + (frac(X) < 0.02 || frac(Y) < 0.02 ? -0.15 : 0));
    };
  })(),

  // Boutique di lusso: marmo crema lucido a grandi lastre, con l'intarsio d'oro nelle fughe.
  boutique: (() => {
    const cream = rgb('#efe6d4');
    const vein = rgb('#cdbf9f');
    const gold = rgb('#c9a24a');
    return (X, Y, sx, sy) => {
      const u = frac(X / 2);
      const v = frac(Y / 2);
      if (u < 0.012 || v < 0.012) return gold;
      const veinK = Math.abs(Math.sin(X * 1.7 + Math.sin(Y * 2.3) * 1.4 + Math.floor(X / 2) * 3)) < 0.05 ? 1 : 0;
      const base = veinK ? vein : cream;
      return tint(base, (u + v < 0.5 ? 0.05 : 0) + (noise(sx, sy) - 0.5) * 0.03);
    };
  })(),

  // Showroom delle auto: resina grigia lucida, riflessi lunghi delle luci del soffitto.
  showroom: (() => {
    const base = rgb('#3a3f4a');
    const light = rgb('#8a93a6');
    return (X, Y, sx, sy) => {
      const reflect = Math.abs(frac((X + Y) / 3) - 0.5) < 0.04 ? 0.18 : 0;
      const grid = frac(X / 3) < 0.01 || frac(Y / 3) < 0.01;
      if (grid) return tint(base, -0.2);
      return reflect ? mix(base, light, 0.35) : tint(base, (noise(sx, sy) - 0.5) * 0.05);
    };
  })(),

  // Caffetteria: parquet a spina di pesce caldo.
  coffeehouse: (() => {
    const woods = ['#8a5a3b', '#7a4e33', '#936244', '#6e452d'].map(rgb);
    const seam = rgb('#3e2718');
    return (X, Y, sx, sy) => {
      const a = X * 4;
      const b = Y * 4;
      const zig = Math.floor(a) % 2 === 0;
      const along = zig ? a + b : a - b;
      const plank = Math.floor(along / 3);
      if (frac(a) < 0.08 || frac(along / 3) < 0.03) return seam;
      const base = woods[Math.floor(noise(plank, Math.floor(a)) * woods.length)];
      return tint(base, (noise(sx, sy) - 0.5) * 0.06);
    };
  })(),

  // Discoteca anni 80: marmo nero lucido con le fughe viola e qualche riflesso delle luci.
  disco: (() => {
    const a = rgb('#131019');
    const b = rgb('#1a1524');
    const grout = rgb('#3b1f5c');
    const spark = [rgb('#ff4fd8'), rgb('#38e8ff'), rgb('#ffd24a')];
    return (X, Y, sx, sy) => {
      const u = frac(X);
      const v = frac(Y);
      if (u < 0.03 || v < 0.03) return grout;
      const base = (Math.floor(X) + Math.floor(Y)) % 2 ? a : b;
      // Riflessi colorati sparsi, come le luci della palla di specchi sul pavimento lucido.
      if (noise(sx * 3, sy * 5) > 0.992) return spark[Math.floor(noise(sx, sy, 4) * spark.length)];
      const shine = u + v < 0.4 ? 0.08 : 0;
      return tint(base, shine + (noise(sx, sy) - 0.5) * 0.05);
    };
  })(),

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

  // Sabbia: granelli fitti, increspature lasciate dal vento e qualche conchiglia.
  sand: (() => {
    const base = rgb('#e8cf9a');
    const light = rgb('#f4e2b8');
    const dark = rgb('#d4b57a');
    const shells = ['#fdf2f8', '#fbcfe8', '#fde68a'].map(rgb);
    return (X, Y, sx, sy) => {
      const n = noise(sx, sy);
      if (n > 0.9993) return shells[Math.floor(noise(sy, sx, 3) * shells.length)];
      // Increspature: onde lunghe e storte, piu' chiare sulla cresta.
      const ripple = Math.sin((X + Y * 0.6) * 7 + smoothNoise(X * 0.7, Y * 0.7, 41) * 6);
      let color = mix(base, ripple > 0.75 ? light : ripple < -0.8 ? dark : base, 0.6);
      color = mix(color, dark, smoothNoise(X * 0.4, Y * 0.4, 43) * 0.35);
      return tint(color, (n - 0.5) * 0.12);
    };
  })(),

  // Sampietrini: cubetti di pietra a file sfalsate, lucidi in cima e con le fughe scure.
  cobble: (() => {
    const stones = ['#8f8a93', '#7d7884', '#9b95a0', '#86808d'].map(rgb);
    const grout = rgb('#3a3540');
    return (X, Y, sx, sy) => {
      const row = Math.floor(Y * 4);
      const along = X * 4 + (row % 2 ? 0.5 : 0);
      const col = Math.floor(along);
      const u = frac(along);
      const v = frac(Y * 4);
      const edge = Math.min(u, 1 - u, v, 1 - v);
      if (edge < 0.07) return grout;
      const base = stones[Math.floor(noise(col, row, 17) * stones.length)];
      // Il cubetto e' bombato: piu' chiaro verso l'alto a sinistra, piu' scuro sui bordi.
      const bulge = (0.5 - Math.hypot(u - 0.4, v - 0.4)) * 0.25;
      return tint(base, bulge + (edge < 0.14 ? -0.12 : 0) + (noise(sx, sy) - 0.5) * 0.06);
    };
  })(),

  // Moquette del cinema: rosso scuro con un motivo di piccoli rombi dorati.
  cinema: (() => {
    const base = rgb('#4a1420');
    const alt = rgb('#541826');
    const gold = rgb('#b8872e');
    return (X, Y, sx, sy) => {
      const du = Math.abs(frac(X * 2) - 0.5);
      const dv = Math.abs(frac(Y * 2) - 0.5);
      if (Math.abs(du + dv - 0.28) < 0.035) return tint(gold, (noise(sx, sy) - 0.5) * 0.1);
      const weave = (sx + sy) % 2 === 0 ? 0.03 : -0.02;
      return tint(mix(base, alt, smoothNoise(X, Y, 51)), weave + (noise(sx, sy) - 0.5) * 0.05);
    };
  })(),

  // Gomma da palestra: grigio scuro con i coriandoli colorati e le righe dipinte.
  rubber: (() => {
    const base = rgb('#2e3238');
    const flecks = ['#ef4444', '#3b82f6', '#facc15', '#e5e7eb'].map(rgb);
    const lane = rgb('#f59e0b');
    return (X, Y, sx, sy) => {
      if (Math.abs(frac(X / 4) * 4 - 0.02) < 0.03) return lane;
      const n = noise(sx, sy);
      if (n > 0.985) return tint(flecks[Math.floor(noise(sy, sx, 7) * flecks.length)], -0.2);
      return tint(base, (n - 0.5) * 0.08 + (frac(Y) < 0.02 ? -0.12 : 0));
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

/**
 * Pavimenti che dipendono dalla forma della stanza: ricevono la pianta e la porta e restituiscono
 * la solita funzione (X, Y, sx, sy) -> colore.
 */
const FLOOR_FACTORIES = {
  // Campo da calcio: prato a strisce tagliate, linee bianche, e intorno una fascia d'erba piu'
  // scura. Il campo sta due caselle dentro i bordi della stanza (li' fuori ci sono le porte).
  pitch: (layout, door) => {
    let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
    for (let y = 0; y < layout.height; y += 1) {
      for (let x = 0; x < layout.width; x += 1) {
        if (!layout.isTile(x, y) || (door && door.x === x && door.y === y)) continue;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
    }
    const fx0 = x0 + 2;
    const fx1 = x1 - 1;
    const fy0 = y0 + 2;
    const fy1 = y1 - 1;
    const mx = (fx0 + fx1) / 2;
    const my = (fy0 + fy1) / 2;
    const height = fy1 - fy0;
    const circle = Math.min(3, height / 6);
    const boxDepth = Math.min(5, (fx1 - fx0) / 6);
    const boxHalf = Math.min(6, height / 3);
    const smallDepth = boxDepth * 0.4;
    const smallHalf = boxHalf * 0.5;
    const W = 0.07;
    const stripes = ['#3f9a3f', '#48a846'].map(rgb);
    const outside = rgb('#2f7d31');
    const white = rgb('#f4f7f2');
    const near = (a, b) => Math.abs(a - b) < W;
    const between = (v, a, b) => v >= a - W && v <= b + W;
    const isLine = (X, Y) => {
      if (!between(X, fx0, fx1) || !between(Y, fy0, fy1)) return false;
      if (near(X, fx0) || near(X, fx1) || near(Y, fy0) || near(Y, fy1) || near(X, mx)) return true;
      const d = Math.hypot(X - mx, Y - my);
      if (Math.abs(d - circle) < W || d < 0.14) return true;
      for (const [goalX, dir] of [[fx0, 1], [fx1, -1]]) {
        const depthIn = (X - goalX) * dir;
        // Area di rigore, area piccola e dischetto.
        if (between(depthIn, 0, boxDepth) && near(Math.abs(Y - my), boxHalf)) return true;
        if (near(depthIn, boxDepth) && Math.abs(Y - my) <= boxHalf) return true;
        if (between(depthIn, 0, smallDepth) && near(Math.abs(Y - my), smallHalf)) return true;
        if (near(depthIn, smallDepth) && Math.abs(Y - my) <= smallHalf) return true;
        if (Math.hypot(depthIn - boxDepth * 0.72, Y - my) < 0.12) return true;
        // Lunetta fuori dall'area.
        if (depthIn > boxDepth && Math.abs(Math.hypot(depthIn - boxDepth * 0.72, Y - my) - circle * 0.8) < W) return true;
      }
      // Quarti di cerchio agli angoli.
      for (const [cx, cy] of [[fx0, fy0], [fx1, fy0], [fx0, fy1], [fx1, fy1]]) {
        if (Math.abs(Math.hypot(X - cx, Y - cy) - 0.6) < W) return true;
      }
      return false;
    };
    return (X, Y, sx, sy) => {
      const n = noise(sx, sy);
      const inField = X >= fx0 && X <= fx1 && Y >= fy0 && Y <= fy1;
      if (isLine(X, Y)) return tint(white, (n - 0.5) * 0.05);
      const base = inField ? stripes[Math.floor((X - fx0) / 2) % 2] : outside;
      const blade = (sx + Math.floor(sy / 2)) % 4 === 0 && n > 0.55 ? 0.07 : 0;
      return tint(base, blade + (n - 0.5) * 0.06);
    };
  }
};

// Il campo da basket (come il campo da calcio, dipende dalla stanza): aggiunto qui sotto.
FLOOR_FACTORIES.court = (layout, door) => {
  let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
  for (let y = 0; y < layout.height; y += 1) {
    for (let x = 0; x < layout.width; x += 1) {
      if (!layout.isTile(x, y) || (door && door.x === x && door.y === y)) continue;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
  }
  // Campo una casella dentro i bordi; i canestri stanno sulla linea di fondo.
  const cx0 = x0 + 1.4;
  const cx1 = x1 - 0.4;
  const cy0 = y0 + 1.4;
  const cy1 = y1 - 0.4;
  const mx = (cx0 + cx1) / 2;
  const my = (cy0 + cy1) / 2;
  const W = 0.07;
  const keyDepth = 5.2;
  const keyHalf = 2.2;
  const three = Math.min(6.4, (cy1 - cy0) / 2 - 0.6);
  const woods = ['#d9a066', '#cf9458', '#e0a96f', '#c98c50'].map(rgb);
  const paint = rgb('#b45309');
  const outside = rgb('#7c3a1d');
  const white = rgb('#fafaf9');
  const near = (a, b) => Math.abs(a - b) < W;
  const isLine = (X, Y) => {
    if (X < cx0 - W || X > cx1 + W || Y < cy0 - W || Y > cy1 + W) return false;
    if (near(X, cx0) || near(X, cx1) || near(Y, cy0) || near(Y, cy1) || near(X, mx)) return true;
    const dc = Math.hypot(X - mx, Y - my);
    if (Math.abs(dc - 1.8) < W) return true;
    for (const [base, dir] of [[cx0, 1], [cx1, -1]]) {
      const d = (X - base) * dir;
      const hoop = { x: base + dir * 1.6, y: my };
      if (d >= 0 && d <= keyDepth && near(Math.abs(Y - my), keyHalf)) return true;
      if (near(d, keyDepth) && Math.abs(Y - my) <= keyHalf) return true;
      if (d > keyDepth && Math.abs(Math.hypot(X - (base + dir * keyDepth), Y - my) - 1.8) < W) return true;
      // Linea da tre punti: arco attorno al canestro, dritta vicino alla linea di fondo.
      const dh = Math.hypot(X - hoop.x, Y - hoop.y);
      if ((X - hoop.x) * dir >= 0 && Math.abs(dh - three) < W) return true;
      if ((X - hoop.x) * dir < 0 && d >= 0 && near(Math.abs(Y - my), three)) return true;
    }
    return false;
  };
  const inKey = (X, Y) => [[cx0, 1], [cx1, -1]].some(([base, dir]) => {
    const d = (X - base) * dir;
    return d >= 0 && d <= keyDepth && Math.abs(Y - my) <= keyHalf;
  });
  return (X, Y, sx, sy) => {
    const n = noise(sx, sy);
    if (isLine(X, Y)) return tint(white, (n - 0.5) * 0.04);
    const inCourt = X >= cx0 && X <= cx1 && Y >= cy0 && Y <= cy1;
    if (!inCourt) return tint(outside, (n - 0.5) * 0.06);
    if (inKey(X, Y) || Math.hypot(X - mx, Y - my) < 1.8) return tint(paint, (n - 0.5) * 0.05);
    // Parquet a listoni lungo il campo, con le giunture.
    const row = Math.floor(Y * 5);
    if (frac(Y * 5) < 0.06) return tint(woods[0], -0.2);
    const plank = Math.floor((X + noise(row, 3) * 3) / 2.5);
    const base = woods[Math.floor(noise(row, plank) * woods.length)];
    return tint(base, (n - 0.5) * 0.05 + (frac(Y * 5) < 0.2 ? 0.05 : 0));
  };
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
  // Casino: tappezzeria damascata bordeaux con il fregio dorato, boiserie scura e applique accese.
  casino: (() => {
    const damask = rgb('#5a0f1e');
    const pattern = rgb('#6f1626');
    const gold = rgb('#d4a537');
    const wood = rgb('#2a140c');
    const lamp = rgb('#ffe9a8');
    const board = { shadow: rgb('#0d0604'), board: rgb('#1c0d08'), trim: gold };
    return (col, h, height, side, sy) => {
      const bb = baseboard(h, board);
      if (bb) return bb;
      // Boiserie fino a meta' altezza, con le cornici dei pannelli.
      if (h < 34) {
        const panel = col % 24;
        if (h === 33 || h === 12) return gold;
        if ((panel === 2 || panel === 21) && h > 14 && h < 31) return tint(wood, 0.18);
        return tint(wood, (noise(col, sy) - 0.5) * 0.08 + (Math.floor(col / 3) % 2 ? 0.02 : 0));
      }
      // Fregio dorato in alto.
      if (h > height - 8 && h <= height - 5) return gold;
      // Applique: un globo di luce ogni 48 pixel, con l'alone sulla tappezzeria.
      const lx = col % 48 - 24;
      const ly = h - (34 + (height - 42) * 0.55);
      const dist = Math.sqrt(lx * lx + ly * ly * 2);
      if (dist < 3) return lamp;
      // Damasco: un motivo a goccia ripetuto, un tono sopra il fondo.
      const mx = (col % 16) - 8;
      const my = ((h - 34) % 22) - 11;
      const drop = Math.abs(mx) * 1.4 + Math.abs(my) * (my < 0 ? 0.6 : 1.1) < 8;
      const base = drop ? pattern : damask;
      return tint(base, (noise(col, sy) - 0.5) * 0.06 + Math.max(0, 0.35 - dist / 40));
    };
  })(),

  // Locale rock: mattoni neri, locandine dei concerti incollate storte e una striscia al neon rossa.
  rockclub: (() => {
    const bricks = ['#221c1e', '#2a2226', '#1b1618'].map(rgb);
    const mortar = rgb('#0c0a0b');
    const posters = ['#f97316', '#facc15', '#ef4444', '#22c55e', '#e5e7eb'].map(rgb);
    const neon = rgb('#ef4444');
    const board = { shadow: rgb('#050404'), board: rgb('#141012'), trim: rgb('#ef4444') };
    return (col, h, height, side, sy) => {
      const bb = baseboard(h, board);
      if (bb) return bb;
      if (h > height - 12 && h <= height - 9) return neon;
      // Locandine: rettangoli colorati con le righe del titolo.
      const slot = Math.floor(col / 46);
      const px0 = slot * 46 + 8 + Math.floor(noise(slot, 3) * 10);
      const py0 = 40 + Math.floor(noise(slot, 5) * 30);
      if (noise(slot, 9) > 0.35 && col >= px0 && col < px0 + 22 && h >= py0 && h < py0 + 30) {
        const poster = posters[Math.floor(noise(slot, 11) * posters.length)];
        if ((h - py0) % 7 === 2 && col > px0 + 3 && col < px0 + 18) return rgb('#111111');
        return tint(poster, (noise(col, sy) - 0.5) * 0.1);
      }
      const row = Math.floor(h / 6);
      const shift = row % 2 ? 7 : 0;
      if (h % 6 === 0 || (col + shift) % 14 === 0) return mortar;
      return tint(bricks[Math.floor(noise(Math.floor((col + shift) / 14), row) * 3)], (noise(col, sy) - 0.5) * 0.08);
    };
  })(),

  // Rock Store: doghe di legno scuro e una fascia arancione, come i negozi di strumenti.
  rockstore: (() => {
    const woods = ['#4a2f22', '#553626', '#3f281d'].map(rgb);
    const band = rgb('#f97316');
    const board = { shadow: rgb('#140c08'), board: rgb('#2e1d14'), trim: rgb('#f97316') };
    return (col, h, height, side, sy) => {
      const bb = baseboard(h, board);
      if (bb) return bb;
      if (h > height - 16 && h <= height - 12) return band;
      const plank = Math.floor(col / 6);
      if (col % 6 === 0) return tint(woods[0], -0.35);
      const grain = Math.sin(h * 0.4 + noise(plank, 2) * 10) > 0.88 ? -0.1 : 0;
      return tint(woods[plank % woods.length], grain + (noise(col, sy) - 0.5) * 0.05);
    };
  })(),

  // Quartiere all'aperto: dietro la recinzione di mattoni si vedono i palazzi con le finestre
  // accese, i tetti e il cielo della sera.
  street: (() => {
    const brick = ['#8a4b38', '#7c4232', '#94533e'].map(rgb);
    const mortar = rgb('#5a3428');
    const cap = rgb('#b9b4aa');
    const blocks = ['#6b5b7a', '#7a6a58', '#5b6b7a', '#7a5b5b'].map(rgb);
    const win = rgb('#ffd98a');
    const winOff = rgb('#2c3346');
    const sky = [rgb('#f4a261'), rgb('#e76f51'), rgb('#6a4c93'), rgb('#2a2350')];
    return (col, h, height, side, sy) => {
      if (h < 3) return rgb('#4a4a4a');
      // Muretto di mattoni con la copertina di pietra.
      if (h < 26) {
        if (h > 22) return cap;
        const row = Math.floor(h / 5);
        const shift = row % 2 ? 6 : 0;
        if (h % 5 === 0 || (col + shift) % 12 === 0) return mortar;
        return tint(brick[Math.floor(noise(Math.floor((col + shift) / 12), row) * 3)], (noise(col, sy) - 0.5) * 0.08);
      }
      // Palazzi di altezze diverse, con le finestre (alcune accese).
      const bx = Math.floor(col / 30);
      const top = 70 + Math.floor(noise(bx, 9) * 70);
      if (h < top) {
        const base = blocks[Math.floor(noise(bx, 2) * blocks.length)];
        if (h > top - 4) return tint(base, 0.2);
        const inWin = col % 6 >= 2 && col % 6 <= 4 && h % 10 >= 3 && h % 10 <= 7;
        if (inWin) return noise(Math.floor(col / 6), Math.floor(h / 10) + bx) > 0.45 ? win : winOff;
        return tint(base, (noise(col, sy) - 0.5) * 0.06);
      }
      const t = Math.min(1, (h - 70) / Math.max(1, height - 70));
      return sky[Math.min(sky.length - 1, Math.floor(t * sky.length))];
    };
  })(),

  // Boutique: boiserie crema con le cornici dorate e gli specchi.
  boutique: (() => {
    const panel = rgb('#f3ead8');
    const trim = rgb('#c9a24a');
    const mirror = rgb('#bcc6d4');
    const board = { shadow: rgb('#2a2218'), board: rgb('#6b5638'), trim: rgb('#c9a24a') };
    return (col, h, height, side, sy) => {
      const bb = baseboard(h, board);
      if (bb) return bb;
      if (h > height - 8) return h > height - 3 ? tint(trim, 0.2) : trim;
      const p = col % 36;
      if (p === 0 || p === 35) return trim;
      if (p > 8 && p < 28 && h > 30 && h < height - 22) {
        if (p === 9 || p === 27 || h === 31 || h === height - 23) return trim;
        return (col + h) % 30 < 2 ? rgb('#f8fbff') : tint(mirror, (noise(col, sy) - 0.5) * 0.06);
      }
      return tint(panel, (noise(col, sy) - 0.5) * 0.04);
    };
  })(),

  // Concessionaria: vetrate grandi sulla strada con i montanti neri, zoccolo in cemento.
  showroom: (() => {
    const concrete = rgb('#9aa0a8');
    const frame = rgb('#16181d');
    const glassTop = rgb('#9fd3ec');
    const glassLow = rgb('#4a7f99');
    const board = { shadow: rgb('#0e0f12'), board: rgb('#2a2d33'), trim: rgb('#e11d48') };
    return (col, h, height, side, sy) => {
      const bb = baseboard(h, board);
      if (bb) return bb;
      if (h < 18) return tint(concrete, (noise(col, sy) - 0.5) * 0.08);
      if (h > height - 10) return frame;
      if (col % 48 < 3 || h === 18 || h === 19) return frame;
      const t = (h - 18) / (height - 28);
      const c = mix(glassLow, glassTop, t);
      return (col + h * 1.2) % 70 < 4 ? mix(c, rgb('#ffffff'), 0.5) : c;
    };
  })(),

  // Caffetteria: pannelli verde bosco, mensola di legno a meta' e la lavagna del menu.
  coffeehouse: (() => {
    const green = rgb('#1f4b3a');
    const greenDark = rgb('#163a2c');
    const wood = rgb('#8a5a3b');
    const chalk = rgb('#1c211f');
    const board = { shadow: rgb('#120c08'), board: rgb('#5b3a26'), trim: rgb('#8a5a3b') };
    return (col, h, height, side, sy) => {
      const bb = baseboard(h, board);
      if (bb) return bb;
      if (h >= 44 && h < 48) return h === 47 ? tint(wood, 0.2) : wood;
      if (h < 44) return (col % 10 === 0) ? greenDark : tint(green, (noise(col, sy) - 0.5) * 0.05);
      const p = col % 80;
      if (p > 12 && p < 60 && h > 60 && h < height - 16) {
        if (p === 13 || p === 59 || h === 61 || h === height - 17) return wood;
        const writing = (h % 8 === 3) && ((col * 7 + h) % 11 < 7);
        return writing ? rgb('#e8e2d0') : tint(chalk, (noise(col, sy) - 0.5) * 0.08);
      }
      return tint(green, (noise(col, sy) - 0.5) * 0.05);
    };
  })(),

  // Discoteca anni 80: velluto viola, pannelli a specchio, due strisce al neon rosa e azzurro
  // e una fila di lampadine in cima, come le insegne dei locali di Saturday Night Fever.
  disco: (() => {
    const velvet = rgb('#2a0f3d');
    const velvetDark = rgb('#1d0a2b');
    const mirror = rgb('#8f8aa8');
    const mirrorHi = rgb('#e8e6f5');
    const pink = rgb('#ff4fd8');
    const cyan = rgb('#38e8ff');
    const bulb = rgb('#ffe27a');
    const board = { shadow: rgb('#07030b'), board: rgb('#140820'), trim: rgb('#ff4fd8') };
    return (col, h, height, side, sy) => {
      const bb = baseboard(h, board);
      if (bb) return bb;
      // Lampadine in cima alla parete.
      if (h > height - 7) {
        const onBulb = col % 10 < 3 && h > height - 6 && h < height - 2;
        return onBulb ? bulb : velvetDark;
      }
      if (h > height - 12 && h <= height - 9) return pink;
      if (h > height - 16 && h <= height - 13) return cyan;
      // Pannelli a specchio fra le lesene di velluto, con il riflesso in diagonale.
      const panel = col % 40;
      if (h > 16 && h < height - 22 && panel > 8 && panel < 32) {
        if (panel === 9 || panel === 31) return tint(mirror, -0.3);
        const diag = (col + h) % 36;
        return diag < 3 ? mirrorHi : tint(mirror, (noise(col, sy) - 0.5) * 0.08 - (h % 12 === 0 ? 0.15 : 0));
      }
      const fold = Math.sin(col * 0.9) * 0.05;
      return tint(Math.floor(col / 4) % 2 ? velvet : velvetDark, fold + (noise(col, sy) - 0.5) * 0.05);
    };
  })(),

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

  // Orizzonte sul mare: staccionata bianca, il mare fino all'orizzonte e il cielo con le nuvole.
  seaside: (() => {
    const skyTop = rgb('#3fa2e0');
    const skyLow = rgb('#b9e6ff');
    const cloud = rgb('#ffffff');
    const seaFar = rgb('#2b8fc4');
    const seaNear = rgb('#1f6fa3');
    const glint = rgb('#d9f3ff');
    const fence = rgb('#f5f1e6');
    const post = rgb('#d9d0bd');
    return (col, h, height, side, sy) => {
      if (h < 3) return rgb('#b89a64');
      // Staccionata: due traverse e i paletti, con la sabbia che si vede in mezzo.
      if (h < 30) {
        if (col % 24 < 4) return h > 27 ? tint(post, 0.2) : post;
        if ((h >= 10 && h < 14) || (h >= 22 && h < 26)) return tint(fence, h % 4 === 0 ? -0.08 : 0);
        return mix(rgb('#e8cf9a'), rgb('#d4b57a'), h / 30);
      }
      const horizon = 62;
      if (h < horizon) {
        const t = (h - 30) / (horizon - 30);
        let color = mix(seaNear, seaFar, t);
        const wave = Math.sin(col * 0.35 + h * 1.7 + smoothNoise(col * 0.05, h * 0.3, 61) * 5);
        if (wave > 0.93) color = mix(color, glint, 0.6);
        return tint(color, (noise(col, sy) - 0.5) * 0.04);
      }
      if (h === horizon) return tint(seaFar, 0.25);
      const t = (h - horizon) / (height - horizon);
      let color = mix(skyLow, skyTop, t);
      const c = fbm(col * 0.025, h * 0.06, 71);
      if (c > 0.62) color = mix(color, cloud, Math.min(1, (c - 0.62) * 5));
      return color;
    };
  })(),

  // Vetrine dei negozi: zoccolo in pietra, vetrine illuminate, tende a righe e insegne colorate.
  shops: (() => {
    const stone = rgb('#6b6570');
    const frame = rgb('#2b2233');
    const glassLow = rgb('#f6d27a');
    const glassHigh = rgb('#fbe7b5');
    const plaster = rgb('#c9b79c');
    const awnings = [['#dc2626', '#fef2f2'], ['#16a34a', '#f0fdf4'], ['#2563eb', '#eff6ff'], ['#9333ea', '#faf5ff']]
      .map(([a, b]) => [rgb(a), rgb(b)]);
    const board = { shadow: rgb('#1c1820'), board: rgb('#4a4450'), trim: rgb('#8a8290') };
    return (col, h, height, side, sy) => {
      const bb = baseboard(h, board);
      if (bb) return bb;
      const shop = Math.floor(col / 96);
      const inShop = col % 96;
      if (h < 22) return tint(stone, (noise(col, sy) - 0.5) * 0.1 + (h % 11 === 0 ? -0.2 : 0));
      if (inShop < 8 || inShop > 88) return tint(plaster, (noise(col, sy) - 0.5) * 0.06);
      const [stripeA, stripeB] = awnings[Math.floor(noise(shop, 5) * awnings.length)];
      if (h >= 84 && h < 100) {
        // Tenda a righe con il bordo a smerli.
        if (h < 88 && (inShop % 8) < 4) return tint(plaster, -0.1);
        return tint(Math.floor(inShop / 6) % 2 ? stripeA : stripeB, h > 96 ? 0.1 : 0);
      }
      if (h >= 100) {
        if (h > 108 && h < 122 && inShop > 20 && inShop < 76) {
          const letter = noise(Math.floor(inShop / 5), shop) > 0.45 && h % 4 !== 0;
          return letter ? rgb('#fbbf24') : frame;
        }
        return tint(plaster, (noise(col, sy) - 0.5) * 0.06);
      }
      if (h < 26 || h > 80 || inShop < 12 || inShop > 84 || (inShop > 46 && inShop < 50)) return frame;
      // Vetrina accesa: calda in basso, con i riflessi in diagonale e la merce sugli scaffali.
      const t = (h - 26) / 54;
      let color = mix(glassLow, glassHigh, t);
      if (h % 18 === 8) color = tint(color, -0.35);
      else if (h % 18 > 8 && h % 18 < 14 && noise(col >> 2, h >> 2) > 0.5) {
        color = mix(color, rgb(['#ef4444', '#3b82f6', '#22c55e', '#a855f7'][Math.floor(noise(col >> 2, shop) * 4)]), 0.7);
      }
      if ((col + h) % 40 < 2) color = mix(color, rgb('#ffffff'), 0.5);
      return color;
    };
  })(),

  // Sipario di velluto rosso: pieghe morbide, frangia dorata in basso e una mantovana in cima.
  curtain: (() => {
    const velvet = rgb('#8b1a2b');
    const deep = rgb('#4f0d18');
    const gold = rgb('#d4a73a');
    return (col, h, height, side, sy) => {
      if (h < 2) return rgb('#1a0a0e');
      if (h > height - 18) {
        const scallop = h < height - 14 + Math.abs(Math.sin(col * 0.2)) * 4;
        if (scallop && h < height - 12) return tint(gold, h % 2 ? -0.1 : 0.1);
        return tint(mix(velvet, deep, 0.3), Math.sin(col * 0.5) * 0.08);
      }
      if (h < 10) return (col + h) % 3 === 0 ? tint(gold, -0.3) : gold;
      const fold = Math.sin(col * 0.33 + Math.sin(h * 0.02) * 0.6);
      const color = mix(deep, velvet, (fold + 1) / 2);
      return tint(color, (fold > 0.9 ? 0.15 : 0) + (noise(col, sy) - 0.5) * 0.03);
    };
  })(),

  // Palestra: parete dipinta in basso, specchi a tutta larghezza sopra e una fascia arancione.
  mirror: (() => {
    const paint = rgb('#3f4a5a');
    const stripe = rgb('#f59e0b');
    const glassLow = rgb('#9fb4c7');
    const glassHigh = rgb('#d6e4ef');
    const frame = rgb('#c0c7cf');
    const board = { shadow: rgb('#15181d'), board: rgb('#2a2f36'), trim: rgb('#f59e0b') };
    return (col, h, height, side, sy) => {
      const bb = baseboard(h, board);
      if (bb) return bb;
      if (h < 30) return tint(paint, (noise(col, sy) - 0.5) * 0.05);
      if (h < 36) return stripe;
      if (h > height - 12) return tint(paint, 0.1);
      if (h < 38 || h > height - 15 || col % 64 < 2) return frame;
      const t = (h - 38) / (height - 53);
      let color = mix(glassLow, glassHigh, t);
      const diag = (col + h * 0.8) % 70;
      if (diag < 4) color = mix(color, rgb('#ffffff'), 0.55);
      else if (diag > 9 && diag < 11) color = mix(color, rgb('#ffffff'), 0.3);
      return color;
    };
  })(),

  // Stadio: cartelloni pubblicitari a bordo campo, gradinate piene di tifosi e il cielo con i fari.
  stadium: (() => {
    const boards = ['#1d4ed8', '#dc2626', '#16a34a', '#7c3aed', '#f59e0b'].map(rgb);
    const concrete = rgb('#6b7280');
    const step = rgb('#4b5563');
    const crowd = ['#ef4444', '#3b82f6', '#fbbf24', '#f5f5f5', '#22c55e', '#1d4ed8', '#dc2626', '#a855f7'].map(rgb);
    const skins = ['#f3d2b3', '#c68a5a', '#8d5a3b', '#e0b088'].map(rgb);
    const skyTop = rgb('#0b1a3a');
    const skyLow = rgb('#27406e');
    return (col, h, height, side, sy) => {
      if (h < 2) return rgb('#14532d');
      // Cartelloni: pannelli colorati con una scritta chiara a blocchi.
      if (h < 20) {
        const panel = Math.floor(col / 48);
        const base = boards[panel % boards.length];
        if (h < 4 || h > 17 || col % 48 < 2) return tint(base, -0.45);
        const letter = h > 7 && h < 14 && col % 48 > 8 && col % 48 < 40 && (col % 6 < 4) && noise(Math.floor(col / 6), panel) > 0.3;
        return letter ? rgb('#f8fafc') : tint(base, (noise(col, sy) - 0.5) * 0.05);
      }
      if (h < 24) return concrete;
      // Gradinate: file di tifosi (testa e maglia) su gradini di cemento.
      if (h < height - 26) {
        const row = Math.floor((h - 24) / 9);
        const inRow = (h - 24) % 9;
        if (inRow === 0) return tint(step, -0.2);
        if (inRow < 3) return step;
        const seat = Math.floor((col + row * 3) / 4);
        if (noise(seat, row, 5) < 0.12) return tint(concrete, -0.1);
        const inSeat = (col + row * 3) % 4;
        if (inSeat === 3) return tint(step, -0.1);
        const shirt = crowd[Math.floor(noise(seat, row, 9) * crowd.length)];
        if (inRow < 6) return tint(shirt, (noise(col, sy) - 0.5) * 0.1);
        if (inSeat === 0) return tint(step, -0.1);
        return skins[Math.floor(noise(seat, row, 11) * skins.length)];
      }
      if (h < height - 23) return tint(concrete, 0.15);
      const t = (h - (height - 23)) / 23;
      let color = mix(skyLow, skyTop, t);
      // Alone dei fari in cima alle tribune.
      const glow = Math.max(0, 1 - Math.abs((col % 160) - 80) / 60) * (1 - t) * 0.5;
      if (glow > 0) color = mix(color, rgb('#fef9c3'), glow);
      return noise(col, h) > 0.997 ? rgb('#ffffff') : color;
    };
  })(),

  // Negozio di fumetti e carte: scaffali pieni di albi in basso, parete viola con il logo
  // VinylDex al neon ripetuto lungo il muro.
  comics: (() => {
    const paint = rgb('#2e1a4f');
    const paintAlt = rgb('#33205a');
    const shelf = rgb('#5b3a29');
    const covers = ['#ef4444', '#3b82f6', '#facc15', '#22c55e', '#ec4899', '#f97316', '#a855f7', '#14b8a6', '#f5f5f5'].map(rgb);
    const board = { shadow: rgb('#120a20'), board: rgb('#2b1a16'), trim: rgb('#ec4899') };
    const logo = logoBitmap();
    const neonA = rgb('#f472b6');
    const neonB = rgb('#22d3ee');
    return (col, h, height, side, sy) => {
      const bb = baseboard(h, board);
      if (bb) return bb;
      // Tre ripiani di fumetti con le costole colorate.
      if (h < 64) {
        const row = Math.floor((h - 10) / 18);
        const inRow = (h - 10) % 18;
        if (inRow < 3) return tint(shelf, inRow === 2 ? 0.2 : -0.1);
        const spine = Math.floor(col / 3);
        const tall = 10 + Math.floor(noise(spine, row, 3) * 5);
        if (inRow - 3 > tall) return tint(shelf, -0.45);
        const color = covers[Math.floor(noise(spine, row) * covers.length)];
        return tint(color, (col % 3 === 0 ? -0.25 : 0) + (noise(col, sy) - 0.5) * 0.06);
      }
      if (h < 67) return tint(shelf, 0.15);
      // Logo: si legge dal bitmap disegnato una volta sola; alone del neon intorno.
      if (logo) {
        // Sulla parete sinistra la colonna scorre al contrario: si legge il logo da destra.
        const lx = side === 'left' ? 439 - (col % 440) : col % 440;
        const ly = height - 14 - h;
        if (lx < logo.width && ly >= 0 && ly < logo.height) {
          const a = logo.alpha[ly * logo.width + lx];
          if (a > 120) return mix(neonA, neonB, lx / logo.width);
          if (a > 20) return mix(paint, neonA, 0.45);
        }
      }
      return tint((Math.floor(col / 24) % 2 ? paint : paintAlt), (noise(col, sy) - 0.5) * 0.04);
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

/**
 * Scritta "VINYLDEX · CARDS & COMICS" disegnata una volta in un canvas e letta pixel per pixel
 * dalla parete del negozio di fumetti. Senza documento (test, server) non c'e' logo.
 */
function logoBitmap() {
  if (typeof document === 'undefined') return null;
  const width = 360;
  const height = 64;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '900 40px "Arial Black", Arial, sans-serif';
  ctx.fillText('VINYLDEX', width / 2, 40);
  ctx.font = '700 14px Arial, sans-serif';
  ctx.fillText('CARDS & COMICS', width / 2, 60);
  const data = ctx.getImageData(0, 0, width, height).data;
  const alpha = new Uint8Array(width * height);
  for (let i = 0; i < alpha.length; i += 1) alpha[i] = data[i * 4 + 3];
  return { width, height, alpha };
}

/** Bordi della stanza (caselle vere, porta esclusa). */
function roomBounds(layout, door) {
  let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
  for (let y = 0; y < layout.height; y += 1) {
    for (let x = 0; x < layout.width; x += 1) {
      if (!layout.isTile(x, y) || (door && door.x === x && door.y === y)) continue;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
  }
  return { x0, x1, y0, y1 };
}

/**
 * Pista dei go-kart: il prato in mezzo (sette caselle dentro i bordi) e la linea che seguono i kart
 * in gara, a meta' fra il prato e il bordo. Serve al pavimento e al motore (i kart che girano).
 */
export function kartTrack(layout, door) {
  const { x0, x1, y0, y1 } = roomBounds(layout, door);
  const infield = { x0: x0 + 7, x1: x1 - 6, y0: y0 + 7, y1: y1 - 6 };
  return {
    infield,
    cx: (x0 + x1 + 1) / 2,
    cy: (y0 + y1 + 1) / 2,
    a: ((x1 + 1 - x0) + (infield.x1 - infield.x0)) / 4,
    b: ((y1 + 1 - y0) + (infield.y1 - infield.y0)) / 4,
    startX: (x0 + x1 + 1) / 2 + 1
  };
}

/** Punto della pista a una frazione t del giro (0 = linea di partenza, in basso), in caselle. */
export function kartPoint(track, u) {
  const p = unitPoint(u);
  return { x: track.cx + track.a * p.x, y: track.cy + track.b * p.y };
}

// Pista dei go-kart: asfalto, prato in mezzo con i cordoli bianchi e rossi, linea di partenza a scacchi.
FLOOR_FACTORIES.kart = (layout, door) => {
  const bounds = roomBounds(layout, door);
  const track = kartTrack(layout, door);
  const { infield } = track;
  const asphalt = rgb('#3f3f46');
  const grass = ['#3f9a3f', '#48a846'].map(rgb);
  const red = rgb('#dc2626');
  const white = rgb('#f4f4f5');
  const black = rgb('#18181b');
  const CURB = 0.35;
  return (X, Y, sx, sy) => {
    const n = noise(sx, sy);
    const inInfield = X >= infield.x0 && X <= infield.x1 && Y >= infield.y0 && Y <= infield.y1;
    if (inInfield) {
      const edge = Math.min(X - infield.x0, infield.x1 - X, Y - infield.y0, infield.y1 - Y);
      if (edge < CURB) return Math.floor((X + Y) * 2) % 2 ? red : white;
      return tint(grass[Math.floor(X - infield.x0) % 2], (n - 0.5) * 0.08);
    }
    // Cordolo esterno lungo i bordi della stanza.
    const outer = Math.min(X - bounds.x0, bounds.x1 + 1 - X, Y - bounds.y0, bounds.y1 + 1 - Y);
    if (outer < CURB * 0.8) return Math.floor((X + Y) * 2) % 2 ? red : white;
    // Linea di partenza a scacchi, sul rettilineo in basso.
    if (X >= track.startX && X < track.startX + 0.5 && Y > infield.y1) {
      return (Math.floor(X * 4) + Math.floor(Y * 4)) % 2 ? black : white;
    }
    return tint(asphalt, (n - 0.5) * 0.12 + (hashDot(sx, sy) ? 0.12 : 0));
  };
};

function hashDot(x, y) {
  return noise(x * 7, y * 13) > 0.93;
}

/**
 * Quartiere: il viale (orizzontale) e la via (verticale) si incrociano al centro della stanza,
 * con i marciapiedi, le strisce pedonali e le linee di mezzeria. Le quattro zone fra le strade:
 * piazze lastricate in alto (i negozi), il parco a sinistra in basso, i prati delle ville a destra.
 * Le stesse misure le usa BE/scripts/hotel_rooms.py per mettere negozi e ville.
 */
export function streetPlan(layout) {
  let x1 = 0; let y1 = 0;
  for (let y = 0; y < layout.height; y += 1) {
    for (let x = 0; x < layout.width; x += 1) {
      if (!layout.isTile(x, y)) continue;
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  const ay0 = Math.floor(y1 / 2) - 1;
  const sx0 = Math.floor(x1 / 2) - 1;
  return { ay0, ay1: ay0 + 3, sx0, sx1: sx0 + 3, x1, y1 };
}

FLOOR_FACTORIES.street = (layout) => {
  const { ay0, ay1, sx0, sx1 } = streetPlan(layout);
  const asphalt = rgb('#34363d');
  const walk = ['#b9b4aa', '#c4bfb4'].map(rgb);
  const curb = rgb('#8d8a84');
  const white = rgb('#eef0f2');
  const yellow = rgb('#f2c230');
  const paver = ['#d8c9ad', '#cdbb9b', '#e1d4ba'].map(rgb);
  const grass = ['#4f9a3f', '#58a547'].map(rgb);
  const path = rgb('#d9c9a3');
  const hedge = rgb('#2f6f2a');
  return (X, Y, sx, sy) => {
    const n = noise(sx, sy);
    const tx = Math.floor(X);
    const ty = Math.floor(Y);
    const onAvenue = ty >= ay0 && ty <= ay1;
    const onStreet = tx >= sx0 && tx <= sx1;
    if (onAvenue || onStreet) {
      // Strisce pedonali dove i marciapiedi attraversano la strada.
      const zebraAv = onAvenue && (tx === sx0 - 1 || tx === sx1 + 1);
      const zebraSt = onStreet && (ty === ay0 - 1 || ty === ay1 + 1);
      if (zebraAv && frac(Y * 2) < 0.55) return tint(white, (n - 0.5) * 0.06);
      if (zebraSt && frac(X * 2) < 0.55) return tint(white, (n - 0.5) * 0.06);
      const inCross = onAvenue && onStreet;
      // Mezzeria gialla doppia e linee tratteggiate delle corsie.
      if (onAvenue && !onStreet && !zebraAv) {
        const mid = (ay0 + ay1 + 1) / 2;
        if (Math.abs(Y - mid + 0.06) < 0.025 || Math.abs(Y - mid - 0.06) < 0.025) return yellow;
        if ((Math.abs(Y - (ay0 + 1)) < 0.03 || Math.abs(Y - (ay1)) < 0.03) && frac(X / 2) < 0.5) return white;
      }
      if (onStreet && !onAvenue && !zebraSt) {
        const mid = (sx0 + sx1 + 1) / 2;
        if (Math.abs(X - mid + 0.06) < 0.025 || Math.abs(X - mid - 0.06) < 0.025) return yellow;
      }
      if (inCross && (frac(X) < 0.02 || frac(Y) < 0.02) && n > 0.7) return tint(asphalt, 0.05);
      return tint(asphalt, (n - 0.5) * 0.09 + (hashDot(sx, sy) ? 0.1 : 0));
    }
    // Marciapiedi lungo le strade, con il cordolo verso l'asfalto.
    const sideAv = ty === ay0 - 1 || ty === ay1 + 1;
    const sideSt = tx === sx0 - 1 || tx === sx1 + 1;
    if (sideAv || sideSt) {
      if ((ty === ay0 - 1 && frac(Y) > 0.9) || (ty === ay1 + 1 && frac(Y) < 0.1)) return curb;
      if ((tx === sx0 - 1 && frac(X) > 0.9) || (tx === sx1 + 1 && frac(X) < 0.1)) return curb;
      const tile = (Math.floor(X * 2) + Math.floor(Y * 2)) % 2;
      if (frac(X * 2) < 0.04 || frac(Y * 2) < 0.04) return tint(walk[0], -0.12);
      return tint(walk[tile], (n - 0.5) * 0.05);
    }
    const top = ty < ay0;
    const left = tx < sx0;
    if (top) {
      // Piazze dei negozi: pavimento a cubetti chiari a spina.
      const bx = Math.floor(X * 3);
      const by = Math.floor(Y * 3);
      if (frac(X * 3) < 0.08 || frac(Y * 3) < 0.08) return tint(paver[0], -0.2);
      return tint(paver[(bx * 7 + by * 3) % 3], (n - 0.5) * 0.06);
    }
    if (left) {
      // Parco: prato con i vialetti a croce.
      if (Math.abs(X - sx0 / 2) < 0.5 || Math.abs(Y - (ay1 + 6.5)) < 0.5) return tint(path, (n - 0.5) * 0.08);
      return tint(grass[(Math.floor(X) + Math.floor(Y)) % 2], (n - 0.5) * 0.08 + ((sx + sy) % 5 === 0 ? 0.05 : 0));
    }
    // Ville: prati curati divisi da siepi basse, con il vialetto d'ingresso.
    const lot = Math.floor((X - (sx1 + 2)) / 6);
    const inLotX = (X - (sx1 + 2)) - lot * 6;
    if (inLotX < 0.12) return tint(hedge, (n - 0.5) * 0.1);
    if (Math.abs(inLotX - 2.5) < 0.45) return tint(path, (n - 0.5) * 0.08);
    return tint(grass[(Math.floor(X * 2) + Math.floor(Y * 2)) % 2], (n - 0.5) * 0.07);
  };
};

/**
 * Citta' del Quartiere (BE/scripts/hotel_rooms.py, CITY_ROWS e CITY_COL): quattro viali
 * orizzontali larghi 4 caselle, una via verticale fra il primo e l'ultimo, marciapiedi, la fila dei
 * palazzi sopra ogni viale, giardini fra un viale e la fila dopo, la piazza in alto e le ville in
 * fondo, nei lotti con la siepe.
 */
export const CITY_PLAN = { rows: [9, 20, 31, 42], col: 24 };

FLOOR_FACTORIES.city = () => {
  const { rows, col } = CITY_PLAN;
  const asphalt = rgb('#34363d');
  const walk = ['#b9b4aa', '#c4bfb4'].map(rgb);
  const curb = rgb('#8d8a84');
  const white = rgb('#eef0f2');
  const yellow = rgb('#f2c230');
  const paver = ['#d8c9ad', '#cdbb9b', '#e1d4ba'].map(rgb);
  const grass = ['#4f9a3f', '#58a547'].map(rgb);
  const path = rgb('#d9c9a3');
  const hedge = rgb('#2f6f2a');
  const first = rows[0];
  const last = rows[rows.length - 1];
  const avenueOf = (ty) => rows.find((s) => ty >= s && ty <= s + 3);
  return (X, Y, sx, sy) => {
    const n = noise(sx, sy);
    const tx = Math.floor(X);
    const ty = Math.floor(Y);
    const av = avenueOf(ty);
    const onAvenue = av !== undefined;
    const onStreet = tx >= col && tx <= col + 3 && ty >= first && ty <= last + 3;
    if (onAvenue || onStreet) {
      const zebraAv = onAvenue && (tx === col - 1 || tx === col + 4);
      const zebraSt = onStreet && !onAvenue && (avenueOf(ty - 1) !== undefined || avenueOf(ty + 1) !== undefined);
      if (zebraAv && frac(Y * 2) < 0.55) return tint(white, (n - 0.5) * 0.06);
      if (zebraSt && frac(X * 2) < 0.55) return tint(white, (n - 0.5) * 0.06);
      if (onAvenue && !onStreet && !zebraAv) {
        const mid = av + 2;
        if (Math.abs(Y - mid + 0.06) < 0.025 || Math.abs(Y - mid - 0.06) < 0.025) return yellow;
        if ((Math.abs(Y - (av + 1)) < 0.03 || Math.abs(Y - (av + 3)) < 0.03) && frac(X / 2) < 0.5) return white;
      }
      if (onStreet && !onAvenue && !zebraSt) {
        const mid = col + 2;
        if (Math.abs(X - mid + 0.06) < 0.025 || Math.abs(X - mid - 0.06) < 0.025) return yellow;
      }
      return tint(asphalt, (n - 0.5) * 0.09 + (hashDot(sx, sy) ? 0.1 : 0));
    }
    // Marciapiedi: la riga sopra e sotto ogni viale e le colonne ai lati della via.
    const sideAv = rows.some((s) => ty === s - 1 || ty === s + 4);
    const sideSt = (tx === col - 1 || tx === col + 4) && ty >= first && ty <= last + 3;
    if (sideAv || sideSt) {
      if (rows.some((s) => (ty === s - 1 && frac(Y) > 0.9) || (ty === s + 4 && frac(Y) < 0.1))) return curb;
      if ((tx === col - 1 && frac(X) > 0.9) || (tx === col + 4 && frac(X) < 0.1)) return curb;
      const tile = (Math.floor(X * 2) + Math.floor(Y * 2)) % 2;
      if (frac(X * 2) < 0.04 || frac(Y * 2) < 0.04) return tint(walk[0], -0.12);
      return tint(walk[tile], (n - 0.5) * 0.05);
    }
    // Ville in fondo: prato con le siepi fra un lotto e l'altro e il vialetto d'ingresso.
    if (ty > last + 4) {
      const lot = Math.floor((X - 1) / 6);
      const inLot = (X - 1) - lot * 6;
      if (inLot < 0.12) return tint(hedge, (n - 0.5) * 0.1);
      if (Math.abs(inLot - 2.5) < 0.45 && ty < last + 8) return tint(path, (n - 0.5) * 0.08);
      return tint(grass[(Math.floor(X * 2) + Math.floor(Y * 2)) % 2], (n - 0.5) * 0.07);
    }
    // Fila dei palazzi (le tre righe sopra il marciapiede) e piazza in alto: cubetti a spina.
    const buildingRow = rows.some((s) => ty >= s - 4 && ty <= s - 2);
    if (buildingRow || ty < first - 4) {
      const bx = Math.floor(X * 3);
      const by = Math.floor(Y * 3);
      if (frac(X * 3) < 0.08 || frac(Y * 3) < 0.08) return tint(paver[0], -0.2);
      return tint(paver[(bx * 7 + by * 3) % 3], (n - 0.5) * 0.06);
    }
    // Giardini fra un viale e la fila dopo: prato con il vialetto in mezzo.
    const garden = rows.find((s) => ty >= s + 5 && ty <= s + 7);
    if (garden !== undefined && Math.abs(Y - (garden + 6.5)) < 0.4) return tint(path, (n - 0.5) * 0.08);
    return tint(grass[(Math.floor(X) + Math.floor(Y)) % 2], (n - 0.5) * 0.08 + ((sx + sy) % 5 === 0 ? 0.05 : 0));
  };
};

/**
 * Palaghiaccio: la pista sta due caselle dentro i bordi (come il campo da calcio), ghiaccio
 * bianco con i graffi dei pattini, linea rossa a meta', linee blu, cerchi d'ingaggio e aree
 * delle porte. Fuori dalla balaustra un pavimento di gomma scura.
 */
FLOOR_FACTORIES.ice = (layout, door) => {
  let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
  for (let y = 0; y < layout.height; y += 1) {
    for (let x = 0; x < layout.width; x += 1) {
      if (!layout.isTile(x, y) || (door && door.x === x && door.y === y)) continue;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
  }
  const fx0 = x0 + 2;
  const fx1 = x1 - 1;
  const fy0 = y0 + 2;
  const fy1 = y1 - 1;
  const mx = (fx0 + fx1) / 2;
  const my = (fy0 + fy1) / 2;
  const blue = [fx0 + (fx1 - fx0) / 3, fx0 + ((fx1 - fx0) * 2) / 3];
  const ice = rgb('#eef6fb');
  const iceShade = rgb('#d9e9f3');
  const red = rgb('#d62839');
  const blueLine = rgb('#1f5fbf');
  const crease = rgb('#8ecdf7');
  const board = rgb('#f7f7f2');
  const kick = rgb('#f2c230');
  const rubber = rgb('#2b2d33');
  const W = 0.08;
  return (X, Y, sx, sy) => {
    const n = noise(sx, sy);
    const inRink = X >= fx0 && X <= fx1 && Y >= fy0 && Y <= fy1;
    const nearEdge = X >= fx0 - 0.25 && X <= fx1 + 0.25 && Y >= fy0 - 0.25 && Y <= fy1 + 0.25;
    if (!inRink) {
      if (nearEdge) return X < fx0 - 0.12 || X > fx1 + 0.12 || Y < fy0 - 0.12 || Y > fy1 + 0.12 ? kick : board;
      return tint(rubber, (n - 0.5) * 0.08 + ((sx + sy) % 3 === 0 ? 0.03 : 0));
    }
    if (Math.abs(X - mx) < W) return red;
    if (blue.some((b) => Math.abs(X - b) < W * 1.4)) return blueLine;
    const d = Math.hypot(X - mx, Y - my);
    if (Math.abs(d - Math.min(2.2, (fy1 - fy0) / 4)) < W * 0.7 || d < 0.15) return d < 0.15 ? blueLine : red;
    for (const [gx, dir] of [[fx0 + 1, 1], [fx1 - 1, -1]]) {
      // Linea di porta e area semicircolare azzurra.
      if (Math.abs(X - gx) < W * 0.6) return red;
      const dg = Math.hypot(X - gx, Y - my);
      if ((X - gx) * dir > 0 && dg < 1.2) return dg > 1.14 ? red : crease;
      // Cerchi d'ingaggio nelle due zone.
      for (const fy of [my - (fy1 - fy0) / 4, my + (fy1 - fy0) / 4]) {
        const cx = gx + dir * 2.6;
        const dc = Math.hypot(X - cx, Y - fy);
        if (Math.abs(dc - 1.2) < W * 0.7 || dc < 0.13) return red;
      }
    }
    // Graffi dei pattini: tratti chiari e scuri in diagonale.
    const scratch = Math.abs(Math.sin(X * 9 + Y * 3 + noise(Math.floor(X * 3), Math.floor(Y * 3)) * 6)) < 0.03;
    return scratch ? iceShade : tint(ice, (n - 0.5) * 0.04);
  };
};

export const FLOOR_STYLES = [...Object.keys(FLOORS), ...Object.keys(FLOOR_FACTORIES)];
export const WALL_STYLES = Object.keys(WALLS);

// ------------------------------------------------------------------ immagine della stanza

/**
 * @returns {{ canvas, originX, originY }} immagine della stanza e posizione, al suo interno,
 * del vertice alto della casella (0, 0).
 */
export function renderRoom(layout, floorName, door, wallName = floorName, weather = null) {
  const floor = FLOOR_FACTORIES[floorName] ? FLOOR_FACTORIES[floorName](layout, door) : (FLOORS[floorName] || FLOORS.neon);
  const wallPaint = WALLS[wallName] || WALLS.neon;
  const isDoor = (x, y) => door && door.x === x && door.y === y;
  // Festone della stagione lungo la cima delle pareti.
  const garland = garlandPaint(weather);

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

  // Pareti: dietro a tutto, lungo i lati che confinano con il vuoto. Sopra la porta il muro
  // continua, con il vano scuro dell'ingresso.
  const topCap = rgb('#6a5a96');
  const doorColorWall = rgb('#1b1530');
  const doorFrame = rgb('#8a6a4a');
  for (let y = 0; y < layout.height; y += 1) {
    for (let x = 0; x < layout.width; x += 1) {
      const z = layout.heightAt(x, y);
      if (z < 0) continue;
      const t = tileTop(x, y, z);
      const tx = originX + t.x;
      const ty = originY + t.y;
      const wallTop = WALL_H - z * LEVEL_H;
      const sides = [];
      if (!isDoor(x, y) && !layout.isTile(x - 1, y) && !isDoor(x - 1, y)) sides.push('left');
      if (!isDoor(x, y) && !layout.isTile(x, y - 1) && !isDoor(x, y - 1)) sides.push('right');
      // Dietro la casella della porta: il muro c'e', con il vano scuro e la cornice.
      const doorSide = isDoor(x, y) ? null : isDoor(x - 1, y) ? 'left' : isDoor(x, y - 1) ? 'right' : null;
      if (doorSide) {
        const opening = Math.round(wallTop * 0.66);
        for (let c = 0; c < HALF_W; c += 1) {
          const sx = doorSide === 'left' ? tx - HALF_W + c : tx + c;
          const baseY = doorSide === 'left' ? ty + HALF_H - Math.floor(c / 2) : ty + Math.floor(c / 2);
          const col = doorSide === 'left' ? (y + 1) * HALF_W - c : x * HALF_W + c;
          const edge = c < 3 || c >= HALF_W - 3;
          for (let h = 0; h < wallTop; h += 1) {
            const hAbs = h + z * LEVEL_H;
            let color;
            if (h < opening && !edge) {
              // Vano della porta: buio che sfuma verso l'alto.
              color = tint(doorColorWall, -0.4 * (h / opening));
            } else if ((edge && h < opening + 3) || (h >= opening && h < opening + 3)) {
              color = doorFrame;
            } else {
              color = wallPaint(col, hAbs, WALL_H, doorSide, baseY - h);
              const deco = garland ? garland(col, hAbs, WALL_H) : null;
              if (deco) color = rgb(deco);
            }
            if (doorSide === 'right') color = tint(color, -0.18);
            put(sx, baseY - 1 - h, color);
          }
          for (let k = 0; k < 4; k += 1) put(sx, baseY - wallTop - 1 - k, k === 3 ? tint(topCap, 0.3) : topCap);
        }
      }
      sides.forEach((side) => {
        for (let c = 0; c < HALF_W; c += 1) {
          const sx = side === 'left' ? tx - HALF_W + c : tx + c;
          const baseY = side === 'left' ? ty + HALF_H - Math.floor(c / 2) : ty + Math.floor(c / 2);
          // Colonna continua lungo il muro: a sinistra si corre lungo y, a destra lungo x.
          const col = side === 'left' ? (y + 1) * HALF_W - c : x * HALF_W + c;
          for (let h = 0; h < wallTop; h += 1) {
            const hAbs = h + z * LEVEL_H;
            let color = wallPaint(col, hAbs, WALL_H, side, baseY - h);
            const deco = garland ? garland(col, hAbs, WALL_H) : null;
            if (deco) color = rgb(deco);
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
        // La casella della porta sta dietro il muro: si vede solo attraverso il vano.
        if (isDoor(x, y)) continue;
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
