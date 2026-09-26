import { bake, createCanvas, mirror, px, shade } from './pixel.js';

/**
 * Avatar in pixel art stile Habbo, disegnati da codice a partire dal codice aspetto
 * "s1.h1.hc0.sh0.p0.t0.f0.a0".
 *
 * Gli indici devono restare allineati con HotelLook.java, che controlla quanti ce ne sono per
 * ogni parte. Le parti dopo i pantaloni (tipo di maglia, scarpe, accessorio, corporatura) sono
 * arrivate dopo: un codice vecchio senza di loro vale come se fossero a zero.
 *
 * Lo sprite e' 48x96 pixel, con i piedi sulla riga 92 al centro (x 24): e' il punto che il
 * renderer appoggia sul centro della casella. Si disegna girato verso destra, di tre quarti,
 * di fronte o di spalle; le viste a sinistra sono la stessa immagine specchiata. Le parti si
 * disegnano senza bordo e alla fine un solo contorno scuro gira attorno a tutta la sagoma,
 * come negli sprite di Habbo.
 */

/** Ingrandimento con cui il motore disegna lo sprite dell'avatar, rispetto alle caselle. */
export const AVATAR_SCALE = 1;
export const AVATAR_W = 48;
export const AVATAR_H = 96;
export const AVATAR_FOOT_X = 24;
export const AVATAR_FOOT_Y = 92;

const OUTLINE = '#1a1030';
const EYE = '#1a1030';

export const SKINS = ['#ffe0c4', '#f6d3b3', '#e8b48c', '#c98e66', '#9a6440', '#6e4129'];
export const HAIR_STYLES = ['Corto', 'A punta', 'Lunghi', 'Chignon', 'Cresta', 'Cappellino',
  'Ricci', 'Coda', 'Caschetto', 'Rasato'];
export const HAIR_COLORS = ['#2b1b12', '#6b3e1f', '#d9aa55', '#ece4d4', '#ec4899', '#22d3ee',
  '#8b5cf6', '#101010', '#b4471f', '#9ca3af'];
export const HAIR_COLOR_NAMES = ['Castano scuro', 'Castano', 'Biondo', 'Platino', 'Magenta', 'Ciano',
  'Viola', 'Nero', 'Rosso', 'Grigio'];
export const SHIRTS = ['#8b5cf6', '#ec4899', '#22d3ee', '#3b82f6', '#ffd700', '#22c55e', '#ef4444',
  '#f5f5f5', '#1f1f2e', '#141414', '#f97316', '#14b8a6'];
export const SHIRT_NAMES = ['Viola', 'Magenta', 'Ciano', 'Blu', 'Oro', 'Verde', 'Rosso', 'Bianco',
  'Notte', 'Vinile', 'Arancio', 'Petrolio'];
export const SHIRT_TYPES = ['T-shirt', 'Felpa', 'Camicia', 'Giacca', 'Canotta', 'Petto nudo'];
/** Tipo di maglia "petto nudo": solo con la corporatura da uomo (come controlla HotelLook.java). */
export const BARE_CHEST = 5;
export const BODIES = ['Uomo', 'Donna'];
export const PANTS = ['#2d3a66', '#1a1a24', '#6b7280', '#e5e7eb', '#5b21b6', '#991b1b', '#166534', '#a8865a'];
export const PANTS_NAMES = ['Jeans', 'Neri', 'Grigi', 'Bianchi', 'Viola', 'Bordeaux', 'Verdi', 'Kaki'];
export const SHOES = ['#1d1d27', '#f4f4f5', '#dc2626', '#7c3aed', '#6b3e1f', '#06b6d4'];
export const SHOE_NAMES = ['Nere', 'Sneakers bianche', 'Rosse', 'Viola', 'Stivaletti', 'Ciano'];
export const ACCESSORIES = ['Nessuno', 'Occhiali', 'Occhiali da sole', 'Cuffie', 'Collana vinile', 'Orecchino', 'Bandana'];

export const LOOK_PARTS = [
  { key: 'b', label: 'Corporatura', count: BODIES.length },
  { key: 's', label: 'Carnagione', count: SKINS.length },
  { key: 'h', label: 'Capelli', count: HAIR_STYLES.length },
  { key: 'hc', label: 'Colore capelli', count: HAIR_COLORS.length },
  { key: 't', label: 'Tipo di maglia', count: SHIRT_TYPES.length },
  { key: 'sh', label: 'Colore maglia', count: SHIRTS.length },
  { key: 'p', label: 'Pantaloni', count: PANTS.length },
  { key: 'f', label: 'Scarpe', count: SHOES.length },
  { key: 'a', label: 'Accessorio', count: ACCESSORIES.length }
];

/** Ordine delle parti nel codice salvato: le prime cinque sono quelle della prima versione. */
const CODE_ORDER = ['s', 'h', 'hc', 'sh', 'p', 't', 'f', 'a', 'b'];

export const DEFAULT_LOOK = 's1.h1.hc0.sh0.p0.t0.f0.a0.b0';

/** Il petto nudo e' solo da uomo: con la corporatura da donna diventa una canotta. */
export function fixLook(parts) {
  return parts.b === 1 && parts.t === BARE_CHEST ? { ...parts, t: 4 } : parts;
}

export function parseLook(look) {
  const parts = { s: 1, h: 1, hc: 0, sh: 0, p: 0, t: 0, f: 0, a: 0, b: 0 };
  (look || DEFAULT_LOOK).split('.').forEach((part) => {
    const match = /^([a-z]+)(\d+)$/.exec(part);
    if (match && match[1] in parts) parts[match[1]] = Number(match[2]);
  });
  LOOK_PARTS.forEach(({ key, count }) => {
    if (!(parts[key] >= 0 && parts[key] < count)) parts[key] = 0;
  });
  return fixLook(parts);
}

export function formatLook(parts) {
  return CODE_ORDER.map((key) => `${key}${parts[key] || 0}`).join('.');
}

// ------------------------------------------------------------------ strumenti di disegno

/** Rettangolo con luce da sinistra: bordo sinistro chiaro, fascia destra in ombra. */
function block(ctx, x, y, w, h, color, { light = 1, dark = 3 } = {}) {
  px(ctx, x, y, w, h, color);
  if (w > 4 && light) px(ctx, x, y, light, h, shade(color, 0.18));
  if (w > 4 && dark) px(ctx, x + w - dark, y, dark, h, shade(color, -0.2));
}

/** Forma tondeggiante (super-ellisse): teste, capelli, bottoni grandi. */
function blob(ctx, cx, cy, rx, ry, color, power = 2.6) {
  ctx.fillStyle = color;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
      const dx = Math.abs((x + 0.5 - cx) / rx);
      const dy = Math.abs((y + 0.5 - cy) / ry);
      if (dx ** power + dy ** power <= 1) ctx.fillRect(x, y, 1, 1);
    }
  }
}

/** Contorno unico: ogni pixel vuoto che tocca la sagoma diventa scuro. */
function outline(ctx, w, h) {
  const image = ctx.getImageData(0, 0, w, h);
  const d = image.data;
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0;
  const edge = [];
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) edge.push([x, y]);
    }
  }
  ctx.fillStyle = OUTLINE;
  edge.forEach(([x, y]) => ctx.fillRect(x, y, 1, 1));
}

// ------------------------------------------------------------------ pose

/**
 * Pose disponibili: stand, walk (4 fotogrammi), sit, dance (4), wave (2), e quelle degli sport e
 * dei giochi: run, punch, lift, kick, dribble (4), shoot (2), bowl (3), putt (2), play (2), cue (2).
 * Restituisce di quanto spostare gambe e braccia per il fotogramma richiesto.
 */
function poseOffsets(pose, frame) {
  const pose0 = { bodyY: 0, backLeg: 0, frontLeg: 0, backArm: 0, frontArm: 0, backUp: false, frontUp: false, sit: false };
  if (pose === 'walk') {
    const swing = [0, 3, 0, -3][frame % 4];
    return { ...pose0, backLeg: -swing, frontLeg: swing, backArm: swing, frontArm: -swing, bodyY: frame % 2 ? -1 : 0 };
  }
  if (pose === 'dance') {
    const bob = [0, 2, 0, 2][frame % 4];
    return { ...pose0, bodyY: bob, backUp: frame % 4 < 2, frontUp: frame % 4 >= 2, backLeg: bob ? 2 : -2, frontLeg: bob ? -2 : 2 };
  }
  if (pose === 'wave') return { ...pose0, frontUp: true, frontArm: frame % 2 ? 2 : 0 };
  // Esercizi e giochi: corsa (passo lungo), pugni alternati, bilanciere su e giu' da seduti.
  if (pose === 'run') {
    // Corsa: passo lungo, braccia che vanno avanti e indietro, il corpo che rimbalza.
    const swing = [0, 7, 0, -7][frame % 4];
    return { ...pose0, backLeg: -swing, frontLeg: swing, backArm: swing * 0.8, frontArm: -swing * 0.8, bodyY: frame % 2 ? -3 : 0, sweat: frame };
  }
  // Pugni: jab dritto in avanti, alternando braccio davanti e braccio dietro, in guardia.
  if (pose === 'punch') return { ...pose0, frontJab: frame === 1, backJab: frame === 2, bodyY: 1, frontLeg: 3, backLeg: -3, sweat: frame };
  // Panca: il bilanciere sale in tre tempi (frame 0 giu', 2 braccia tese).
  if (pose === 'lift') return { ...pose0, sit: true, frontUp: true, backUp: true, liftReach: [4, 9, 15, 9][frame % 4], sweat: frame };
  // Curl: manubri in mano, un braccio alla volta sale fino alla spalla (frame 1 davanti, 2 dietro).
  if (pose === 'curl') return { ...pose0, frontUp: frame === 1, backUp: frame === 2, curl: true, sweat: frame };
  // Sport: calcio al pallone, palleggio e tiro a canestro, lancio della boccia, colpo di golf.
  if (pose === 'kick') return { ...pose0, frontLeg: 10, backLeg: -3, frontArm: -4, backArm: 4, bodyY: -1 };
  if (pose === 'dribble') return { ...pose0, frontArm: 3, backArm: -1, bodyY: frame % 2, backLeg: 1, frontLeg: -1 };
  if (pose === 'shoot') return frame === 0
    ? { ...pose0, frontUp: true, backUp: true, bodyY: 3, backLeg: -1, frontLeg: 1 }
    : { ...pose0, frontUp: true, backUp: true, bodyY: -3, shootReach: 8 };
  if (pose === 'bowl') {
    if (frame === 1) return { ...pose0, frontArm: -9, backArm: 5, bodyY: 2, frontLeg: 5, backLeg: -4 };
    if (frame === 2) return { ...pose0, frontArm: 9, backArm: -6, bodyY: 5, frontLeg: 7, backLeg: -7 };
    return { ...pose0, frontArm: 2 };
  }
  if (pose === 'putt') return { ...pose0, bodyY: 2, frontArm: frame === 1 ? 7 : 3, backArm: frame === 1 ? 7 : 3 };
  if (pose === 'play') return { ...pose0, frontArm: frame % 2 ? 6 : 4, backArm: frame % 2 ? 4 : 6 };
  if (pose === 'cue') return { ...pose0, bodyY: 4, frontArm: frame % 2 ? 8 : 5, backArm: 3, frontLeg: 3, backLeg: -3 };
  if (pose === 'sit') return { ...pose0, sit: true };
  return pose0;
}

// ------------------------------------------------------------------ parti del corpo

/**
 * Gamba dritta dal fianco alla caviglia, inclinata di `swing` pixel alla caviglia, con la
 * scarpa che punta verso destra (la direzione in cui si cammina).
 */
function leg(ctx, x, top, swing, pants, shoe, back) {
  const length = 16;
  for (let row = 0; row < length; row += 1) {
    const dx = Math.round((swing * row) / length);
    px(ctx, x + dx, top + row, 8, 1, pants);
    px(ctx, x + dx + 6, top + row, 2, 1, shade(pants, -0.2));
  }
  const fx = x + swing;
  const width = back ? 9 : 11;
  px(ctx, fx - 1, top + length, width, 6, shoe);
  px(ctx, fx - 1, top + length, width, 1, shade(shoe, 0.25));
  px(ctx, fx - 1, top + length + 5, width, 1, shade(shoe, -0.35));
}

/** Braccio: manica (corta, lunga o assente) e mano. Alzato per salutare o ballare. */
function arm(ctx, x, y0, { up, swing, sleeve, skin, sleeveLength, reach = 0, jab = false }) {
  if (jab) {
    // Braccio teso in avanti all'altezza della spalla, con il guantone.
    const top = y0 + 44;
    px(ctx, x, top, 14, 6, sleeveLength > 0 ? sleeve : skin);
    px(ctx, x, top + 4, 14, 2, shade(sleeveLength > 0 ? sleeve : skin, -0.2));
    blob(ctx, x + 16, top + 3, 4.5, 4.5, '#dc2626');
    px(ctx, x + 14, top + 1, 3, 2, '#fca5a5');
    return;
  }
  if (up) {
    // Braccio alzato: sale sopra la spalla, la mano aperta in alto (piu' in alto se spinge un peso).
    const top = y0 + 22 - reach;
    px(ctx, x, top, 6, 20, skin);
    if (sleeveLength > 0) px(ctx, x, top + 20 - Math.min(20, sleeveLength), 6, Math.min(20, sleeveLength), sleeve);
    px(ctx, x - 1, top - 6, 8, 7, skin);
    px(ctx, x + 4, top - 6, 2, 7, shade(skin, -0.15));
    return;
  }
  const top = y0 + 42;
  const len = 18;
  for (let row = 0; row < len; row += 1) {
    const dx = Math.round((swing * row) / len);
    const onSleeve = row < sleeveLength;
    const color = onSleeve ? sleeve : skin;
    px(ctx, x + dx, top + row, 6, 1, color);
    px(ctx, x + dx + 4, top + row, 2, 1, shade(color, -0.2));
    px(ctx, x + dx, top + row, 1, 1, shade(color, 0.15));
  }
  const hx = x + swing;
  blob(ctx, hx + 3, top + len + 2, 3.4, 3.4, skin);
  px(ctx, hx + 4, top + len + 1, 2, 3, shade(skin, -0.15));
}

/**
 * Petto nudo: pettorali e addominali accennati con l'ombra, capezzoli solo di fronte. Serve sia
 * come "maglia" sia per gli uomini in acqua.
 */
function drawBareChest(ctx, y0, { skin, back }) {
  const top = y0 + 40;
  block(ctx, 13, top, 23, 25, skin);
  ctx.clearRect(13, top, 2, 1);
  ctx.clearRect(34, top, 2, 1);
  const dark = shade(skin, -0.16);
  if (back) {
    // Spalle e colonna vertebrale.
    px(ctx, 24, top + 4, 1, 18, dark);
    px(ctx, 17, top + 6, 4, 1, dark);
    px(ctx, 28, top + 6, 4, 1, dark);
    return;
  }
  px(ctx, 17, top + 9, 7, 1, dark);
  px(ctx, 26, top + 9, 7, 1, dark);
  px(ctx, 24, top + 3, 1, 19, shade(skin, -0.1));
  px(ctx, 19, top + 6, 2, 2, shade(skin, -0.3));
  px(ctx, 29, top + 6, 2, 2, shade(skin, -0.3));
  for (let y = top + 13; y < top + 23; y += 4) {
    px(ctx, 21, y, 3, 1, dark);
    px(ctx, 26, y, 3, 1, dark);
  }
  px(ctx, 24, top + 20, 1, 1, shade(skin, -0.35));
}

function drawTorso(ctx, y0, parts, { shirt, skin, back }) {
  const type = parts.t;
  const top = y0 + 40;
  if (type === BARE_CHEST) {
    drawBareChest(ctx, y0, { skin, back });
    return;
  }
  // Canotta: spalle scoperte, maglia piu' stretta in alto.
  if (type === 4) {
    block(ctx, 14, top + 3, 21, 22, shirt);
    px(ctx, 16, top, 4, 4, shirt);
    px(ctx, 29, top, 4, 4, shirt);
    px(ctx, 14, top, 2, 3, skin);
    px(ctx, 33, top, 2, 3, skin);
    if (!back) px(ctx, 20, top, 9, 3, skin);
  } else {
    block(ctx, 13, top, 23, 25, shirt);
    // Spalle arrotondate.
    ctx.clearRect(13, top, 2, 1);
    ctx.clearRect(34, top, 2, 1);
  }
  const dark = shade(shirt, -0.3);
  const light = shade(shirt, 0.35);

  if (type === 1) {
    // Felpa: cappuccio sulle spalle, tasca a marsupio e laccetti.
    if (back) {
      blob(ctx, 24, top + 3, 9, 5, shade(shirt, -0.12));
      px(ctx, 18, top + 5, 12, 1, dark);
    } else {
      px(ctx, 14, top - 1, 6, 5, shade(shirt, -0.12));
      px(ctx, 18, top + 14, 13, 7, shade(shirt, -0.1));
      px(ctx, 18, top + 14, 13, 1, dark);
      px(ctx, 22, top + 1, 1, 7, light);
      px(ctx, 27, top + 1, 1, 6, light);
    }
  } else if (type === 2) {
    // Camicia: colletto chiaro e bottoni.
    if (!back) {
      px(ctx, 20, top, 4, 3, light);
      px(ctx, 25, top, 4, 3, light);
      for (let y = top + 5; y < top + 24; y += 4) px(ctx, 24, y, 1, 1, light);
      px(ctx, 24, top + 3, 1, 21, shade(shirt, -0.12));
    } else {
      px(ctx, 19, top, 11, 2, light);
    }
  } else if (type === 3) {
    // Giacca aperta sopra una maglietta bianca, con i risvolti.
    if (!back) {
      px(ctx, 21, top, 7, 25, '#f1eff7');
      px(ctx, 26, top, 2, 25, '#d6d2e3');
      for (let i = 0; i < 7; i += 1) {
        px(ctx, 20 - Math.floor(i / 2), top + i, 2, 1, dark);
        px(ctx, 28 + Math.floor(i / 2), top + i, 2, 1, dark);
      }
      px(ctx, 16, top + 17, 4, 1, dark);
    } else {
      px(ctx, 24, top + 14, 1, 11, dark);
    }
  } else if (type === 0) {
    // T-shirt: girocollo.
    if (!back) px(ctx, 20, top, 9, 2, dark);
  }
  // Maglia "Vinile": un disco stampato sul petto.
  if (parts.sh === 9 && !back && type !== 3) {
    blob(ctx, 25, top + 11, 4.5, 4.5, '#2a2a2a');
    blob(ctx, 25, top + 11, 1.6, 1.6, '#ec4899');
  }
  // Orlo della maglia.
  px(ctx, 14, top + 24, 21, 1, dark);
}

const HEAD = { cx: 24, rx: 13, ry: 13.5, power: 2.8 };

/** Colori delle cuffie da piscina: si sceglie in base al look, cosi' ognuno ha sempre la sua. */
const CAP_COLORS = ['#ef4444', '#3b82f6', '#fbbf24', '#ec4899', '#22c55e', '#f5f5f5', '#8b5cf6', '#f97316'];

/**
 * Costume intero da bagno al posto della maglia: spalle e braccia scoperte, le spalline, una
 * riga bianca sul fianco. Il colore e' quello della maglia, cosi' si riconosce chi e'.
 */
function drawSwimsuit(ctx, y0, { color, skin, back }) {
  const top = y0 + 40;
  block(ctx, 13, top, 23, 25, skin);
  ctx.clearRect(13, top, 2, 1);
  ctx.clearRect(34, top, 2, 1);
  // Clavicole e petto appena in ombra.
  px(ctx, 17, top + 3, 15, 1, shade(skin, -0.1));
  block(ctx, 15, top + 8, 19, 17, color);
  px(ctx, 17, top, 3, 9, color);
  px(ctx, 29, top, 3, 9, color);
  if (!back) {
    // Scollatura arrotondata davanti.
    px(ctx, 20, top + 8, 9, 2, skin);
    px(ctx, 21, top + 10, 7, 1, skin);
  }
  px(ctx, 15, top + 8, 2, 17, '#ffffff');
  px(ctx, 32, top + 8, 1, 17, shade(color, -0.3));
  px(ctx, 15, top + 24, 19, 1, shade(color, -0.3));
}

/** Cuffia da piscina: una calotta liscia e lucida al posto dei capelli, con gli occhialini. */
function drawSwimCap(ctx, y0, color, back) {
  const cy = y0 + 24;
  blob(ctx, 24, cy - 6, 14.5, 9.5, color, 2.2);
  if (back) {
    blob(ctx, 24, cy - 2, 14, 9, color, 2.4);
    px(ctx, 12, cy - 3, 25, 1, shade(color, -0.25));
  } else {
    px(ctx, 10, cy - 7, 9, 9, color);
  }
  px(ctx, 16, cy - 13, 8, 2, shade(color, 0.45));
  px(ctx, 14, cy - 11, 3, 1, shade(color, 0.3));
}

function drawGoggles(ctx, y0) {
  const cy = y0 + 24;
  px(ctx, 20, cy - 9, 18, 1, '#1f2937');
  px(ctx, 23, cy - 11, 5, 3, '#22d3ee');
  px(ctx, 30, cy - 11, 4, 3, '#22d3ee');
  px(ctx, 23, cy - 11, 1, 1, '#e0f2fe');
}

function drawHead(ctx, y0, { skin, back }) {
  const cy = y0 + 24;
  blob(ctx, HEAD.cx, cy, HEAD.rx, HEAD.ry, skin, HEAD.power);
  if (!back) {
    shadeFace(ctx, cy, skin, cy - 13);
    px(ctx, 37, cy + 1, 1, 3, skin); // naso di profilo, sporge appena
  }
}

/** Guancia e mento in ombra a destra, riflesso sulla fronte a sinistra. */
function shadeFace(ctx, cy, skin, fromY) {
  for (let y = Math.max(fromY, cy - 4); y < cy + 12; y += 1) px(ctx, 34, y, 2, 1, shade(skin, -0.12));
  if (fromY <= cy - 9) px(ctx, 17, cy - 9, 5, 2, shade(skin, 0.15));
}

/**
 * Di fronte il viso resta sempre scoperto: dopo i capelli si ridipinge la pelle dalla fronte
 * in giu' sul lato destro della testa (quello girato verso chi guarda). Solo dentro la sagoma
 * della testa: le ciocche che escono dal contorno restano.
 */
function faceWindow(ctx, y0, skin) {
  const cy = y0 + 24;
  const top = cy - 7;
  ctx.fillStyle = skin;
  for (let y = top; y <= cy + 14; y += 1) {
    for (let x = 20; x <= 37; x += 1) {
      const dx = Math.abs((x + 0.5 - HEAD.cx) / HEAD.rx);
      const dy = Math.abs((y + 0.5 - cy) / HEAD.ry);
      if (dx ** HEAD.power + dy ** HEAD.power <= 1) ctx.fillRect(x, y, 1, 1);
    }
  }
  shadeFace(ctx, cy, skin, top);
}

/** Orecchie: una a sinistra di fronte (il viso e' girato a destra), due di spalle. */
function drawEars(ctx, y0, skin, back) {
  const cy = y0 + 24;
  const ear = (x) => {
    blob(ctx, x, cy + 2, 2.6, 3.6, skin);
    px(ctx, x - 1, cy + 1, 2, 3, shade(skin, -0.22));
  };
  ear(12);
  if (back) ear(36);
}

function drawFace(ctx, y0, skin) {
  const cy = y0 + 24;
  // Occhi: ovali scuri con il riflesso, il destro un po' piu' stretto per il tre quarti.
  const eye = (x, w) => {
    px(ctx, x, cy - 2, w, 5, EYE);
    px(ctx, x, cy - 2, 1, 1, '#ffffff');
  };
  eye(24, 3);
  eye(31, 2);
  px(ctx, 28, cy + 2, 2, 2, shade(skin, -0.18));
  // Bocca sorridente.
  px(ctx, 26, cy + 6, 1, 1, shade(skin, -0.45));
  px(ctx, 27, cy + 7, 4, 1, shade(skin, -0.45));
  px(ctx, 31, cy + 6, 1, 1, shade(skin, -0.45));
  // Guance rosate.
  ctx.fillStyle = 'rgba(236, 72, 153, 0.22)';
  ctx.fillRect(22, cy + 4, 3, 2);
  ctx.fillRect(32, cy + 4, 2, 2);
}

function drawBrows(ctx, y0, color) {
  const cy = y0 + 24;
  px(ctx, 23, cy - 5, 4, 1, shade(color, -0.1));
  px(ctx, 31, cy - 5, 3, 1, shade(color, -0.1));
}

/**
 * Capelli: forme piene con una fascia di luce in alto a sinistra e qualche ciocca piu' scura.
 * Di fronte coprono la parte alta e il lato sinistro della testa (la nuca), di spalle tutto.
 */
function drawHair(ctx, y0, style, color, back) {
  const dark = shade(color, -0.3);
  const light = shade(color, 0.3);
  const cy = y0 + 24;
  const H = (x, y, w, h, c = color) => px(ctx, x, y, w, h, c);
  const cap = () => {
    blob(ctx, 24, cy - 8, 14.5, 7.5, color, 2.4);
    if (back) {
      H(10, cy - 8, 28, 16);
      blob(ctx, 24, cy + 9, 14, 5, color);
    } else {
      // Nuca: di fronte i capelli scendono sul lato sinistro, dietro l'orecchio.
      H(10, cy - 8, 9, 12);
      H(33, cy - 8, 4, 6);
    }
  };
  const shine = () => {
    H(16, cy - 12, 9, 1, light);
    H(14, cy - 11, 4, 1, light);
  };
  const strands = () => {
    for (let x = 15; x < 34; x += 5) H(x, cy - 9, 1, 4, dark);
  };

  switch (style) {
    case 1: // A punta
      cap();
      [[13, 5], [19, 7], [25, 7], [31, 5]].forEach(([x, h]) => {
        for (let i = 0; i < h; i += 1) H(x + Math.floor(i / 2), cy - 13 - i, 5 - Math.floor(i / 2), 1);
      });
      break;
    case 2: // Lunghi
      cap();
      H(9, cy - 4, 8, 30);
      H(9, cy + 20, 8, 6, dark);
      if (back) H(12, cy + 8, 24, 20);
      else H(33, cy - 3, 5, 24);
      break;
    case 3: // Chignon
      cap();
      blob(ctx, back ? 24 : 18, cy - 15, 6, 5.5, color);
      H(back ? 21 : 15, cy - 17, 3, 1, light);
      break;
    case 4: // Cresta: lati rasati, striscia alta al centro
      blob(ctx, 24, cy - 8, 13.5, 7, shade(color, -0.45), 2.4);
      for (let y = cy - 18; y < cy - 2; y += 1) H(19, y, 10, 1, (y % 3 === 0) ? dark : color);
      H(20, cy - 18, 8, 1, light);
      break;
    case 5: // Cappellino: la calotta qui, la visiera dopo il viso
      blob(ctx, 24, cy - 10, 14.5, 7.5, color, 2.2);
      H(10, cy - 9, 28, 4);
      H(10, cy - 6, 28, 1, dark);
      blob(ctx, 24, cy - 16, 2, 1.5, light);
      if (!back) H(10, cy - 6, 8, 9, shade(color, -0.2));
      break;
    case 6: // Ricci: grande massa tonda con la trama a riccioli
      blob(ctx, back ? 24 : 22, cy - 4, 17, 15, color, 2.1);
      for (let y = cy - 18; y < cy + 10; y += 3) {
        for (let x = 7 + (y % 2); x < 40; x += 4) {
          if (!back && x > 21 && y > cy - 6) continue;
          H(x, y, 2, 1, dark);
        }
      }
      break;
    case 7: // Coda
      cap();
      H(back ? 21 : 6, cy - 3, 7, 22);
      H(back ? 21 : 6, cy - 3, 7, 3, dark);
      H(back ? 22 : 7, cy + 14, 5, 5, dark);
      break;
    case 8: // Caschetto con frangia
      cap();
      H(9, cy - 4, 9, 17);
      if (back) H(9, cy + 6, 30, 7);
      else H(35, cy - 4, 3, 14);
      break;
    case 9: // Rasato: poco piu' della pelle, a puntini
      for (let y = cy - 13; y < cy - 3; y += 1) {
        for (let x = 12; x < 37; x += 1) {
          const dx = (x + 0.5 - 24) / 13;
          const dy = (y + 0.5 - (cy - 4)) / 9.5;
          if (dx * dx + dy * dy <= 1 && (x + y) % 2 === 0) H(x, y, 1, 1, dark);
        }
      }
      return;
    default: // Corto
      cap();
      break;
  }
  if (style !== 4 && style !== 5 && style !== 6) {
    shine();
    strands();
  }
}

/** Parti dei capelli che stanno davanti al viso: frange e visiere, disegnate dopo la pelle. */
function drawHairFront(ctx, y0, style, color) {
  const cy = y0 + 24;
  const dark = shade(color, -0.3);
  if (style === 0) {
    px(ctx, 20, cy - 7, 4, 2, color);
    px(ctx, 25, cy - 7, 3, 1, color);
  }
  if (style === 8) {
    px(ctx, 19, cy - 7, 17, 3, color);
    px(ctx, 19, cy - 5, 17, 1, dark);
  }
  if (style === 5) {
    px(ctx, 28, cy - 6, 17, 3, dark);
    px(ctx, 28, cy - 6, 17, 1, color);
  }
}

function drawAccessory(ctx, y0, a, back) {
  const cy = y0 + 24;
  if (a === 1 && !back) {
    // Occhiali: montatura sottile attorno agli occhi.
    ctx.fillStyle = '#1f1f2e';
    [[22, 7], [30, 5]].forEach(([x, w]) => {
      ctx.fillRect(x, cy - 4, w, 1);
      ctx.fillRect(x, cy + 3, w, 1);
      ctx.fillRect(x, cy - 4, 1, 8);
      ctx.fillRect(x + w - 1, cy - 4, 1, 8);
    });
    ctx.fillRect(29, cy - 2, 1, 1);
    ctx.fillRect(14, cy - 2, 8, 1);
  }
  if (a === 2 && !back) {
    // Occhiali da sole: lenti piene con un riflesso rosa.
    px(ctx, 22, cy - 4, 7, 6, '#101018');
    px(ctx, 30, cy - 4, 6, 6, '#101018');
    px(ctx, 29, cy - 3, 1, 1, '#101018');
    px(ctx, 14, cy - 3, 8, 1, '#101018');
    px(ctx, 23, cy - 3, 2, 1, '#ec4899');
    px(ctx, 31, cy - 3, 2, 1, '#ec4899');
  }
  if (a === 3) {
    // Cuffie: archetto sopra la testa e padiglioni al neon sulle orecchie.
    for (let x = 12; x <= 36; x += 1) {
      const t = (x - 24) / 13;
      const y = Math.round(cy - 14 + t * t * 10);
      px(ctx, x, y, 1, 2, '#1f1f2e');
    }
    blob(ctx, 12, cy + 1, 4, 5, '#ec4899');
    px(ctx, 10, cy - 2, 2, 6, '#f9a8d4');
    if (back) blob(ctx, 36, cy + 1, 4, 5, '#ec4899');
    else px(ctx, 35, cy - 2, 3, 7, '#be185d');
  }
  if (a === 4 && !back) {
    // Collana con un piccolo vinile.
    for (let i = 0; i < 5; i += 1) {
      px(ctx, 20 + i, y0 + 41 + i, 1, 1, '#ffd700');
      px(ctx, 29 - i, y0 + 41 + i, 1, 1, '#ffd700');
    }
    blob(ctx, 24.5, y0 + 49, 3.5, 3.5, '#101018');
    px(ctx, 24, y0 + 48, 2, 2, '#ec4899');
  }
  if (a === 5) px(ctx, back ? 36 : 12, cy + 5, 2, 2, '#ffd700');
  if (a === 6) {
    // Bandana sulla fronte, con il nodo dietro.
    px(ctx, 11, cy - 9, 26, 4, '#ef4444');
    px(ctx, 11, cy - 9, 26, 1, '#f87171');
    for (let x = 12; x < 36; x += 4) px(ctx, x, cy - 7, 1, 1, '#fde68a');
    if (!back) {
      px(ctx, 6, cy - 8, 5, 3, '#dc2626');
      px(ctx, 5, cy - 5, 3, 5, '#dc2626');
    }
  }
}

/**
 * @param outfit null, 'sea' (costume in mare) o 'pool' (costume e cuffia in piscina)
 */
/** Mano del braccio davanti (x = 35) con l'oscillazione data: dove si tiene la boccia o la mazza. */
function frontHand(y0, swing) {
  return { x: 35 + swing + 3, y: y0 + 62 };
}

/**
 * Attrezzi degli sport, disegnati sopra al corpo: pallone da basket (palleggiato o sopra la
 * testa), boccia da bowling in mano, mazza da golf, stecca da biliardo.
 */
/** Manubrio: sbarra corta con due dischi scuri. */
function dumbbell(ctx, cx, cy) {
  px(ctx, cx - 5, cy - 1, 10, 2, '#9ca3af');
  px(ctx, cx - 7, cy - 3, 3, 6, '#1f2937');
  px(ctx, cx + 4, cy - 3, 3, 6, '#1f2937');
}

function drawSportProp(ctx, pose, frame, y0, o) {
  // Fatica: una goccia di sudore che scende dalla fronte, a fotogrammi alterni.
  if (o.sweat !== undefined && o.sweat % 2 === 1) {
    blob(ctx, 38, y0 + 14 + (o.sweat % 4), 1.6, 2.4, '#7dd3fc');
    px(ctx, 38, y0 + 12 + (o.sweat % 4), 1, 1, '#e0f2fe');
  }
  if (pose === 'curl') {
    // Manubri: in mano giu' lungo i fianchi, oppure all'altezza della spalla per il braccio che sale.
    const frontY = o.frontUp ? y0 + 30 : y0 + 64;
    const backY = o.backUp ? y0 + 30 : y0 + 64;
    dumbbell(ctx, 11, backY);
    dumbbell(ctx, 38, frontY);
    return;
  }
  if (pose === 'dribble') {
    // Il pallone rimbalza fra la mano e il pavimento.
    const hand = frontHand(y0, o.frontArm);
    const bounce = [0, 9, 16, 9][frame % 4];
    blob(ctx, hand.x + 1, hand.y + 6 + bounce, 5.5, 5.5, '#ea580c');
    px(ctx, hand.x - 4, hand.y + 6 + bounce, 11, 1, '#7c2d12');
    px(ctx, hand.x + 1, hand.y + 1 + bounce, 1, 11, '#7c2d12');
  } else if (pose === 'shoot' && frame === 0) {
    // Pallone sopra la testa, fra le mani, pronto al tiro.
    blob(ctx, 26, y0 + 12, 6, 6, '#ea580c');
    px(ctx, 20, y0 + 12, 12, 1, '#7c2d12');
    px(ctx, 26, y0 + 6, 1, 12, '#7c2d12');
  } else if (pose === 'bowl' && frame < 2) {
    const hand = frontHand(y0, o.frontArm);
    blob(ctx, hand.x, hand.y + 3, 6, 6, '#7c3aed');
    px(ctx, hand.x - 2, hand.y + 1, 1, 1, '#1e1b4b');
    px(ctx, hand.x + 1, hand.y + 1, 1, 1, '#1e1b4b');
    px(ctx, hand.x, hand.y + 4, 1, 1, '#1e1b4b');
  } else if (pose === 'putt') {
    // Mazza da golf: dalle mani giu' fino a terra, con la testa della mazza.
    const hand = frontHand(y0, o.frontArm);
    const footX = hand.x + (frame === 1 ? 8 : 3);
    for (let y = hand.y; y < 90; y += 1) px(ctx, Math.round(hand.x + ((footX - hand.x) * (y - hand.y)) / (90 - hand.y)), y, 1, 1, '#9ca3af');
    px(ctx, footX - 1, 89, 6, 3, '#4b5563');
    px(ctx, footX + 7, 90, 3, 2, '#f8fafc');
  } else if (pose === 'cue') {
    const hand = frontHand(y0, o.frontArm);
    const push = frame % 2 ? 4 : 0;
    for (let x = 4 + push; x < 47; x += 1) px(ctx, x, hand.y - 2 + Math.round((x - 4) * 0.08), 1, 1, x > 40 ? '#f5f5f4' : '#92400e');
  }
}

function drawAvatar(look, { back, pose, frame, outfit }) {
  const { canvas, ctx } = createCanvas(AVATAR_W, AVATAR_H, { readable: true });
  const parts = parseLook(look);
  const skin = SKINS[parts.s];
  const swim = !!outfit;
  const man = parts.b !== 1;
  const shirt = SHIRTS[parts.sh];
  // In acqua: costume del colore della maglia, gambe e piedi nudi.
  const pants = swim ? shirt : PANTS[parts.p];
  const shoe = swim ? skin : SHOES[parts.f];
  const legColor = swim ? skin : null;
  const hairColor = HAIR_COLORS[parts.hc];
  const o = poseOffsets(pose, frame);
  const y0 = o.bodyY + (o.sit ? 10 : 0);
  // Maniche: corte per T-shirt, assenti per la canotta, lunghe per il resto.
  const sleeveLength = swim || parts.t === BARE_CHEST ? 0 : parts.t === 0 ? 7 : parts.t === 4 ? 0 : 17;

  // Gambe: sedute si piegano in avanti, in piedi oscillano con il passo.
  if (o.sit) {
    px(ctx, 14, y0 + 62, 24, 8, pants);
    px(ctx, 14, y0 + 62, 24, 1, shade(pants, 0.2));
    px(ctx, 30, y0 + 68, 8, 12, shade(pants, -0.1));
    px(ctx, 29, y0 + 78, 12, 5, shoe);
    px(ctx, 29, y0 + 82, 12, 1, shade(shoe, -0.35));
  } else {
    leg(ctx, 14, y0 + 68, o.backLeg, shade(legColor || pants, -0.12), shade(shoe, -0.1), back);
    px(ctx, 14, y0 + 63, 21, 6, pants);
    leg(ctx, 25, y0 + 68, o.frontLeg, legColor || pants, shoe, back);
  }

  const sleeve = shirt;
  // Sulla panca le mani stanno sopra la testa (piu' in alto a braccia tese); nel tiro a canestro si allungano.
  const reach = pose === 'lift' ? o.liftReach : pose === 'curl' ? -12 : (o.shootReach || 0);
  arm(ctx, 8, y0, { up: o.backUp, swing: o.backArm, sleeve: shade(sleeve, -0.12), skin: shade(skin, -0.08), sleeveLength, reach, jab: o.backJab });
  // Collo in ombra sotto la testa.
  px(ctx, 20, y0 + 35, 9, 7, shade(skin, -0.18));
  // In acqua gli uomini stanno a petto nudo (con il pantaloncino), le donne con il costume intero.
  if (swim && man) drawBareChest(ctx, y0, { skin, back });
  else if (swim) drawSwimsuit(ctx, y0, { color: shirt, skin, back });
  else drawTorso(ctx, y0, parts, { shirt, skin, back });
  if (!o.sit && (swim ? man : parts.t !== 4)) px(ctx, 14, y0 + 63, 21, 2, shade(pants, -0.25)); // cintura / elastico
  arm(ctx, 35, y0, { up: o.frontUp, swing: o.frontArm, sleeve, skin, sleeveLength, reach, jab: o.frontJab });

  drawHead(ctx, y0, { skin, back });
  const capped = outfit === 'pool';
  if (capped) drawSwimCap(ctx, y0, CAP_COLORS[(parts.hc + parts.sh) % CAP_COLORS.length], back);
  else drawHair(ctx, y0, parts.h, hairColor, back);
  // Capelli lunghi, caschetto e ricci coprono le orecchie; gli altri (e la cuffia) le lasciano fuori.
  if (capped || ![2, 6, 8].includes(parts.h)) drawEars(ctx, y0, skin, back);
  if (!back) {
    faceWindow(ctx, y0, skin);
    drawFace(ctx, y0, skin);
    drawBrows(ctx, y0, hairColor);
    if (capped) drawGoggles(ctx, y0);
    else drawHairFront(ctx, y0, parts.h, hairColor);
  }
  // In acqua si tolgono solo le cuffie della musica e la bandana; occhiali, occhiali da sole,
  // collana e orecchino restano addosso.
  if (!swim || ![3, 6].includes(parts.a)) drawAccessory(ctx, y0, parts.a, back);
  drawSportProp(ctx, pose, frame, y0, o);
  if (pose === 'lift') {
    // Bilanciere tenuto sopra la testa (per ultimo, davanti alla testa): sbarra e due dischi per parte.
    const barY = y0 + 11 - reach;
    px(ctx, 1, barY, 46, 2, '#9ca3af');
    px(ctx, 1, barY - 5, 4, 12, '#1f2937');
    px(ctx, 43, barY - 5, 4, 12, '#1f2937');
    px(ctx, 5, barY - 3, 2, 8, '#4b5563');
    px(ctx, 41, barY - 3, 2, 8, '#4b5563');
  }

  outline(ctx, AVATAR_W, AVATAR_H);
  return bake(canvas);
}

const cache = new Map();

/**
 * Sprite pronto da disegnare, in cache: lo stesso avatar nella stessa posa viene generato
 * una volta sola, non a ogni fotogramma.
 */
export function avatarSprite(look, { back = false, flip = false, pose = 'stand', frame = 0, outfit = null } = {}) {
  const key = `${look}|${back}|${flip}|${pose}|${frame}|${outfit || ''}`;
  let sprite = cache.get(key);
  if (!sprite) {
    const base = drawAvatar(look, { back, pose, frame, outfit });
    sprite = flip ? mirror(base) : base;
    if (cache.size > 2000) cache.clear();
    cache.set(key, sprite);
  }
  return sprite;
}
