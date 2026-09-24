import { createCanvas, px, shade } from './pixel.js';
import { getRarityColor } from '../../utils/cardUtils.js';

/**
 * Gemma del distintivo "carta migliore": un rombo sfaccettato del colore della rarita',
 * disegnato a 9x9 pixel base con il contorno scuro, come le icone di Habbo.
 */
const SHAPE = [
  '..###..',
  '.#####.',
  '#######',
  '.#####.',
  '..###..',
  '...#...'
];

export const GEM_W = 9;
export const GEM_H = 8;

const cache = new Map();

export function gemSprite(rarity) {
  let sprite = cache.get(rarity);
  if (sprite) return sprite;
  const base = getRarityColor(rarity);
  const { canvas, ctx } = createCanvas(GEM_W, GEM_H);
  const cells = [];
  SHAPE.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') cells.push([x + 1, y + 1]); }));
  // Contorno: ogni cella allargata di un pixel in tutte le direzioni, sotto la gemma.
  cells.forEach(([x, y]) => px(ctx, x - 1, y - 1, 3, 3, '#0a0716'));
  cells.forEach(([x, y]) => {
    // Faccette: sopra e a sinistra la luce, sotto e a destra l'ombra.
    let color = base;
    if (y <= 2) color = shade(base, 0.35);
    else if (y >= 4) color = shade(base, -0.35);
    else if (x >= 5) color = shade(base, -0.15);
    px(ctx, x, y, 1, 1, color);
  });
  px(ctx, 3, 2, 1, 1, '#ffffff');
  px(ctx, 2, 3, 1, 1, shade(base, 0.6));
  sprite = canvas;
  cache.set(rarity, sprite);
  return sprite;
}

/** Scintilla a quattro punte per le leggendarie. */
export function drawSparkle(ctx, x, y, scale, color = '#ffffff') {
  ctx.fillStyle = color;
  ctx.fillRect(x - scale, y, 3 * scale, scale);
  ctx.fillRect(x, y - scale, scale, 3 * scale);
}
