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

/**
 * Pezzi dei negozi del quartiere (LuxuryCatalog.java, stessi indici): capi firmati, orologi e
 * veicoli. Zero e' "niente". Si indossano solo se comprati: il guardaroba mostra solo quelli.
 */
export const OUTFITS = ['Nessuno', 'Completo gessato', 'Smoking', 'Abito da sera', 'Cappotto cammello', 'Giacca di pelle',
  'Tuta firmata', 'Blazer bianco', 'Abito di paillettes', 'Trench', 'Smoking bianco', 'Giacca di velluto', 'Kimono di seta',
  'Tailleur rosa', 'Gilet borchiato', 'Maglia della band', 'Camicia di flanella', 'Tuta glam leopardata',
  'Giacca di jeans con toppe', 'Completo di pelle rossa'];
export const GUITARS = ['Nessuna', 'Chitarra classica', 'Acustica western', 'Stratosfera rossa', 'Les Pauline sunburst',
  'Volo V bianca', 'Esplosiva nera', 'Basso Precisione', 'Basso Jazzista', 'Doppio manico'];
export const WATCHES = ['Nessuno', 'Rolaix Submarino', 'Rolaix Daytona d\'oro', 'Patec Philippa Nautilo', 'Patec Philippa Calatrava',
  'Audemar Piguay Quercia Reale', 'Audemar Piguay Offshore Nero', 'Rolaix GMT Pepsi', 'Rolaix Day-Date Platino',
  'Patec Philippa Aquanaut Verde', 'Audemar Piguay Codice 11.59', 'Richard Milla RM Scheletrato'];
export const NECKLACES = ['Nessuna', 'Collana di perle', 'Catena d\'oro', 'Riviera di diamanti', 'Pendente smeraldo',
  'Collier di rubini', 'Medaglione d\'oro'];
export const EARRINGS = ['Nessuno', 'Punti luce', 'Cerchi d\'oro', 'Perle pendenti', 'Gocce di smeraldo', 'Rubini', 'Zaffiri'];
export const RIDES = ['A piedi', 'Skateboard street', 'Longboard', 'BMX', 'Bici da corsa', 'Ferraro Spider rossa',
  'Lamborgo Toro giallo', 'Porsa Novecento undici', 'Bugatto Hypercar nera', 'Lotto Coupe\' blu'];

/** Come si disegna ogni capo: giacca e pantaloni (completi), abito lungo o corto, cappotto... */
const OUTFIT_STYLES = [
  null,
  { kind: 'suit', jacket: '#1e2a4a', pants: '#1e2a4a', shirt: '#f8fafc', tie: '#b91c1c', stripes: '#44557f' },
  { kind: 'suit', jacket: '#111114', pants: '#111114', shirt: '#ffffff', bow: '#0a0a0a', satin: '#3a3a44' },
  { kind: 'gown', color: '#b3122e', long: true },
  { kind: 'coat', color: '#c19a6b' },
  { kind: 'leather', color: '#1c1c21', zip: '#d4d4d8' },
  { kind: 'track', color: '#6d28d9', pants: '#6d28d9', stripe: '#f5f5f5' },
  { kind: 'suit', jacket: '#f5f3ea', pants: '#1e3a8a', shirt: '#dbeafe', buttons: '#d4a017' },
  { kind: 'gown', color: '#d4a017', long: false, sequins: true },
  { kind: 'coat', color: '#c8b08a', belt: '#8a6d45' },
  { kind: 'suit', jacket: '#f8f8f4', pants: '#111114', shirt: '#ffffff', bow: '#0a0a0a', satin: '#e5e5dc' },
  { kind: 'suit', jacket: '#6d1a2c', pants: '#111114', shirt: '#f8fafc', open: true },
  { kind: 'gown', color: '#1e2f6b', long: true, sleeves: true, blossoms: '#f9a8d4', obi: '#b91c1c' },
  { kind: 'suit', jacket: '#f4b6c8', pants: '#f4b6c8', shirt: '#fff1f2', buttons: '#d4a017', open: true },
  // Rock Store.
  { kind: 'vest', color: '#18181b', shirt: '#27272a', studs: '#e5e7eb', pants: '#3b5b8c', rips: true },
  { kind: 'tee', color: '#111114', pants: '#18181b', logo: true },
  { kind: 'flannel', color: '#b91c1c', check: '#18181b', shirt: '#9ca3af', pants: '#2d3a66', rips: true },
  { kind: 'jumpsuit', color: '#d4a054', spots: '#3f2a14', pants: '#d4a054', belt: '#e5e7eb' },
  { kind: 'denim', color: '#4a6fa5', shirt: '#f5f5f5', pants: '#18181b', patches: ['#ef4444', '#facc15', '#22c55e', '#111'] },
  { kind: 'leather', color: '#b91c1c', zip: '#e5e7eb', pants: '#991b1b' }
];

/** Chitarre (parte "g"): colore del corpo, forma e dettagli. */
export const GUITAR_STYLES = [
  null,
  { kind: 'classical', body: '#c8904f', edge: '#7c4a1e', hole: true },
  { kind: 'acoustic', body: '#d97706', edge: '#78350f', hole: true, burst: '#451a03' },
  { kind: 'strat', body: '#c81e1e', guard: '#f5f5f5' },
  { kind: 'lp', body: '#e0902e', burst: '#5b2c06', guard: '#1f1f1f' },
  { kind: 'v', body: '#f4f4f5', guard: '#111' },
  { kind: 'explorer', body: '#18181b', guard: '#f5f5f5' },
  { kind: 'bass', body: '#1d4ed8', guard: '#f5f5f5' },
  { kind: 'bass', body: '#b45309', burst: '#451a03', guard: '#3f2a14' },
  { kind: 'double', body: '#9f1239', guard: '#111' }
];

/** Orologi: cinturino, cassa, quadrante e ghiera. */
export const WATCH_STYLES = [
  null,
  { strap: '#c0c4cc', steel: '#e5e7eb', dial: '#111827', bezel: '#15803d' },
  { strap: '#d4a017', steel: '#f5d06a', dial: '#f5e6b8', bezel: '#d4a017' },
  { strap: '#c0c4cc', steel: '#e5e7eb', dial: '#1e3a8a', bezel: '#c0c4cc' },
  { strap: '#5b3a29', steel: '#e8a488', dial: '#faf7f2', bezel: '#e8a488' },
  { strap: '#cfd3d9', steel: '#eef0f3', dial: '#27408b', bezel: '#9ca3af' },
  { strap: '#1f1f22', steel: '#3f3f46', dial: '#0a0a0a', bezel: '#52525b' },
  { strap: '#d1d5db', steel: '#e5e7eb', dial: '#111827', bezel: '#1d4ed8', bezel2: '#dc2626' },
  { strap: '#e5e7eb', steel: '#f1f5f9', dial: '#a5d8ff', bezel: '#e5e7eb' },
  { strap: '#14532d', steel: '#d1d5db', dial: '#166534', bezel: '#d1d5db' },
  { strap: '#1f1f1f', steel: '#e8b48c', dial: '#1e1b4b', bezel: '#e8b48c' },
  { strap: '#dc2626', steel: '#d4d4d8', dial: '#27272a', bezel: '#a1a1aa', skeleton: true }
];

/** Collane: colore del filo, delle pietre e forma del pendente. */
const NECKLACE_STYLES = [
  null,
  { chain: '#f8fafc', stones: '#ffffff', beads: true },
  { chain: '#e0a82e', thick: true },
  { chain: '#e5e7eb', stones: '#dbeafe', beads: true, sparkle: true },
  { chain: '#e0a82e', pendant: '#16a34a' },
  { chain: '#e5e7eb', stones: '#dc2626', beads: true },
  { chain: '#e0a82e', pendant: '#e0a82e', medal: true }
];

/** Orecchini: colore e forma (punto, cerchio, goccia). */
const EARRING_STYLES = [
  null,
  { color: '#e0f2fe', shape: 'dot', sparkle: true },
  { color: '#e0a82e', shape: 'hoop' },
  { color: '#f8fafc', shape: 'drop' },
  { color: '#16a34a', shape: 'drop' },
  { color: '#dc2626', shape: 'dot' },
  { color: '#1d4ed8', shape: 'dot', sparkle: true }
];

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

/** Parti dei negozi: nel guardaroba si scorrono solo i pezzi posseduti. */
export const LUXURY_PARTS = [
  { key: 'o', label: 'Capo firmato', names: OUTFITS },
  { key: 'w', label: 'Orologio', names: WATCHES },
  { key: 'r', label: 'Veicolo', names: RIDES },
  { key: 'n', label: 'Collana', names: NECKLACES },
  { key: 'e', label: 'Orecchini', names: EARRINGS },
  { key: 'g', label: 'Chitarra', names: GUITARS }
];

/** Ordine delle parti nel codice salvato: le prime cinque sono quelle della prima versione. */
const CODE_ORDER = ['s', 'h', 'hc', 'sh', 'p', 't', 'f', 'a', 'b', 'o', 'w', 'r', 'n', 'e', 'g'];

export const DEFAULT_LOOK = 's1.h1.hc0.sh0.p0.t0.f0.a0.b0';

/** Il petto nudo e' solo da uomo: con la corporatura da donna diventa una canotta. */
export function fixLook(parts) {
  return parts.b === 1 && parts.t === BARE_CHEST ? { ...parts, t: 4 } : parts;
}

export function parseLook(look) {
  const parts = { s: 1, h: 1, hc: 0, sh: 0, p: 0, t: 0, f: 0, a: 0, b: 0, o: 0, w: 0, r: 0, n: 0, e: 0, g: 0 };
  (look || DEFAULT_LOOK).split('.').forEach((part) => {
    const match = /^([a-z]+)(\d+)$/.exec(part);
    if (match && match[1] in parts) parts[match[1]] = Number(match[2]);
  });
  LOOK_PARTS.forEach(({ key, count }) => {
    if (!(parts[key] >= 0 && parts[key] < count)) parts[key] = 0;
  });
  LUXURY_PARTS.forEach(({ key, names }) => {
    if (!(parts[key] >= 0 && parts[key] < names.length)) parts[key] = 0;
  });
  return fixLook(parts);
}

export function formatLook(parts) {
  // I pezzi dei negozi si scrivono solo se ce n'e' almeno uno: i codici di sempre restano uguali.
  // Collana e orecchini vengono dopo e solo se c'e' uno dei due (o la chitarra, che chiude il codice).
  const guitar = parts.g;
  const jewels = guitar || parts.n || parts.e;
  const luxury = jewels || parts.o || parts.w || parts.r;
  return CODE_ORDER.filter((key) => {
    if (key === 'g') return guitar;
    if (key === 'n' || key === 'e') return jewels;
    return luxury || !['o', 'w', 'r'].includes(key);
  }).map((key) => `${key}${parts[key] || 0}`).join('.');
}

/** Indice del veicolo nel codice aspetto (0 a piedi). */
export function rideOf(look) {
  return parseLook(look).r;
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
  // Karaoke: microfono alla bocca con il braccio davanti; a tempo il corpo ondeggia.
  if (pose === 'mic') return { ...pose0, frontUp: true, bodyY: frame % 2 ? -2 : 0, backArm: frame % 2 ? -3 : 3 };
  // Pesca: canna in mano, braccio in avanti (frame 1 = recupero, la punta si piega).
  if (pose === 'fish') return { ...pose0, frontArm: frame === 1 ? -3 : -6, backArm: 2 };
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
  // Chitarra: il braccio davanti pennella sulle corde, il corpo va a tempo.
  if (pose === 'guitar') return { ...pose0, frontArm: frame % 2 ? -3 : 1, backArm: -4, bodyY: frame % 2 ? 1 : 0, frontLeg: 2, backLeg: -2 };
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

/** Giacca, cappotto o busto dell'abito al posto della maglia (capi dei negozi del quartiere). */
function drawOutfitTorso(ctx, y0, style, { skin, back }) {
  const top = y0 + 40;
  if (style.kind === 'gown') {
    // Busto senza maniche con le spalline sottili; la gonna si disegna con drawOutfitSkirt.
    block(ctx, 14, top + 4, 21, 21, style.color);
    px(ctx, 17, top, 3, 5, style.color);
    px(ctx, 29, top, 3, 5, style.color);
    px(ctx, 13, top, 4, 4, skin);
    px(ctx, 32, top, 4, 4, skin);
    if (!back) {
      px(ctx, 20, top, 9, 4, skin);
      px(ctx, 21, top + 4, 7, 1, skin);
    }
    if (style.sequins) {
      for (let y = top + 5; y < top + 25; y += 3) {
        for (let x = 15 + (y % 2); x < 34; x += 3) px(ctx, x, y, 1, 1, shade(style.color, 0.45));
      }
    }
    if (style.sleeves) {
      // Kimono: scollo a V incrociato, fiori sulla seta e l'obi in vita.
      block(ctx, 14, top, 21, 25, style.color);
      if (!back) {
        for (let i = 0; i < 9; i += 1) px(ctx, 20 + i, top + i, 2, 1, shade(style.color, 0.35));
        px(ctx, 21, top, 7, 2, skin);
      }
      for (let i = 0; i < 6; i += 1) px(ctx, 16 + ((i * 7) % 16), top + 4 + ((i * 5) % 16), 2, 2, style.blossoms);
      px(ctx, 14, top + 17, 21, 5, style.obi);
      px(ctx, 14, top + 17, 21, 1, shade(style.obi, 0.3));
    }
    return;
  }
  if (['vest', 'tee', 'flannel', 'jumpsuit', 'denim'].includes(style.kind)) {
    drawRockTorso(ctx, top, style, { skin, back });
    return;
  }
  const jacket = style.jacket || style.color;
  const dark = shade(jacket, -0.3);
  const light = shade(jacket, 0.3);
  const long = style.kind === 'coat';
  block(ctx, 13, top, 23, long ? 40 : 26, jacket);
  ctx.clearRect(13, top, 2, 1);
  ctx.clearRect(34, top, 2, 1);
  if (style.stripes) for (let x = 15; x < 35; x += 3) px(ctx, x, top + 1, 1, 24, style.stripes);
  if (back) {
    px(ctx, 24, top + 12, 1, long ? 27 : 13, dark);
    px(ctx, 18, top, 13, 2, shade(jacket, -0.12));
    return;
  }
  if (style.kind === 'suit') {
    // Camicia a V con la cravatta (o il papillon) e i revers della giacca.
    for (let i = 0; i < 10; i += 1) {
      const inset = Math.floor(i / 2);
      px(ctx, 20 + inset, top + i, 9 - inset * 2, 1, style.shirt);
    }
    if (style.tie) {
      px(ctx, 24, top + 1, 2, 2, shade(style.tie, -0.2));
      px(ctx, 24, top + 3, 2, 13, style.tie);
      px(ctx, 23, top + 14, 4, 2, style.tie);
    }
    if (style.bow) {
      px(ctx, 21, top + 1, 3, 3, style.bow);
      px(ctx, 26, top + 1, 3, 3, style.bow);
      px(ctx, 24, top + 2, 2, 2, style.bow);
    }
    const lapel = style.satin || dark;
    for (let i = 0; i < 11; i += 1) {
      px(ctx, 19 - Math.floor(i / 3) + Math.floor(i / 2), top + i, 2, 1, lapel);
      px(ctx, 29 + Math.floor(i / 3) - Math.floor(i / 2), top + i, 2, 1, lapel);
    }
    if (style.open) {
      // Giacca aperta sulla camicia: niente cravatta, colletto aperto.
      px(ctx, 22, top, 5, 3, skin);
    }
    const button = style.buttons || shade(jacket, -0.45);
    px(ctx, 23, top + 17, 1, 1, button);
    px(ctx, 23, top + 21, 1, 1, button);
    if (style.buttons) {
      px(ctx, 27, top + 17, 1, 1, button);
      px(ctx, 27, top + 21, 1, 1, button);
    }
    px(ctx, 15, top + 6, 4, 1, light); // taschino
  } else if (style.kind === 'coat') {
    // Cappotto doppiopetto: colletto largo, due file di bottoni, cintura in vita.
    px(ctx, 19, top, 11, 5, shade(jacket, 0.12));
    px(ctx, 21, top + 1, 7, 3, skin);
    for (let y = top + 8; y < top + 34; y += 6) {
      px(ctx, 21, y, 2, 2, '#4a3222');
      px(ctx, 27, y, 2, 2, '#4a3222');
    }
    px(ctx, 13, top + 22, 23, 2, style.belt || dark);
    if (style.belt) px(ctx, 23, top + 21, 3, 4, '#d4a017');
    px(ctx, 24, top + 5, 1, 34, dark);
  } else if (style.kind === 'leather') {
    // Chiodo: colletto, zip in diagonale, riflessi lucidi.
    px(ctx, 16, top, 6, 4, light);
    px(ctx, 27, top, 6, 4, light);
    for (let i = 0; i < 22; i += 1) px(ctx, 22 + Math.floor(i / 5), top + 2 + i, 1, 1, style.zip);
    px(ctx, 15, top + 4, 1, 16, shade(jacket, 0.5));
    px(ctx, 29, top + 12, 5, 1, style.zip);
  } else if (style.kind === 'track') {
    // Tuta: zip dritta, colletto alto, bande bianche.
    px(ctx, 19, top, 11, 3, shade(jacket, 0.15));
    px(ctx, 24, top + 2, 1, 23, style.stripe);
    px(ctx, 13, top + 2, 2, 23, style.stripe);
  }
  px(ctx, 14, top + (long ? 39 : 25), 21, 1, dark);
}

/** Capi del Rock Store: gilet borchiato, maglia della band, flanella, tuta leopardata, jeans con toppe. */
function drawRockTorso(ctx, top, style, { skin, back }) {
  const c = style.color;
  const dark = shade(c, -0.3);
  if (style.kind === 'vest') {
    // Maglia scura sotto, gilet di pelle aperto sopra con le borchie sulle spalle.
    block(ctx, 14, top + 2, 21, 23, style.shirt);
    px(ctx, 13, top, 3, 3, skin);
    px(ctx, 33, top, 3, 3, skin);
    px(ctx, 14, top + 1, 8, 24, c);
    px(ctx, 27, top + 1, 8, 24, c);
    if (back) px(ctx, 14, top + 1, 21, 24, c);
    for (let x = 15; x < 34; x += 3) px(ctx, x, top + 2, 1, 1, style.studs);
    for (let y = top + 6; y < top + 24; y += 4) {
      px(ctx, 21, y, 1, 1, style.studs);
      px(ctx, 27, y, 1, 1, style.studs);
    }
    return;
  }
  block(ctx, 13, top, 23, 25, c);
  ctx.clearRect(13, top, 2, 1);
  ctx.clearRect(34, top, 2, 1);
  if (style.kind === 'jumpsuit') {
    // Macchie del leopardo e la cintura d'argento.
    for (let i = 0; i < 14; i += 1) px(ctx, 14 + ((i * 7) % 20), top + 2 + ((i * 5) % 20), 2, 2, style.spots);
    if (!back) px(ctx, 20, top, 9, 5, skin);
    px(ctx, 13, top + 21, 23, 2, style.belt);
    return;
  }
  if (style.kind === 'flannel') {
    // Quadri: righe scure incrociate sul rosso, aperta davanti sulla maglia grigia.
    for (let x = 13; x < 36; x += 4) px(ctx, x, top, 1, 25, style.check);
    for (let y = top + 2; y < top + 25; y += 4) px(ctx, 13, y, 23, 1, style.check);
    if (!back) px(ctx, 21, top, 7, 25, style.shirt);
    return;
  }
  if (style.kind === 'denim') {
    if (!back) px(ctx, 21, top, 7, 25, style.shirt);
    style.patches.forEach((color, i) => px(ctx, back ? 16 + i * 5 : [15, 30, 16, 29][i], back ? top + 8 + (i % 2) * 6 : top + 6 + i * 4, 3, 3, color));
    px(ctx, 13, top, 23, 2, dark);
    return;
  }
  // Maglia della band: girocollo e il logo (un fulmine su un disco).
  if (!back && style.logo) {
    px(ctx, 20, top, 9, 2, dark);
    blob(ctx, 24.5, top + 11, 5, 5, '#e5e7eb');
    blob(ctx, 24.5, top + 11, 3.5, 3.5, '#111114');
    px(ctx, 25, top + 7, 2, 4, '#ef4444');
    px(ctx, 23, top + 10, 2, 4, '#ef4444');
    px(ctx, 24, top + 13, 2, 3, '#ef4444');
  }
}

/**
 * Chitarra a pixel: corpo (forma per modello), manico e paletta. (x, y) e' il centro del corpo,
 * (dx, dy) la direzione del manico.
 */
function drawGuitarShape(ctx, x, y, style, dx, dy) {
  const neckLen = style.kind === 'bass' ? 30 : style.kind === 'double' ? 26 : 24;
  const neck = (offset, color) => {
    for (let i = 3; i < neckLen; i += 1) px(ctx, Math.round(x + dx * i + offset), Math.round(y + dy * i), 2, 2, color);
    px(ctx, Math.round(x + dx * neckLen + offset - 1), Math.round(y + dy * neckLen - 1), 4, 3, '#27272a');
  };
  neck(0, '#7c4a1e');
  if (style.kind === 'double') neck(-3, '#7c4a1e');
  const b = style.body;
  if (style.kind === 'v') {
    for (let i = 0; i < 10; i += 1) {
      px(ctx, x - dx * i - 3 - i * 0.2, y - dy * i + i * 0.6, 3, 3, b);
      px(ctx, x - dx * i + 1 + i * 0.2, y - dy * i + i * 0.6 + 2, 3, 3, b);
    }
  } else if (style.kind === 'explorer') {
    px(ctx, x - 6, y - 3, 12, 7, b);
    px(ctx, x - 9, y + 2, 7, 4, b);
    px(ctx, x + 2, y - 6, 5, 4, b);
  } else {
    const r = style.kind === 'acoustic' ? 7.5 : style.kind === 'classical' ? 6.5 : 6;
    blob(ctx, x - dx * 3, y - dy * 3 + 1, r, r * 0.9, b);
    blob(ctx, x + dx * 2, y + dy * 2, r * 0.75, r * 0.7, b);
    if (style.burst) blob(ctx, x - dx * 3, y - dy * 3 + 1, r * 0.55, r * 0.5, shade(b, 0.2));
    if (style.hole) blob(ctx, x, y, 2, 2, '#1c1208');
    else if (style.guard) px(ctx, Math.round(x - 3), Math.round(y), 5, 3, style.guard);
    px(ctx, Math.round(x - 1), Math.round(y + 2), 3, 1, '#d4d4d8');
  }
}

/** Gonna dell'abito sopra le gambe: lunga fino alle caviglie o corta sopra il ginocchio. */
function drawOutfitSkirt(ctx, y0, style) {
  if (style.kind !== 'gown') return;
  const from = y0 + 62;
  const to = style.long ? y0 + 86 : y0 + 76;
  for (let y = from; y < to; y += 1) {
    const t = (y - from) / (to - from);
    const half = Math.round(11 + t * 5);
    px(ctx, 25 - half, y, half * 2, 1, style.color);
    px(ctx, 25 + half - 3, y, 3, 1, shade(style.color, -0.22));
    px(ctx, 25 - half, y, 1, 1, shade(style.color, 0.25));
    if (style.sequins && (y + Math.floor(t * 7)) % 3 === 0) {
      for (let x = 25 - half + 2; x < 25 + half - 2; x += 3) px(ctx, x, y, 1, 1, shade(style.color, 0.5));
    }
  }
  // Spacco dell'abito lungo.
  if (style.long) px(ctx, 29, y0 + 74, 1, 12, shade(style.color, -0.4));
}

/** Orologio al polso del braccio davanti (se il braccio e' giu' e si vede di fronte). */
function drawWatch(ctx, y0, style, swing) {
  const top = y0 + 42;
  const row = 14;
  const x = 35 + Math.round((swing * row) / 18);
  const y = top + row;
  px(ctx, x - 1, y, 8, 3, style.strap);
  px(ctx, x + 1, y - 1, 4, 5, style.bezel);
  if (style.bezel2) px(ctx, x + 1, y + 2, 4, 2, style.bezel2);
  px(ctx, x + 2, y, 2, 3, style.dial);
  if (style.skeleton) px(ctx, x + 2, y + 1, 2, 1, '#d4a017');
  px(ctx, x + 2, y, 1, 1, '#ffffff');
}

/** Collana sul collo: filo a V, perle o pietre, o un pendente in fondo. Di spalle solo il filo. */
function drawNecklace(ctx, y0, style, back) {
  const top = y0 + 40;
  if (back) {
    px(ctx, 19, top, 11, 1, style.chain);
    return;
  }
  const w = style.thick ? 2 : 1;
  for (let i = 0; i < 6; i += 1) {
    px(ctx, 19 + i, top + i, w, w, style.chain);
    px(ctx, 30 - i, top + i, w, w, style.chain);
    if (style.beads && i % 2 === 0) {
      px(ctx, 19 + i, top + i, 2, 2, style.stones);
      px(ctx, 29 - i, top + i, 2, 2, style.stones);
    }
  }
  if (style.pendant) {
    if (style.medal) {
      blob(ctx, 24.5, top + 8, 2.4, 2.4, style.pendant);
      px(ctx, 24, top + 7, 1, 1, '#fff7c2');
    } else {
      px(ctx, 24, top + 6, 2, 2, style.chain);
      blob(ctx, 24.5, top + 9, 1.8, 2.6, style.pendant);
      px(ctx, 24, top + 8, 1, 1, '#bbf7d0');
    }
  }
  if (style.sparkle) {
    px(ctx, 21, top + 1, 1, 1, '#ffffff');
    px(ctx, 28, top + 3, 1, 1, '#ffffff');
  }
}

/** Orecchini sotto il lobo: di fronte si vede un orecchio (a sinistra), di spalle tutti e due. */
function drawEarrings(ctx, y0, style, back) {
  const cy = y0 + 24;
  const one = (x) => {
    if (style.shape === 'hoop') {
      px(ctx, x - 1, cy + 5, 1, 4, style.color);
      px(ctx, x + 2, cy + 5, 1, 4, style.color);
      px(ctx, x, cy + 8, 2, 1, style.color);
    } else if (style.shape === 'drop') {
      px(ctx, x, cy + 5, 1, 2, '#e0a82e');
      blob(ctx, x + 0.5, cy + 8.5, 1.4, 2, style.color);
    } else {
      px(ctx, x, cy + 5, 2, 2, style.color);
    }
    if (style.sparkle) px(ctx, x + 1, cy + 5, 1, 1, '#ffffff');
  };
  one(11);
  if (back) one(36);
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
  if (pose === 'mic') {
    // Microfono davanti alla bocca: impugnatura scura e retina grigia.
    px(ctx, 31, y0 + 24, 3, 8, '#27272a');
    blob(ctx, 32, y0 + 22, 2.6, 2.6, '#a1a1aa');
    px(ctx, 31, y0 + 21, 1, 1, '#e4e4e7');
    return;
  }
  if (pose === 'fish') {
    // Canna da pesca: dalla mano sale in diagonale verso il mare, con il mulinello.
    const hand = frontHand(y0, o.frontArm);
    const bend = frame === 1 ? 1 : 0;
    for (let i = 0; i < 34; i += 1) px(ctx, hand.x + Math.round(i * 0.55), hand.y - i - (i > 24 ? bend * (i - 24) * -0.5 : 0), 1, 1, i < 8 ? '#44403c' : '#a16207');
    px(ctx, hand.x - 2, hand.y - 3, 4, 3, '#71717a');
    return;
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

/**
 * Attrezzatura da hockey sul ghiaccio: casco del colore della maglia con la griglia davanti e
 * la mazza di legno nella mano davanti, con la paletta appoggiata sul ghiaccio.
 */
function drawHockeyGear(ctx, y0, { shirt, back, frontArm }) {
  const cy = y0 + 24;
  blob(ctx, 24, cy - 7, 15, 9, shade(shirt, -0.15), 2.3);
  px(ctx, 10, cy - 4, 28, 2, shade(shirt, -0.35));
  px(ctx, 17, cy - 13, 8, 2, shade(shirt, 0.3));
  if (!back) {
    for (let x = 22; x <= 37; x += 3) px(ctx, x, cy - 3, 1, 12, '#d4d4d8');
    px(ctx, 22, cy + 3, 16, 1, '#d4d4d8');
  }
  const hand = frontHand(y0, frontArm);
  for (let y = hand.y - 4; y < 90; y += 1) {
    const x = Math.round(hand.x + ((y - hand.y + 4) * 7) / (90 - hand.y + 4));
    px(ctx, x, y, 2, 1, '#b07a45');
  }
  px(ctx, hand.x + 7, 88, 9, 3, '#1f2937');
  px(ctx, hand.x + 7, 88, 9, 1, '#f5f5f5');
}

function drawAvatar(look, { back, pose, frame, outfit, gear }) {
  const { canvas, ctx } = createCanvas(AVATAR_W, AVATAR_H, { readable: true });
  const parts = parseLook(look);
  const skin = SKINS[parts.s];
  const swim = !!outfit;
  const man = parts.b !== 1;
  const shirt = SHIRTS[parts.sh];
  // Capo firmato (non in acqua): cambia pantaloni e maniche; gli abiti scoprono le gambe.
  const style = swim ? null : OUTFIT_STYLES[parts.o];
  // In acqua: costume del colore della maglia, gambe e piedi nudi.
  const pants = swim ? shirt : (style?.pants || (style?.kind === 'gown' ? skin : PANTS[parts.p]));
  const shoe = swim ? skin : SHOES[parts.f];
  const legColor = swim || style?.kind === 'gown' ? skin : null;
  const hairColor = HAIR_COLORS[parts.hc];
  const o = poseOffsets(pose, frame);
  const y0 = o.bodyY + (o.sit ? 10 : 0);
  // Maniche: corte per T-shirt, assenti per la canotta, lunghe per il resto.
  let sleeveLength = swim || parts.t === BARE_CHEST ? 0 : parts.t === 0 ? 7 : parts.t === 4 ? 0 : 17;
  if (style) sleeveLength = (style.kind === 'gown' && !style.sleeves) || style.kind === 'vest' ? 0 : style.kind === 'tee' ? 7 : 17;

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

  const sleeve = style ? (style.jacket || style.color) : shirt;
  // Chitarra a tracolla: sulla schiena mentre si cammina, davanti mentre si suona.
  const guitar = swim ? null : GUITAR_STYLES[parts.g];
  const playing = pose === 'guitar';
  if (guitar && !playing && !back) drawGuitarShape(ctx, 12, y0 + 58, guitar, 0.35, -0.94);
  // Sulla panca le mani stanno sopra la testa (piu' in alto a braccia tese); nel tiro a canestro si allungano.
  const reach = pose === 'lift' ? o.liftReach : pose === 'curl' ? -12 : (o.shootReach || 0);
  arm(ctx, 8, y0, { up: o.backUp, swing: o.backArm, sleeve: shade(sleeve, -0.12), skin: shade(skin, -0.08), sleeveLength, reach, jab: o.backJab });
  // Collo in ombra sotto la testa.
  px(ctx, 20, y0 + 35, 9, 7, shade(skin, -0.18));
  // In acqua gli uomini stanno a petto nudo (con il pantaloncino), le donne con il costume intero.
  if (swim && man) drawBareChest(ctx, y0, { skin, back });
  else if (swim) drawSwimsuit(ctx, y0, { color: shirt, skin, back });
  else if (style) drawOutfitTorso(ctx, y0, style, { skin, back });
  else drawTorso(ctx, y0, parts, { shirt, skin, back });
  if (!o.sit && !style && (swim ? man : parts.t !== 4)) px(ctx, 14, y0 + 63, 21, 2, shade(pants, -0.25)); // cintura / elastico
  if (style && !o.sit) drawOutfitSkirt(ctx, y0, style);
  // Jeans strappati alle ginocchia.
  if (style?.rips && !o.sit) {
    px(ctx, 16 + Math.round(o.backLeg / 2), y0 + 76, 4, 2, skin);
    px(ctx, 27 + Math.round(o.frontLeg / 2), y0 + 76, 4, 2, skin);
  }
  if (guitar && playing) drawGuitarShape(ctx, 28, y0 + 60, guitar, -0.87, -0.5);
  if (guitar && !playing && back) drawGuitarShape(ctx, 22, y0 + 58, guitar, 0.3, -0.95);
  arm(ctx, 35, y0, { up: o.frontUp, swing: o.frontArm, sleeve, skin, sleeveLength, reach, jab: o.frontJab });
  const watch = swim ? null : WATCH_STYLES[parts.w];
  if (watch && !o.frontUp && !o.frontJab) drawWatch(ctx, y0, watch, o.frontArm);

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
  // Gioielli della gioielleria: si tengono anche in acqua.
  if (NECKLACE_STYLES[parts.n]) drawNecklace(ctx, y0, NECKLACE_STYLES[parts.n], back);
  if (EARRING_STYLES[parts.e]) drawEarrings(ctx, y0, EARRING_STYLES[parts.e], back);
  drawSportProp(ctx, pose, frame, y0, o);
  if (gear === 'hockey' && !swim) drawHockeyGear(ctx, y0, { shirt, back, frontArm: o.frontArm });
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
export function avatarSprite(look, { back = false, flip = false, pose = 'stand', frame = 0, outfit = null, gear = null } = {}) {
  const key = `${look}|${back}|${flip}|${pose}|${frame}|${outfit || ''}|${gear || ''}`;
  let sprite = cache.get(key);
  if (!sprite) {
    const base = drawAvatar(look, { back, pose, frame, outfit, gear });
    sprite = flip ? mirror(base) : base;
    if (cache.size > 2000) cache.clear();
    cache.set(key, sprite);
  }
  return sprite;
}
