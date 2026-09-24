import { createCanvas, px, shade } from './pixel.js';
import { AVATAR_FOOT_X, AVATAR_FOOT_Y, AVATAR_H, AVATAR_W, avatarSprite } from './avatar.js';
import { viewForDirection } from '../iso.js';

/**
 * Schermata d'ingresso dell'hotel, come la "hotel view" di Habbo: l'edificio isometrico al
 * tramonto, con un vinile gigante al posto del sole, l'insegna al neon e qualche avatar che
 * passeggia sulla piazza.
 *
 * Tutto e' disegnato a bassa risoluzione e poi ingrandito a pixel netti. Le parti ferme
 * (cielo, skyline, piazza, hotel) vengono preparate una volta sola su due livelli fuori
 * schermo; a ogni fotogramma si ridisegnano solo stelle, nuvole, vinile, luci e avatar.
 */

const SKY = ['#0b0620', '#100829', '#170b35', '#1f0e42', '#2a114f', '#38145b', '#4a1765', '#5f1a6c',
  '#771e6f', '#8f256e', '#a82f6b', '#c13d65', '#d94f5e', '#ec6658'];
const WINDOW_LIGHTS = ['#ffd76a', '#ffd76a', '#ff7ad9', '#7ae8ff'];
const WINDOW_DARK = '#1a0f33';

/** Font a blocchi 3x5 per l'insegna: solo le lettere che servono. */
const FONT = {
  V: ['101', '101', '101', '101', '010'],
  I: ['111', '010', '010', '010', '111'],
  N: ['101', '111', '111', '101', '101'],
  Y: ['101', '101', '010', '010', '010'],
  L: ['100', '100', '100', '100', '111'],
  D: ['110', '101', '101', '101', '110'],
  E: ['111', '100', '110', '100', '111'],
  X: ['101', '101', '010', '101', '101'],
  H: ['101', '101', '111', '101', '101'],
  O: ['111', '101', '101', '101', '111'],
  T: ['111', '010', '010', '010', '010']
};

/** Generatore pseudo-casuale con seme: la scena e' la stessa a ogni visita. */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(n) {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

/** Colonna i di una faccia di un blocco isometrico: x e riga di base. */
function faceColumn(box, face, i) {
  return face === 'right'
    ? { x: box.x + i, yb: box.y - (i >> 1) }
    : { x: box.x - 1 - i, yb: box.y - (i >> 1) };
}

/**
 * Blocco isometrico pieno, con lo spigolo frontale in basso in (box.x, box.y).
 * `a` e' la profondita' verso destra, `b` verso sinistra, `h` l'altezza.
 */
function drawBox(ctx, box, pal) {
  const { x, y, a, b, h } = box;
  for (let i = 0; i < 2 * a; i += 1) {
    const c = faceColumn(box, 'right', i);
    px(ctx, c.x, c.yb - h, 1, h, pal.right);
  }
  for (let i = 0; i < 2 * b; i += 1) {
    const c = faceColumn(box, 'left', i);
    px(ctx, c.x, c.yb - h, 1, h, pal.left);
  }
  for (let t = -2 * b; t < 2 * a; t += 1) {
    const ti = t >= 0 ? t : -1 - t;
    const yl = y - h - (ti >> 1);
    const yu = t <= 2 * a - 2 * b
      ? y - h - b - Math.floor((t + 2 * b) / 2)
      : y - h - a - b + Math.floor((t - (2 * a - 2 * b)) / 2);
    if (yl > yu) px(ctx, x + t, yu, 1, yl - yu, pal.top);
  }
  // Spigoli illuminati: danno volume come nei pixel art di Habbo.
  px(ctx, x - 1, y - h, 1, h, shade(pal.left, 0.22));
  px(ctx, x, y - h, 1, h, shade(pal.right, 0.12));
  for (let i = 0; i < 2 * a; i += 1) px(ctx, x + i, y - h - (i >> 1) - 1, 1, 1, shade(pal.top, 0.25));
  for (let i = 0; i < 2 * b; i += 1) px(ctx, x - 1 - i, y - h - (i >> 1) - 1, 1, 1, shade(pal.top, 0.25));
}

/** Finestra larga quattro colonne su una faccia: segue l'inclinazione a scalini. */
function drawWindow(ctx, win, color) {
  win.columns.forEach(({ x, top }) => px(ctx, x, top, 1, win.height, color));
}

function drawText(ctx, text, x, y, size, color) {
  let cx = x;
  [...text].forEach((ch) => {
    const glyph = FONT[ch];
    if (glyph) {
      glyph.forEach((row, ry) => [...row].forEach((bit, rx) => {
        if (bit === '1') px(ctx, cx + rx * size, y + ry * size, size, size, color);
      }));
    }
    cx += 4 * size;
  });
}

const textWidth = (text, size) => text.length * 4 * size - size;

function cloudSprite(rand, width) {
  const height = Math.round(width * 0.32);
  const { canvas, ctx } = createCanvas(width, height + 2);
  const puffs = 3 + Math.floor(rand() * 3);
  for (let p = 0; p < puffs; p += 1) {
    const r = Math.round(height * (0.35 + rand() * 0.3));
    const cx = Math.round(r + rand() * (width - 2 * r));
    const cy = height - r;
    for (let yy = -r; yy <= r; yy += 1) {
      const half = Math.round(Math.sqrt(r * r - yy * yy) * 1.4);
      px(ctx, cx - half, cy + yy, half * 2, 1, yy > r * 0.35 ? '#6b2468' : '#2c1650');
    }
  }
  return canvas;
}

function lampSprite() {
  const { canvas, ctx } = createCanvas(15, 40);
  ctx.fillStyle = 'rgba(255, 215, 106, 0.12)';
  ctx.fillRect(0, 0, 15, 14);
  ctx.fillStyle = 'rgba(255, 215, 106, 0.18)';
  ctx.fillRect(3, 1, 9, 10);
  px(ctx, 7, 6, 1, 32, '#0f0a1f');
  px(ctx, 8, 6, 1, 32, '#2a1d4a');
  px(ctx, 5, 37, 5, 3, '#0f0a1f');
  px(ctx, 5, 3, 5, 4, '#ffe9a8');
  px(ctx, 6, 2, 3, 1, '#0f0a1f');
  px(ctx, 6, 4, 3, 2, '#ffffff');
  return canvas;
}

function palmSprite(rand) {
  const { canvas, ctx } = createCanvas(46, 64);
  const lean = rand() > 0.5 ? 1 : -1;
  let tx = 23;
  for (let y = 62; y > 16; y -= 1) {
    const bend = Math.round(((62 - y) ** 2) / 300) * lean;
    px(ctx, tx + bend - 1, y, 3, 1, (y % 4 === 0) ? '#140c26' : '#1c1233');
    px(ctx, tx + bend + 1, y, 1, 1, '#4a1f55');
  }
  tx += Math.round(((62 - 16) ** 2) / 300) * lean;
  // Foglie: archi di pixel scuri che ricadono, con il bordo acceso dal tramonto.
  [-1, 1].forEach((side) => {
    [0.2, 0.9, 1.6].forEach((spread) => {
      for (let s = 0; s < 20; s += 1) {
        const lx = tx + side * s;
        const ly = 16 - Math.round(spread * 6 * Math.sin((s / 20) * Math.PI * 0.9)) + Math.round((s * s) / 40);
        px(ctx, lx, ly, 2, 2, '#150d28');
        px(ctx, lx, ly - 1, 1, 1, '#6b2468');
      }
    });
  });
  px(ctx, tx - 2, 14, 5, 4, '#150d28');
  return canvas;
}

/** Aspetto casuale ma valido, nello stesso formato del server (s.h.hc.sh.p). */
function randomLook(rand) {
  const pick = (n) => Math.floor(rand() * n);
  return `s${pick(6)}.h${pick(10)}.hc${pick(10)}.sh${pick(12)}.p${pick(8)}.t${pick(5)}.f${pick(6)}.a${pick(7)}`;
}

/** Spostamento in pixel per ogni passo nelle quattro diagonali isometriche. */
const WALK = { 0: [2, -1], 2: [2, 1], 4: [-2, 1], 6: [-2, -1] };

export class HotelViewScene {
  constructor(width, height, seed = 7) {
    this.w = width;
    this.h = height;
    this.rand = seeded(seed);
    this.time = 0;
    this.layout();
    this.back = this.bakeBack();
    this.front = this.bakeFront();
    this.spawnClouds();
    this.spawnWalkers();
  }

  layout() {
    const { w, h } = this;
    this.groundY = Math.round(h * 0.58);
    this.baseY = Math.round(h * 0.8);
    this.hotelX = Math.round(w * 0.42);
    const r = Math.round(clamp(h * 0.26, 30, 110));
    this.sun = { x: Math.round(w * 0.16), y: this.groundY - Math.round(r * 0.6), r };
    this.podium = { x: this.hotelX, y: this.baseY, a: 40, b: 32, h: 26 };
    // La torre poggia al centro del basamento: il punto (8, 6) del tetto in coordinate isometriche.
    const towerX = this.hotelX + 2 * 8 - 2 * 6;
    const towerY = this.baseY - this.podium.h - 8 - 6;
    this.tower = { x: towerX, y: towerY, a: 24, b: 20, h: clamp(towerY - 70, 40, 220) };
    const roofY = towerY - this.tower.h;
    this.roofCenter = { x: towerX + (this.tower.a - this.tower.b), y: roofY - (this.tower.a + this.tower.b) / 2 };
    this.sign = { w: 72, h: 31 };
    this.sign.x = Math.round(this.roofCenter.x - this.sign.w / 2);
    this.sign.y = Math.round(this.roofCenter.y - 8 - this.sign.h);
    this.walkTop = this.baseY + 8;
  }

  /** Cielo a fasce con retinatura sui bordi, stelle fisse e bagliore all'orizzonte. */
  bakeBack() {
    const { w, groundY } = this;
    const { canvas, ctx } = createCanvas(w, groundY + 1);
    const band = groundY / SKY.length;
    for (let y = 0; y <= groundY; y += 1) {
      const pos = y / band;
      const idx = Math.min(SKY.length - 1, Math.floor(pos));
      const frac = pos - idx;
      px(ctx, 0, y, w, 1, SKY[idx]);
      // Retinatura a scacchi nell'ultimo tratto di ogni fascia, come nei giochi a 16 colori.
      if (frac > 0.7 && idx < SKY.length - 1) {
        for (let x = (y % 2); x < w; x += 2) px(ctx, x, y, 1, 1, SKY[idx + 1]);
      }
    }
    this.stars = [];
    const count = Math.round((w * groundY) / 420);
    for (let i = 0; i < count; i += 1) {
      this.stars.push({
        x: Math.floor(this.rand() * w),
        y: Math.floor(this.rand() * groundY * 0.55),
        phase: this.rand() * Math.PI * 2,
        big: this.rand() < 0.08
      });
    }
    this.disc = this.bakeDisc();
    return canvas;
  }

  /** Il vinile-sole: solchi, riflesso e bordo acceso. L'etichetta gira a parte. */
  bakeDisc() {
    const { r } = this.sun;
    const size = r * 2 + 4;
    const { canvas, ctx } = createCanvas(size, size);
    const c = r + 2;
    const labelR = Math.round(r * 0.34);
    for (let y = -r - 2; y <= r + 2; y += 1) {
      for (let x = -r - 2; x <= r + 2; x += 1) {
        const d = Math.sqrt(x * x + y * y);
        let color = null;
        if (d <= r + 2 && d > r) color = d > r + 1 ? '#ff4fa3' : '#ff9bd0';
        else if (d <= r && d > labelR) {
          const groove = Math.floor(d) % 3 === 0;
          const angle = Math.atan2(y, x);
          // Riflesso fermo sui solchi: due spicchi di luce, come un disco sotto un faretto.
          const sheen = Math.abs(Math.sin(angle - 0.7)) > 0.93;
          color = sheen ? (groove ? '#5b3d73' : '#3d2952') : (groove ? '#221833' : '#120c1d');
        }
        if (color) px(ctx, c + x, c + y, 1, 1, color);
      }
    }
    this.label = this.bakeLabel(labelR);
    return canvas;
  }

  bakeLabel(labelR) {
    const size = labelR * 2 + 1;
    const { canvas, ctx } = createCanvas(size, size);
    for (let y = -labelR; y <= labelR; y += 1) {
      for (let x = -labelR; x <= labelR; x += 1) {
        const d = Math.sqrt(x * x + y * y);
        if (d > labelR) continue;
        let color = y < -labelR * 0.2 ? '#ffb347' : y < labelR * 0.3 ? '#ff7a59' : '#ec4899';
        if (d < 2) color = '#0b0620';
        // Una striscia chiara rende visibile la rotazione.
        else if (x > 2 && Math.abs(y) < 2) color = '#ffe9c7';
        px(ctx, labelR + x, labelR + y, 1, 1, color);
      }
    }
    return canvas;
  }

  /** Skyline, piazza, tappeto rosso e hotel: tutto quello che non si muove davanti al cielo. */
  bakeFront() {
    const { w, h, groundY } = this;
    const { canvas, ctx } = createCanvas(w, h);

    // Piazza con griglia isometrica al neon, piu' viva verso chi guarda.
    const image = ctx.createImageData(w, h - groundY);
    const ox = this.hotelX;
    const oy = this.baseY;
    for (let y = groundY; y < h; y += 1) {
      const depth = (y - groundY) / (h - groundY);
      for (let x = 0; x < w; x += 1) {
        const dx = x - ox;
        const dy = y - oy;
        const u = (((dx / 2 + dy) % 16) + 16) % 16;
        const v = (((dy - dx / 2) % 16) + 16) % 16;
        const line = u < 1 || v < 1;
        const i = ((y - groundY) * w + x) * 4;
        const base = [21, 12, 44];
        const neon = [124, 44, 170];
        const mix = line ? 0.25 + depth * 0.55 : 0;
        image.data[i] = base[0] + (neon[0] - base[0]) * mix;
        image.data[i + 1] = base[1] + (neon[1] - base[1]) * mix;
        image.data[i + 2] = base[2] + (neon[2] - base[2]) * mix;
        image.data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, groundY);
    px(ctx, 0, groundY, w, 1, '#ff7ad9');
    px(ctx, 0, groundY + 1, w, 1, '#a0307a');

    this.drawSkyline(ctx);
    this.drawCarpet(ctx);
    this.drawHotel(ctx);
    return canvas;
  }

  drawSkyline(ctx) {
    const { w, groundY, sun } = this;
    const labelTop = Math.max(6, groundY - sun.y - Math.round(sun.r * 0.34) - 4);
    [{ color: '#1a1238', lit: 0.05, min: 0.18, max: 0.42 }, { color: '#221650', lit: 0.1, min: 0.08, max: 0.28 }]
      .forEach((layer) => {
        let x = -Math.floor(this.rand() * 20);
        while (x < w) {
          const bw = 10 + Math.floor(this.rand() * 26);
          let bh = Math.round(groundY * (layer.min + this.rand() * (layer.max - layer.min)));
          // Davanti al vinile i palazzi restano bassi, per lasciare vedere l'etichetta.
          if (x + bw > sun.x - sun.r * 0.55 && x < sun.x + sun.r * 0.55) bh = Math.min(bh, labelTop);
          px(ctx, x, groundY - bh, bw, bh, layer.color);
          if (this.rand() < 0.3) px(ctx, x + Math.floor(bw / 2), groundY - bh - 6, 1, 6, layer.color);
          for (let wy = groundY - bh + 3; wy < groundY - 2; wy += 4) {
            for (let wx = x + 2; wx < x + bw - 2; wx += 3) {
              if (this.rand() < layer.lit) px(ctx, wx, wy, 1, 2, WINDOW_LIGHTS[Math.floor(this.rand() * 4)]);
            }
          }
          x += bw + Math.floor(this.rand() * 4);
        }
      });
  }

  /** Tappeto rosso dalla porta del basamento verso la piazza. */
  drawCarpet(ctx) {
    const door = faceColumn(this.podium, 'left', this.podium.b - 4);
    const length = Math.round((this.h - door.yb) * 1.2);
    for (let t = 0; t < length; t += 1) {
      for (let j = 0; j < 8; j += 1) {
        const color = j === 0 || j === 7 ? '#ffd76a' : '#b0214f';
        px(ctx, door.x - j - 2 * t, door.yb - (j >> 1) + t, 2, 1, color);
      }
    }
  }

  drawHotel(ctx) {
    const pod = this.podium;
    const tower = this.tower;
    this.windows = [];

    drawBox(ctx, pod, { left: '#3b1f6e', right: '#2a1552', top: '#5b2fa0' });
    // Vetrate della hall su entrambe le facce, con la porta a sinistra.
    ['left', 'right'].forEach((face) => {
      const span = face === 'left' ? pod.b * 2 : pod.a * 2;
      for (let i = 3; i < span - 3; i += 1) {
        if (i % 7 === 0) continue;
        const c = faceColumn(pod, face, i);
        px(ctx, c.x, c.yb - 20, 1, 14, face === 'left' ? '#2b6f8f' : '#1f5470');
        px(ctx, c.x, c.yb - 20, 1, 1, '#7ae8ff');
      }
    });
    for (let i = pod.b - 4; i < pod.b + 4; i += 1) {
      const c = faceColumn(pod, 'left', i);
      px(ctx, c.x, c.yb - 17, 1, 17, i === pod.b - 4 || i === pod.b + 3 ? '#ffd76a' : '#9ff3ff');
      px(ctx, c.x, c.yb - 23, 1, 4, (i >> 1) % 2 ? '#ec4899' : '#fdf2f8');
      px(ctx, c.x, c.yb - 19, 1, 1, '#831843');
    }

    drawBox(ctx, tower, { left: '#4c2a8a', right: '#321a66', top: '#6d3fc0' });
    ['left', 'right'].forEach((face) => {
      const span = face === 'left' ? tower.b * 2 : tower.a * 2;
      const shadeFace = face === 'left' ? '#3d216f' : '#27134f';
      for (let f = 0; f * 12 + 14 <= tower.h; f += 1) {
        for (let i = 0; i < span; i += 1) {
          const c = faceColumn(tower, face, i);
          if (f > 0) px(ctx, c.x, c.yb - f * 12, 1, 1, shadeFace);
        }
        for (let i0 = 3; i0 + 3 < span - 2; i0 += 7) {
          const columns = [];
          for (let i = i0; i < i0 + 4; i += 1) {
            const c = faceColumn(tower, face, i);
            columns.push({ x: c.x, top: c.yb - f * 12 - 10 });
          }
          const lit = this.rand() < 0.55;
          const light = WINDOW_LIGHTS[Math.floor(this.rand() * WINDOW_LIGHTS.length)];
          // La faccia destra e' in ombra: anche le sue luci sono un po' piu' scure.
          const color = !lit ? WINDOW_DARK : face === 'right' ? shade(light, -0.2) : light;
          const win = { columns, height: 6, color, flicker: this.rand() < 0.14, seed: this.rand() * 1000 };
          drawWindow(ctx, win, color);
          this.windows.push(win);
        }
      }
    });

    // Pali dell'insegna sul tetto.
    const { sign, roofCenter } = this;
    px(ctx, sign.x + 10, sign.y + sign.h, 2, roofCenter.y - sign.y - sign.h + 2, '#140c26');
    px(ctx, sign.x + sign.w - 12, sign.y + sign.h, 2, roofCenter.y - sign.y - sign.h + 2, '#140c26');
    px(ctx, sign.x + sign.w - 22, sign.y - 12, 1, 12, '#140c26');
    px(ctx, sign.x - 1, sign.y - 1, sign.w + 2, sign.h + 2, '#ff4fa3');
    px(ctx, sign.x, sign.y, sign.w, sign.h, '#140a26');
  }

  spawnClouds() {
    this.clouds = [];
    const count = Math.max(3, Math.round(this.w / 140));
    for (let i = 0; i < count; i += 1) {
      const width = 40 + Math.floor(this.rand() * 50);
      this.clouds.push({
        sprite: cloudSprite(this.rand, width),
        x: this.rand() * (this.w + width) - width,
        y: Math.round(this.groundY * (0.12 + this.rand() * 0.42)),
        speed: 0.002 + this.rand() * 0.004
      });
    }
  }

  spawnWalkers() {
    const { w, h } = this;
    this.walkers = [];
    const count = clamp(Math.round(w / 90), 3, 8);
    for (let i = 0; i < count; i += 1) {
      this.walkers.push({
        look: randomLook(this.rand),
        x: 12 + this.rand() * (w - 24),
        y: this.walkTop + this.rand() * Math.max(1, h - 3 - this.walkTop),
        dir: [0, 2, 4, 6][Math.floor(this.rand() * 4)],
        left: 1500 + this.rand() * 3000,
        idle: 0,
        pose: 'walk'
      });
    }
    this.props = [
      { x: Math.round(w * 0.08), y: this.baseY + 14, sprite: palmSprite(this.rand), fx: 23, fy: 62 },
      { x: Math.round(w * 0.78), y: this.baseY + 10, sprite: palmSprite(this.rand), fx: 23, fy: 62 },
      { x: Math.round(w * 0.27), y: this.baseY + 30, sprite: lampSprite(), fx: 7, fy: 39 },
      { x: Math.round(w * 0.62), y: this.baseY + 34, sprite: lampSprite(), fx: 7, fy: 39 }
    ];
  }

  update(dt) {
    this.time += dt;
    const { w, h } = this;
    this.clouds.forEach((cloud) => {
      cloud.x += cloud.speed * dt;
      if (cloud.x > w) cloud.x = -cloud.sprite.width;
    });
    this.walkers.forEach((walker) => {
      if (walker.idle > 0) {
        walker.idle -= dt;
        return;
      }
      walker.pose = 'walk';
      const [sx, sy] = WALK[walker.dir];
      const step = dt * 0.018;
      const nx = walker.x + sx * step;
      const ny = walker.y + sy * step;
      walker.left -= dt;
      const outside = nx < 10 || nx > w - 10 || ny < this.walkTop || ny > h - 3;
      if (outside || walker.left <= 0) {
        // Si gira verso l'interno della piazza; ogni tanto si ferma a salutare o a ballare.
        const options = [0, 2, 4, 6].filter((d) => {
          const [ddx, ddy] = WALK[d];
          return walker.x + ddx * 20 > 10 && walker.x + ddx * 20 < w - 10
            && walker.y + ddy * 20 > this.walkTop && walker.y + ddy * 20 < h - 3;
        });
        walker.dir = options[Math.floor(Math.random() * options.length)] ?? (walker.dir + 4) % 8;
        walker.left = 1500 + Math.random() * 3500;
        if (!outside && Math.random() < 0.35) {
          walker.idle = 1500 + Math.random() * 2500;
          walker.pose = ['stand', 'wave', 'dance'][Math.floor(Math.random() * 3)];
        }
        return;
      }
      walker.x = nx;
      walker.y = ny;
    });
  }

  render(ctx, animate = true) {
    const t = this.time;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.drawImage(this.back, 0, 0);

    this.stars.forEach((star) => {
      const glow = animate ? Math.sin(t / 700 + star.phase) : 1;
      if (glow < -0.6) return;
      px(ctx, star.x, star.y, 1, 1, glow > 0.5 ? '#ffffff' : '#b9a7e8');
      if (star.big && glow > 0.3) {
        px(ctx, star.x - 1, star.y, 3, 1, 'rgba(255,255,255,0.45)');
        px(ctx, star.x, star.y - 1, 1, 3, 'rgba(255,255,255,0.45)');
      }
    });

    // Vinile-sole: il disco e' fermo, l'etichetta gira a 33 giri scarsi.
    const { sun } = this;
    ctx.drawImage(this.disc, sun.x - sun.r - 2, sun.y - sun.r - 2);
    ctx.save();
    ctx.translate(sun.x + 0.5, sun.y + 0.5);
    ctx.rotate(animate ? t / 900 : 0.6);
    ctx.drawImage(this.label, -Math.floor(this.label.width / 2), -Math.floor(this.label.height / 2));
    ctx.restore();

    this.clouds.forEach((cloud) => ctx.drawImage(cloud.sprite, Math.round(cloud.x), cloud.y));
    ctx.drawImage(this.front, 0, 0);

    this.windows.forEach((win) => {
      if (!win.flicker || !animate) return;
      const on = hash(Math.floor(t / 2600) + win.seed) > 0.4;
      drawWindow(ctx, win, on ? win.color : WINDOW_DARK);
    });
    this.drawSign(ctx, t, animate);

    const sprites = [
      ...this.props.map((p) => ({ y: p.y, draw: () => ctx.drawImage(p.sprite, p.x - p.fx, p.y - p.fy) })),
      ...this.walkers.map((walker) => ({ y: walker.y, draw: () => this.drawWalker(ctx, walker, t, animate) }))
    ];
    sprites.sort((a, b) => a.y - b.y).forEach((s) => s.draw());
  }

  drawSign(ctx, t, animate) {
    const { sign } = this;
    const top = 'VINYLDEX';
    const bottom = 'HOTEL';
    const topX = sign.x + Math.round((sign.w - textWidth(top, 2)) / 2);
    const bottomX = sign.x + Math.round((sign.w - textWidth(bottom, 2)) / 2);
    const slot = Math.floor(t / 110);
    [...top].forEach((ch, i) => {
      const off = animate && hash(slot * 13 + i) < 0.025;
      const x = topX + i * 8;
      if (!off) {
        [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([ox, oy]) => drawText(ctx, ch, x + ox, sign.y + 4 + oy, 2, '#7a1f5c'));
      }
      drawText(ctx, ch, x, sign.y + 4, 2, off ? '#3a1330' : '#ff7ad9');
    });
    [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([ox, oy]) => drawText(ctx, bottom, bottomX + ox, sign.y + 17 + oy, 2, '#155e75'));
    drawText(ctx, bottom, bottomX, sign.y + 17, 2, '#7ae8ff');
    // Luce rossa lampeggiante sull'antenna, per gli aerei.
    const blink = !animate || Math.floor(t / 600) % 2 === 0;
    px(ctx, sign.x + sign.w - 23, sign.y - 14, 3, 3, blink ? '#ff3b3b' : '#5c1a1a');
  }

  drawWalker(ctx, walker, t, animate) {
    const view = viewForDirection(walker.dir);
    const walking = animate && walker.idle <= 0;
    const pose = walking ? 'walk' : (animate ? walker.pose : 'stand');
    const frame = animate ? Math.floor(t / 125) % 4 : 0;
    const x = Math.round(walker.x);
    const y = Math.round(walker.y);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(x - 5, y - 1, 10, 2);
    ctx.fillRect(x - 3, y - 2, 6, 4);
    // Gli avatar sono disegnati per le stanze, a doppia risoluzione: qui vanno a meta'.
    ctx.drawImage(avatarSprite(walker.look, { ...view, pose, frame }), x - AVATAR_FOOT_X / 2, y - AVATAR_FOOT_Y / 2,
      AVATAR_W / 2, AVATAR_H / 2);
  }
}
