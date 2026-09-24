import { HALF_H, HALF_W } from '../iso.js';
import { createCanvas, shade } from './pixel.js';
import { getRarityColor, resolveCardImage } from '../../utils/cardUtils.js';
import { BASE_URL } from '../../services/apiClient.js';

/**
 * Mobili in pixel art, disegnati da codice come gli avatar.
 *
 * Ogni mobile e' fatto di parallelepipedi isometrici ("box") in coordinate di casella:
 * u lungo x, v lungo y, z in pixel verso l'alto. Il box si disegna con tre facce (sopra,
 * sinistra, destra) riempite riga per riga, cosi' i bordi restano netti anche ingranditi.
 *
 * I tipi devono coincidere con FurniCatalog.java. Uno sprite ha l'ancora nel vertice alto
 * della casella d'angolo del mobile, lo stesso punto che il renderer calcola con tileTop.
 */
const OUTLINE = '#140d24';
const PAD = 48;

/** Riempie un poligono convesso a righe intere: niente anti-aliasing sui bordi. */
function fillPolygon(ctx, points, color) {
  const ys = points.map((p) => p.y);
  const minY = Math.ceil(Math.min(...ys));
  const maxY = Math.floor(Math.max(...ys));
  ctx.fillStyle = color;
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
    ctx.fillRect(left, y, Math.max(1, right - left), 1);
  }
}

/**
 * Un box da (u0,v0) a (u1,v1) in caselle, dalla quota z0 alla z1 in pixel.
 * I colori delle facce laterali sono ricavati dal colore del tetto, piu' scuri.
 */
function box(ctx, ox, oy, { u0, v0, u1, v1, z0 = 0, z1, color, left, right, outline = true }) {
  const P = (u, v, z) => ({ x: ox + (u - v) * HALF_W, y: oy + (u + v) * HALF_H - z });
  const topFace = [P(u0, v0, z1), P(u1, v0, z1), P(u1, v1, z1), P(u0, v1, z1)];
  const leftFace = [P(u0, v1, z1), P(u1, v1, z1), P(u1, v1, z0), P(u0, v1, z0)];
  const rightFace = [P(u1, v0, z1), P(u1, v1, z1), P(u1, v1, z0), P(u1, v0, z0)];
  if (outline) {
    const grow = (face) => {
      const cx = face.reduce((s, p) => s + p.x, 0) / face.length;
      const cy = face.reduce((s, p) => s + p.y, 0) / face.length;
      return face.map((p) => ({ x: p.x + Math.sign(p.x - cx), y: p.y + Math.sign(p.y - cy) }));
    };
    [topFace, leftFace, rightFace].forEach((f) => fillPolygon(ctx, grow(f), OUTLINE));
  }
  fillPolygon(ctx, leftFace, left || shade(color, -0.2));
  fillPolygon(ctx, rightFace, right || shade(color, -0.38));
  fillPolygon(ctx, topFace, color);
}

/** Pixel singolo o rettangolo in coordinate di casella, per dettagli come luci e manopole. */
function dot(ctx, ox, oy, u, v, z, color, w = 1, h = 1) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(ox + (u - v) * HALF_W), Math.round(oy + (u + v) * HALF_H - z), w, h);
}

/**
 * Ogni disegnatore riceve le coordinate gia' ruotate: con rot 2 gli assi si scambiano, cosi'
 * lo stesso codice disegna il mobile girato di 90 gradi.
 */
const DRAW = {
  chair_neon(b) {
    b({ u0: 0.2, v0: 0.2, u1: 0.8, v1: 0.8, z0: 0, z1: 8, color: '#3b2a78' });
    b({ u0: 0.2, v0: 0.2, u1: 0.8, v1: 0.8, z0: 8, z1: 11, color: '#8b5cf6' });
    b({ u0: 0.2, v0: 0.2, u1: 0.36, v1: 0.8, z0: 11, z1: 26, color: '#ec4899' });
  },
  sofa_vinyl(b) {
    b({ u0: 0.08, v0: 0.12, u1: 1.92, v1: 0.92, z0: 0, z1: 9, color: '#1e1b3a' });
    b({ u0: 0.08, v0: 0.12, u1: 1.92, v1: 0.92, z0: 9, z1: 12, color: '#22d3ee' });
    b({ u0: 0.08, v0: 0.12, u1: 1.92, v1: 0.34, z0: 12, z1: 24, color: '#1a8fa3' });
    b({ u0: 0.08, v0: 0.12, u1: 0.28, v1: 0.92, z0: 12, z1: 17, color: '#1a8fa3' });
    b({ u0: 1.72, v0: 0.12, u1: 1.92, v1: 0.92, z0: 12, z1: 17, color: '#1a8fa3' });
  },
  table_round(b) {
    b({ u0: 0.42, v0: 0.42, u1: 0.58, v1: 0.58, z0: 0, z1: 13, color: '#6b7280' });
    b({ u0: 0.14, v0: 0.14, u1: 0.86, v1: 0.86, z0: 13, z1: 16, color: '#f5f5f5', left: '#c9c9d6', right: '#a9a9b8' });
  },
  plant_palm(b, { ctx, ox, oy }) {
    b({ u0: 0.3, v0: 0.3, u1: 0.7, v1: 0.7, z0: 0, z1: 9, color: '#b45309' });
    b({ u0: 0.44, v0: 0.44, u1: 0.56, v1: 0.56, z0: 9, z1: 26, color: '#65a30d' });
    const leaf = (u0, v0, u1, v1, z) => b({ u0, v0, u1, v1, z0: z, z1: z + 3, color: '#22c55e' });
    leaf(0.1, 0.4, 0.5, 0.6, 24);
    leaf(0.5, 0.4, 0.95, 0.6, 26);
    leaf(0.4, 0.05, 0.6, 0.5, 25);
    leaf(0.4, 0.5, 0.6, 0.95, 23);
    dot(ctx, ox, oy, 0.5, 0.5, 31, '#bbf7d0', 2, 1);
  },
  lamp_neon(b, { ctx, ox, oy }) {
    b({ u0: 0.3, v0: 0.3, u1: 0.7, v1: 0.7, z0: 0, z1: 3, color: '#1f1f2e' });
    b({ u0: 0.46, v0: 0.46, u1: 0.54, v1: 0.54, z0: 3, z1: 30, color: '#4b4570' });
    b({ u0: 0.25, v0: 0.25, u1: 0.75, v1: 0.75, z0: 30, z1: 40, color: '#67e8f9', left: '#22d3ee', right: '#0e7490' });
    dot(ctx, ox, oy, 0.5, 0.5, 41, '#ffffff', 3, 1);
  },
  rug_vinyl(b, { ctx, ox, oy }) {
    b({ u0: 0.05, v0: 0.05, u1: 1.95, v1: 1.95, z0: 0, z1: 1, color: '#111018', outline: false });
    b({ u0: 0.5, v0: 0.5, u1: 1.5, v1: 1.5, z0: 1, z1: 1.5, color: '#ec4899', outline: false });
    b({ u0: 0.85, v0: 0.85, u1: 1.15, v1: 1.15, z0: 1.5, z1: 2, color: '#111018', outline: false });
    for (let i = 0; i < 6; i += 1) dot(ctx, ox, oy, 0.2 + i * 0.3, 0.12, 1, '#3b3561', 2, 1);
  },
  speaker(b, { ctx, ox, oy }) {
    b({ u0: 0.2, v0: 0.2, u1: 0.8, v1: 0.8, z0: 0, z1: 24, color: '#262233', left: '#1a1726', right: '#121019' });
    [[0.5, 0.8, 16], [0.5, 0.8, 7]].forEach(([u, v, z]) => {
      dot(ctx, ox, oy, u - 0.12, v, z, '#4b4570', 5, 5);
      dot(ctx, ox, oy, u - 0.06, v, z - 2, '#8b5cf6', 2, 2);
    });
  },
  jukebox(b, { ctx, ox, oy, now }) {
    b({ u0: 0.12, v0: 0.18, u1: 0.88, v1: 0.82, z0: 0, z1: 30, color: '#7c2d12', left: '#9a3412', right: '#431407' });
    b({ u0: 0.12, v0: 0.18, u1: 0.88, v1: 0.82, z0: 30, z1: 34, color: '#fbbf24' });
    const colors = ['#ec4899', '#22d3ee', '#ffd700', '#8b5cf6', '#22c55e'];
    for (let i = 0; i < 5; i += 1) {
      const c = colors[(i + Math.floor((now || 0) / 300)) % colors.length];
      dot(ctx, ox, oy, 0.2 + i * 0.14, 0.82, 26 - i, c, 2, 2);
    }
    dot(ctx, ox, oy, 0.4, 0.82, 16, '#111018', 6, 5);
  },
  dance_tile(b, { item, now }) {
    const colors = ['#ec4899', '#22d3ee', '#ffd700', '#8b5cf6', '#22c55e', '#3b82f6'];
    const playing = item?.playing;
    const step = playing ? Math.floor((now || 0) / 400) : 0;
    const color = playing ? colors[(item.x * 3 + item.y * 5 + step) % colors.length] : '#2d2a55';
    b({ u0: 0.04, v0: 0.04, u1: 0.96, v1: 0.96, z0: 0, z1: 1.5, color, outline: false });
  },
  trophy(b) {
    b({ u0: 0.25, v0: 0.25, u1: 0.75, v1: 0.75, z0: 0, z1: 8, color: '#1f1f2e' });
    b({ u0: 0.42, v0: 0.42, u1: 0.58, v1: 0.58, z0: 8, z1: 14, color: '#d4a017' });
    b({ u0: 0.3, v0: 0.3, u1: 0.7, v1: 0.7, z0: 14, z1: 26, color: '#ffd700', left: '#e6b800', right: '#b8860b' });
  },
  card_pedestal(b) {
    b({ u0: 0.2, v0: 0.2, u1: 0.8, v1: 0.8, z0: 0, z1: 16, color: '#f4f1ff', left: '#d9d2f5', right: '#b7aee0' });
    b({ u0: 0.16, v0: 0.16, u1: 0.84, v1: 0.84, z0: 16, z1: 18, color: '#8b5cf6' });
  },
  bar_counter(b, { ctx, ox, oy }) {
    b({ u0: 0.02, v0: 0.1, u1: 2.98, v1: 0.9, z0: 0, z1: 18, color: '#4a2511', left: '#5c2e15', right: '#2e170a' });
    b({ u0: 0, v0: 0.06, u1: 3, v1: 0.94, z0: 18, z1: 21, color: '#1f1f2e' });
    const bottles = ['#22c55e', '#ec4899', '#ffd700', '#22d3ee'];
    bottles.forEach((c, i) => b({ u0: 0.4 + i * 0.6, v0: 0.3, u1: 0.52 + i * 0.6, v1: 0.42, z0: 21, z1: 30, color: c }));
    for (let i = 0; i < 12; i += 1) dot(ctx, ox, oy, 0.1 + i * 0.24, 0.9, 6, '#ec4899', 2, 1);
  },
  dj_booth(b, { ctx, ox, oy, now }) {
    b({ u0: 0.05, v0: 0.1, u1: 1.95, v1: 0.9, z0: 0, z1: 16, color: '#1f1f2e', left: '#18182a', right: '#101019' });
    b({ u0: 0.05, v0: 0.1, u1: 1.95, v1: 0.9, z0: 16, z1: 18, color: '#8b5cf6' });
    [0.55, 1.45].forEach((u) => b({ u0: u - 0.3, v0: 0.25, u1: u + 0.3, v1: 0.75, z0: 18, z1: 19, color: '#111018' }));
    const pulse = Math.floor((now || 0) / 250) % 2 === 0;
    for (let i = 0; i < 8; i += 1) dot(ctx, ox, oy, 0.15 + i * 0.22, 0.9, 9, pulse === (i % 2 === 0) ? '#22d3ee' : '#ec4899', 2, 2);
  }
};

/** Mobili a parete: poster e quadro, disegnati sul piano della parete (inclinato del 50%). */
function drawWallItem(ctx, ox, oy, type, rot, cardImage, rarityColor) {
  // Parete sul lato -y (rot 0): va da sinistra-alto verso destra-basso; sul lato -x (rot 2) al contrario.
  const slope = rot === 2 ? -0.5 : 0.5;
  const baseX = rot === 2 ? ox - HALF_W + 3 : ox + 3;
  const baseY = rot === 2 ? oy + HALF_H - 1 : oy + 1;
  const w = 10;
  const h = type === 'card_frame' ? 16 : 18;
  const top = baseY - 30;

  ctx.save();
  ctx.setTransform(1, slope, 0, 1, 0, 0);
  const shiftY = -slope * baseX;
  if (type === 'poster_neon') {
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(baseX - 1, top + shiftY - 1, w + 2, h + 2);
    ctx.fillStyle = '#140a2e';
    ctx.fillRect(baseX, top + shiftY, w, h);
    ctx.fillStyle = '#ec4899';
    ctx.fillRect(baseX + 2, top + shiftY + 3, w - 4, 2);
    ctx.fillStyle = '#22d3ee';
    ctx.fillRect(baseX + 2, top + shiftY + 8, w - 4, 2);
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(baseX + 3, top + shiftY + 13, w - 6, 2);
  } else {
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(baseX - 2, top + shiftY - 2, w + 4, h + 4);
    ctx.fillStyle = rarityColor || '#8b5cf6';
    ctx.fillRect(baseX - 1, top + shiftY - 1, w + 2, h + 2);
    if (cardImage) ctx.drawImage(cardImage, baseX, top + shiftY, w, h);
    else {
      ctx.fillStyle = '#2a1f55';
      ctx.fillRect(baseX, top + shiftY, w, h);
    }
  }
  ctx.restore();
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
    img.src = /^https?:\/\//.test(src) ? `${BASE_URL}/cards/${encodeURIComponent(card.id)}/image` : src;
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
  const fx = def.wall ? 1 : (item.rot === 2 ? def.length : def.width);
  const fy = def.wall ? 1 : (item.rot === 2 ? def.width : def.length);
  const width = (fx + fy) * HALF_W + PAD;
  const height = (fx + fy) * HALF_H + PAD + 24;
  const { canvas, ctx } = createCanvas(width, height);
  const ox = fy * HALF_W + PAD / 2;
  const oy = PAD + 16;

  if (def.wall) {
    const img = def.cardDisplay ? cardImage(item.card, onImageLoad) : null;
    drawWallItem(ctx, ox, oy, item.type, item.rot, img, item.card ? getRarityColor(item.card.rarity) : null);
    return { canvas, anchorX: ox, anchorY: oy };
  }

  // Con rot 2 si scambiano u e v: il mobile appare girato di 90 gradi.
  const rotated = (b) => (item.rot === 2
    ? { ...b, u0: b.v0, v0: b.u0, u1: b.v1, v1: b.u1 }
    : b);
  const b = (opts) => box(ctx, ox, oy, rotated(opts));
  const draw = DRAW[item.type];
  if (draw) draw(b, { ctx, ox, oy, now, item });
  else b({ u0: 0.2, v0: 0.2, u1: 0.8, v1: 0.8, z0: 0, z1: 14, color: '#6b7280' });

  // Vetrina: la carta sta in piedi sul piedistallo, rivolta verso chi guarda.
  if (item.type === 'card_pedestal' && item.card) {
    const img = cardImage(item.card, onImageLoad);
    const color = getRarityColor(item.card.rarity);
    const cx = Math.round(ox + (0.5 - 0.5) * HALF_W) - 5;
    const cy = Math.round(oy + HALF_H - 18 - 16);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(cx - 2, cy - 2, 14, 18);
    ctx.fillStyle = color;
    ctx.fillRect(cx - 1, cy - 1, 12, 16);
    if (img) ctx.drawImage(img, cx, cy, 10, 14);
  }

  return { canvas, anchorX: ox, anchorY: oy };
}

/** Il mobile va ridisegnato a ogni fotogramma (luci, pista) o basta una volta? */
export function isAnimated(type) {
  return type === 'jukebox' || type === 'dance_tile' || type === 'dj_booth';
}
