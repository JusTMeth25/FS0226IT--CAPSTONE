import { createCanvas, mirror, px, shade } from './pixel.js';

/**
 * Avatar in pixel art, disegnati da codice a partire dal codice aspetto "s1.h1.hc0.sh0.p0".
 *
 * Gli indici devono restare allineati con HotelLook.java: il server accetta s0-3, h0-5, hc0-7,
 * sh0-9, p0-7. Aggiungere una variante qui senza allargare quel controllo la renderebbe
 * impossibile da salvare.
 *
 * Lo sprite e' 22x46 pixel base, con i piedi sulla riga 44 al centro (x 11): e' il punto che il
 * renderer appoggia sul centro della casella. Si disegna girato a destra, di fronte o di spalle;
 * le viste a sinistra sono la stessa immagine specchiata.
 */
export const AVATAR_W = 22;
export const AVATAR_H = 46;
export const AVATAR_FOOT_X = 11;
export const AVATAR_FOOT_Y = 44;

const OUTLINE = '#140d24';

export const SKINS = ['#f6d3b3', '#e8b48c', '#b97a56', '#6e4129'];
export const HAIR_STYLES = ['Corto', 'A punta', 'Lunghi', 'Chignon', 'Cresta', 'Cappellino'];
export const HAIR_COLORS = ['#2b1b12', '#6b3e1f', '#d9aa55', '#ece4d4', '#ec4899', '#22d3ee', '#8b5cf6', '#101010'];
export const SHIRTS = ['#8b5cf6', '#ec4899', '#22d3ee', '#3b82f6', '#ffd700', '#22c55e', '#ef4444', '#f5f5f5', '#1f1f2e', '#141414'];
export const SHIRT_NAMES = ['Viola', 'Magenta', 'Ciano', 'Blu', 'Oro', 'Verde', 'Rosso', 'Bianca', 'Notte', 'Vinile'];
export const PANTS = ['#2d3a66', '#1a1a24', '#6b7280', '#e5e7eb', '#5b21b6', '#991b1b', '#166534', '#a8865a'];

export const LOOK_PARTS = [
  { key: 's', label: 'Carnagione', count: SKINS.length },
  { key: 'h', label: 'Capelli', count: HAIR_STYLES.length },
  { key: 'hc', label: 'Colore capelli', count: HAIR_COLORS.length },
  { key: 'sh', label: 'Maglia', count: SHIRTS.length },
  { key: 'p', label: 'Pantaloni', count: PANTS.length }
];

export const DEFAULT_LOOK = 's1.h1.hc0.sh0.p0';

export function parseLook(look) {
  const parts = { s: 1, h: 1, hc: 0, sh: 0, p: 0 };
  (look || DEFAULT_LOOK).split('.').forEach((part) => {
    const match = /^([a-z]+)(\d+)$/.exec(part);
    if (match && match[1] in parts) parts[match[1]] = Number(match[2]);
  });
  LOOK_PARTS.forEach(({ key, count }) => {
    if (!(parts[key] >= 0 && parts[key] < count)) parts[key] = 0;
  });
  return parts;
}

export function formatLook(parts) {
  return LOOK_PARTS.map(({ key }) => `${key}${parts[key]}`).join('.');
}

/**
 * Parti del corpo: prima tutti i contorni, poi tutti i riempimenti. Cosi' le parti vicine si
 * fondono in una sagoma unica con un solo bordo scuro esterno, come negli sprite di Habbo.
 */
function drawParts(ctx, parts) {
  parts.forEach(({ x, y, w, h }) => px(ctx, x - 1, y - 1, w + 2, h + 2, OUTLINE));
  parts.forEach(({ x, y, w, h, color, shadeRight }) => {
    px(ctx, x, y, w, h, color);
    if (shadeRight && w > 3) px(ctx, x + w - 2, y, 2, h, shade(color, -0.22));
  });
}

/**
 * Pose disponibili: stand, walk (4 fotogrammi), sit, dance (4), wave (2).
 * Restituisce le posizioni di braccia e gambe per il fotogramma richiesto.
 */
function poseOffsets(pose, frame) {
  const pose0 = { bodyY: 0, leftLeg: 0, rightLeg: 0, leftArm: 0, rightArm: 0, leftUp: false, rightUp: false, sit: false };
  if (pose === 'walk') {
    const swing = [0, 1, 0, -1][frame % 4];
    return { ...pose0, leftLeg: swing, rightLeg: -swing, leftArm: -swing, rightArm: swing };
  }
  if (pose === 'dance') {
    const bob = [0, 1, 0, 1][frame % 4];
    return { ...pose0, bodyY: bob, leftUp: frame % 4 < 2, rightUp: frame % 4 >= 2, leftLeg: bob, rightLeg: -bob };
  }
  if (pose === 'wave') return { ...pose0, rightUp: true, rightArm: frame % 2 };
  if (pose === 'sit') return { ...pose0, sit: true };
  return pose0;
}

function drawHair(ctx, style, color, back) {
  const dark = shade(color, -0.25);
  const hair = (x, y, w, h) => px(ctx, x, y, w, h, color);

  if (style === 4) {
    // Cresta: solo una striscia centrale, piu' alta.
    hair(9, 1, 4, 9);
    px(ctx, 12, 1, 1, 9, dark);
    return;
  }
  if (style === 5) {
    // Cappellino: calotta e visiera verso destra (sparisce di spalle).
    hair(4, 4, 14, 5);
    px(ctx, 4, 8, 14, 1, dark);
    if (!back) hair(15, 8, 6, 2);
    return;
  }

  hair(4, 4, 14, 5);
  if (back) {
    hair(4, 8, 14, 8);
    px(ctx, 16, 8, 2, 8, dark);
  } else {
    hair(4, 8, 2, 5);
    hair(16, 8, 2, 3);
  }
  if (style === 1) {
    [5, 8, 11, 14].forEach((x) => hair(x, 2, 2, 2));
  }
  if (style === 2) {
    hair(3, 8, 3, 15);
    if (back) hair(4, 16, 14, 6);
    else hair(16, 8, 3, 13);
  }
  if (style === 3) {
    hair(12, 0, 6, 5);
    px(ctx, 16, 0, 2, 5, dark);
  }
  px(ctx, 4, 4, 14, 1, shade(color, 0.25));
}

function drawAvatar(look, { back, pose, frame }) {
  const { canvas, ctx } = createCanvas(AVATAR_W, AVATAR_H);
  const parts = parseLook(look);
  const skin = SKINS[parts.s];
  const shirt = SHIRTS[parts.sh];
  const pants = PANTS[parts.p];
  const o = poseOffsets(pose, frame);
  const y0 = o.bodyY + (o.sit ? 6 : 0);

  const body = [];
  if (o.sit) {
    // Seduti: cosce in avanti, piedi appena sotto.
    body.push({ x: 6, y: 33 + y0, w: 11, h: 4, color: pants, shadeRight: true });
    body.push({ x: 13, y: 36 + y0, w: 5, h: 3, color: '#1d1d27' });
  } else {
    body.push({ x: 6, y: 33 + y0 + o.leftLeg, w: 4, h: 9, color: pants });
    body.push({ x: 12, y: 33 + y0 + o.rightLeg, w: 4, h: 9, color: shade(pants, -0.15) });
    body.push({ x: 6, y: 33 + y0, w: 10, h: 3, color: pants, shadeRight: true });
    body.push({ x: 6, y: 42 + y0 + o.leftLeg, w: 4, h: 2, color: '#1d1d27' });
    body.push({ x: 12, y: 42 + y0 + o.rightLeg, w: 4, h: 2, color: '#1d1d27' });
  }

  // Braccia: abbassate oscillano con il passo, alzate per salutare o ballare.
  const arm = (x, up, swing) => (up
    ? [{ x, y: 12 + y0, w: 2, h: 10, color: shirt }, { x, y: 10 + y0, w: 2, h: 3, color: skin }]
    : [{ x, y: 22 + y0 + swing, w: 2, h: 5, color: shirt }, { x, y: 27 + y0 + swing, w: 2, h: 5, color: skin }]);
  body.push(...arm(3, o.leftUp, o.leftArm));
  body.push({ x: 5, y: 21 + y0, w: 12, h: 13, color: shirt, shadeRight: true });
  body.push(...arm(17, o.rightUp, o.rightArm));
  body.push({ x: 9, y: 19 + y0, w: 4, h: 3, color: skin });
  body.push({ x: 4, y: 6 + y0, w: 14, h: 14, color: skin, shadeRight: !back });

  drawParts(ctx, body);

  // Testa arrotondata: via i pixel d'angolo.
  ctx.clearRect(3, 5 + y0, 2, 1);
  ctx.clearRect(3, 5 + y0, 1, 2);
  ctx.clearRect(17, 5 + y0, 2, 1);
  ctx.clearRect(18, 5 + y0, 1, 2);

  // Dettagli della maglia: colletto e, sulla maglia "Vinile", un disco sul petto.
  px(ctx, 9, 21 + y0, 4, 1, shade(shirt, 0.3));
  if (parts.sh === 9 && !back) {
    px(ctx, 9, 25 + y0, 4, 4, '#2a2a2a');
    px(ctx, 10, 26 + y0, 2, 2, '#ec4899');
  }

  if (!back) {
    px(ctx, 11, 12 + y0, 1, 2, OUTLINE);
    px(ctx, 14, 12 + y0, 1, 2, OUTLINE);
    px(ctx, 12, 16 + y0, 2, 1, shade(skin, -0.35));
  }

  ctx.save();
  ctx.translate(0, y0);
  drawHair(ctx, parts.h, HAIR_COLORS[parts.hc], back);
  ctx.restore();

  return canvas;
}

const cache = new Map();

/**
 * Sprite pronto da disegnare, in cache: lo stesso avatar nella stessa posa viene generato
 * una volta sola, non a ogni fotogramma.
 */
export function avatarSprite(look, { back = false, flip = false, pose = 'stand', frame = 0 } = {}) {
  const key = `${look}|${back}|${flip}|${pose}|${frame}`;
  let sprite = cache.get(key);
  if (!sprite) {
    const base = drawAvatar(look, { back, pose, frame });
    sprite = flip ? mirror(base) : base;
    if (cache.size > 2000) cache.clear();
    cache.set(key, sprite);
  }
  return sprite;
}
