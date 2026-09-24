/** Strumenti comuni per disegnare pixel art su canvas, senza anti-aliasing. */

/**
 * Canvas di lavoro. Con `readable` resta in memoria invece che sulla scheda video: leggerne i
 * pixel (contorni, maschere) e' immediato, mentre da un canvas in GPU costa decine di ms.
 */
export function createCanvas(width, height, { readable = false } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', readable ? { willReadFrequently: true } : undefined);
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

/**
 * Chiude uno sprite disegnato su un canvas `readable`: ne salva la maschera dei pixel pieni
 * (per i clic al pixel, senza piu' leggere il canvas) e lo copia in un canvas normale, che il
 * browser tiene sulla scheda video e disegna in fretta a ogni fotogramma.
 */
export function bake(source) {
  const { width, height } = source;
  let alpha;
  try {
    alpha = source.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, width, height).data;
  } catch {
    // Canvas "sporcato" da un'immagine di un altro dominio: niente maschera, si usa cosi'.
    return source;
  }
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i += 1) mask[i] = alpha[i * 4 + 3] > 0 ? 1 : 0;
  const { canvas, ctx } = createCanvas(width, height);
  ctx.drawImage(source, 0, 0);
  canvas.mask = mask;
  return canvas;
}

/** Il pixel (x, y) dello sprite e' pieno? Usa la maschera salvata da bake quando c'e'. */
export function isSolid(sprite, x, y) {
  if (x < 0 || y < 0 || x >= sprite.width || y >= sprite.height) return false;
  if (sprite.mask) return sprite.mask[y * sprite.width + x] === 1;
  try {
    return sprite.getContext('2d').getImageData(x, y, 1, 1).data[3] > 0;
  } catch {
    return true;
  }
}

export function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

/** Schiarisce (amount > 0) o scurisce (amount < 0) un colore esadecimale. */
export function shade(hex, amount) {
  const value = parseInt(hex.slice(1), 16);
  const channel = (shift) => {
    const c = (value >> shift) & 0xff;
    const next = amount >= 0 ? c + (255 - c) * amount : c * (1 + amount);
    return Math.max(0, Math.min(255, Math.round(next)));
  };
  return `#${((channel(16) << 16) | (channel(8) << 8) | channel(0)).toString(16).padStart(6, '0')}`;
}

/** Copia specchiata orizzontalmente: gli sprite rivolti a sinistra. */
export function mirror(source) {
  const { canvas, ctx } = createCanvas(source.width, source.height);
  ctx.translate(source.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(source, 0, 0);
  if (source.mask) {
    const { width, height } = source;
    const mask = new Uint8Array(width * height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) mask[y * width + x] = source.mask[y * width + (width - 1 - x)];
    }
    canvas.mask = mask;
  }
  return canvas;
}
