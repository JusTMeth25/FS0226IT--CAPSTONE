import { HALF_H, HALF_W } from '../iso.js';
import { isOutdoor } from '../weather.js';

/**
 * Veicoli del quartiere (LuxuryCatalog.java, parte "r" del codice aspetto): skateboard, bici e
 * auto sportive. Non sono sprite fissi: si disegnano come piccoli solidi isometrici orientati
 * nella direzione in cui si va, cosi' girano bene in tutte e otto le direzioni.
 *
 * Coordinate del modello: u in avanti e v verso destra, in caselle; h in pixel verso l'alto.
 * Il veicolo ha due strati: `under` (ruote, ombra, tavola) prima dell'avatar e `over`
 * (carrozzeria, parabrezza) dopo, cosi' chi guida sembra seduto dentro l'auto.
 */

/** Stanze dove si va in skate, bici o auto: all'aperto ma non negli stadi (RoomInstance.rideable). */
export function canRide(room) {
  return isOutdoor(room) && room.wallStyle !== 'stadium';
}

/** Caselle per passo (come LuxuryCatalog.speed): a piedi 1. */
export const RIDE_SPEEDS = [1, 2, 2, 2, 3, 4, 4, 4, 5, 4];

/** Quanto sale l'avatar sopra il veicolo e in che posa sta. */
export const RIDE_POSE = [
  null,
  { pose: 'stand', lift: 5 },
  { pose: 'stand', lift: 5 },
  { pose: 'sit', lift: 4 },
  { pose: 'sit', lift: 4 },
  // Auto: seduti dentro, un po' piu' in basso (la carrozzeria copre le gambe).
  { pose: 'sit', lift: -6 },
  { pose: 'sit', lift: -6 },
  { pose: 'sit', lift: -6 },
  { pose: 'sit', lift: -6 },
  { pose: 'sit', lift: -6 }
];

/**
 * Modelli 3D delle auto (carModels.js): si caricano con three.js solo quando serve la prima auto,
 * cosi' l'hotel non scarica three.js se nessuno guida.
 */
let carModels = null;
let carModelsLoading = false;
function models() {
  if (!carModels && !carModelsLoading) {
    carModelsLoading = true;
    import('./carModels.js').then((m) => { carModels = m; }).catch(() => {});
  }
  return carModels;
}

/** Il modello 3D di questa auto e' pronto? (per ridisegnare le anteprime quando arriva) */
export function whenVehicleReady(ride) {
  return import('./carModels.js').then((m) => (m.CAR_MODELS.has(ride) ? m.whenCarReady(ride) : null)).catch(() => null);
}

const CARS = {
  5: { body: '#d91a1a', dark: '#8f0f0f', stripe: '#fde047', spoiler: false },
  6: { body: '#f5c518', dark: '#a8850b', stripe: '#111827', spoiler: true },
  7: { body: '#f4f4f5', dark: '#a1a1aa', stripe: '#dc2626', spoiler: false },
  8: { body: '#111827', dark: '#1e3a8a', stripe: '#3b82f6', spoiler: true },
  9: { body: '#2563eb', dark: '#1e3a8a', stripe: '#f4f4f5', spoiler: true }
};
const BOARDS = { 1: { deck: '#ec4899', wheel: '#22d3ee' }, 2: { deck: '#a16207', wheel: '#fde047' } };
const BIKES = { 3: { frame: '#16a34a', tire: '#111827' }, 4: { frame: '#e11d48', tire: '#1f2937' } };

function shadeHex(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k)));
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}

/**
 * Proiezione del modello sullo schermo per una direzione e uno zoom. La direzione e' quella degli
 * avatar (0 nord, 2 est...), anche con i decimali: l'auto sulla pedana gira in modo continuo.
 */
function projector(foot, dir, scale) {
  const angle = (dir - 2) * (Math.PI / 4);
  const f = [Math.cos(angle), Math.sin(angle)];
  const r = [-f[1], f[0]];
  return (u, v, h = 0) => {
    const tx = f[0] * u + r[0] * v;
    const ty = f[1] * u + r[1] * v;
    return { x: foot.x + (tx - ty) * HALF_W * scale, y: foot.y + (tx + ty) * HALF_H * scale - h * scale, tx, ty };
  };
}

function poly(ctx, points, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.fill();
}

/**
 * Parallelepipedo del modello: facce laterali rivolte verso chi guarda (quelle che scendono
 * sullo schermo), piu' scure a destra, e il coperchio.
 */
function box(ctx, P, { u0, u1, v0, v1, h0, h1, color, top = null, alpha = 1 }) {
  const corners = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
  const low = corners.map(([u, v]) => P(u, v, h0));
  const high = corners.map(([u, v]) => P(u, v, h1));
  ctx.globalAlpha = alpha;
  for (let i = 0; i < 4; i += 1) {
    const j = (i + 1) % 4;
    // Normale della faccia nel piano: verso fuori dal centro del box.
    const mid = { tx: (low[i].tx + low[j].tx) / 2, ty: (low[i].ty + low[j].ty) / 2 };
    const c = P((u0 + u1) / 2, (v0 + v1) / 2, h0);
    const nx = mid.tx - c.tx;
    const ny = mid.ty - c.ty;
    if (nx + ny <= 0.0001) continue;
    const light = nx - ny > 0 ? -0.28 : -0.1;
    poly(ctx, [low[i], low[j], high[j], high[i]], shadeHex(color, light));
  }
  poly(ctx, high, top || shadeHex(color, 0.08));
  ctx.globalAlpha = 1;
}

/** Ruota vista di lato nel piano del veicolo (per le bici): un anello. */
function wheel(ctx, P, u, radiusTiles, radiusPx, color, scale) {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, 2 * scale);
  ctx.beginPath();
  for (let i = 0; i <= 20; i += 1) {
    const a = (i / 20) * Math.PI * 2;
    const p = P(u + Math.cos(a) * radiusTiles, 0, radiusPx + Math.sin(a) * radiusPx);
    if (i) ctx.lineTo(p.x, p.y);
    else ctx.moveTo(p.x, p.y);
  }
  ctx.stroke();
}

function line(ctx, a, b, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

/**
 * Disegna uno strato del veicolo sotto (under) o sopra (over) l'avatar.
 * @param foot punto dello schermo sotto i piedi dell'avatar (centro della casella)
 */
export function drawVehicle(ctx, ride, foot, dir, scale, layer, now = 0) {
  if (!ride) return;
  // Auto con il modello 3D pronto: le sue immagini; altrimenti quella disegnata qui sotto.
  if (CARS[ride] && models()?.drawCarModel(ctx, ride, foot, dir, scale, layer)) return;
  // Le auto un po' piu' grandi del vero rispetto agli avatar, come nei giochi: si vedono meglio.
  const P = projector(foot, dir, CARS[ride] ? scale * 1.25 : scale);
  ctx.save();
  if (BOARDS[ride]) {
    if (layer !== 'under') return ctx.restore();
    const b = BOARDS[ride];
    const half = ride === 2 ? 0.55 : 0.42;
    [[-half + 0.1, -0.12], [-half + 0.1, 0.12], [half - 0.1, -0.12], [half - 0.1, 0.12]].forEach(([u, v]) => {
      box(ctx, P, { u0: u - 0.05, u1: u + 0.05, v0: v - 0.03, v1: v + 0.03, h0: 0, h1: 3, color: b.wheel });
    });
    box(ctx, P, { u0: -half, u1: half, v0: -0.16, v1: 0.16, h0: 3, h1: 5, color: b.deck, top: shadeHex(b.deck, 0.2) });
  } else if (BIKES[ride]) {
    const b = BIKES[ride];
    const r = ride === 4 ? 9 : 7;
    if (layer === 'under') {
      wheel(ctx, P, -0.32, 0.2, r, b.tire, scale);
      const seat = P(-0.12, 0, r + 12);
      const pedal = P(0, 0, r - 1);
      const bar = P(0.26, 0, r + 14);
      line(ctx, P(-0.32, 0, r), pedal, b.frame, 2 * scale);
      line(ctx, pedal, seat, b.frame, 2 * scale);
      line(ctx, seat, P(0.2, 0, r + 11), b.frame, 2 * scale);
      line(ctx, pedal, P(0.2, 0, r + 11), b.frame, 2 * scale);
      line(ctx, P(-0.32, 0, r), seat, b.frame, 1.5 * scale);
      line(ctx, P(0.2, 0, r + 11), bar, '#27272a', 2 * scale);
    } else {
      wheel(ctx, P, 0.34, 0.2, r, b.tire, scale);
      line(ctx, P(0.34, 0, r), P(0.24, 0, r + 12), b.frame, 2 * scale);
      const bar = P(0.26, 0, r + 14);
      line(ctx, P(0.26, -0.12, r + 14), P(0.26, 0.12, r + 14), '#27272a', 2 * scale);
      ctx.fillStyle = '#27272a';
      ctx.fillRect(bar.x - scale, bar.y - scale, 2 * scale, 2 * scale);
    }
  } else if (CARS[ride]) {
    const c = CARS[ride];
    if (layer === 'under') {
      // Ombra e ruote.
      const s = [P(-0.8, -0.44, 0), P(0.8, -0.44, 0), P(0.8, 0.44, 0), P(-0.8, 0.44, 0)];
      poly(ctx, s, 'rgba(0, 0, 0, 0.35)');
      [[-0.5, -0.42], [-0.5, 0.42], [0.5, -0.42], [0.5, 0.42]].forEach(([u, v]) => {
        box(ctx, P, { u0: u - 0.14, u1: u + 0.14, v0: v - 0.06, v1: v + 0.06, h0: 0, h1: 8, color: '#18181b' });
      });
    } else {
      // Carrozzeria bassa, cofano che scende davanti, fari, parabrezza trasparente.
      box(ctx, P, { u0: -0.78, u1: -0.2, v0: -0.4, v1: 0.4, h0: 3, h1: 13, color: c.body });
      box(ctx, P, { u0: -0.2, u1: 0.78, v0: -0.4, v1: 0.4, h0: 3, h1: 10, color: c.body });
      box(ctx, P, { u0: 0.2, u1: 0.7, v0: -0.06, v1: 0.06, h0: 10, h1: 10.5, color: c.stripe });
      box(ctx, P, { u0: -0.78, u1: -0.3, v0: -0.06, v1: 0.06, h0: 13, h1: 13.5, color: c.stripe });
      box(ctx, P, { u0: 0.74, u1: 0.8, v0: -0.34, v1: -0.18, h0: 6, h1: 9, color: '#fff7c2' });
      box(ctx, P, { u0: 0.74, u1: 0.8, v0: 0.18, v1: 0.34, h0: 6, h1: 9, color: '#fff7c2' });
      box(ctx, P, { u0: -0.8, u1: -0.76, v0: -0.34, v1: -0.2, h0: 8, h1: 11, color: '#ef4444' });
      box(ctx, P, { u0: -0.8, u1: -0.76, v0: 0.2, v1: 0.34, h0: 8, h1: 11, color: '#ef4444' });
      if (c.spoiler) box(ctx, P, { u0: -0.86, u1: -0.7, v0: -0.4, v1: 0.4, h0: 17, h1: 19, color: c.dark });
      box(ctx, P, { u0: 0.12, u1: 0.18, v0: -0.36, v1: 0.36, h0: 10, h1: 22, color: '#bfe3ff', alpha: 0.45 });
      // Riflesso che scorre sulla carrozzeria mentre si guida.
      const glint = P(-0.1 + ((now / 900) % 1) * 0.6, -0.4, 9);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.fillRect(glint.x - 2 * scale, glint.y - scale, 4 * scale, 2 * scale);
    }
  }
  ctx.restore();
}

/** Anteprima del veicolo in un canvas piccolo (negozi e guardaroba). */
export function drawVehiclePreview(canvas, ride, dir = 3) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // Le auto 3D riempiono l'anteprima: sono piu' lunghe dei veicoli disegnati a mano.
  const scale = canvas.width / (CARS[ride] && carModels?.CAR_MODELS.has(ride) ? 70 : 110);
  const foot = { x: canvas.width / 2, y: canvas.height * 0.62 };
  drawVehicle(ctx, ride, foot, dir, scale, 'under');
  drawVehicle(ctx, ride, foot, dir, scale, 'over');
}
