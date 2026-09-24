import { HALF_H, HALF_W, LEVEL_H, TILE_H, TILE_W, WALL_H, tileTop } from '../iso.js';
import { createCanvas, px, shade } from './pixel.js';

/**
 * Pavimento e pareti di una stanza, disegnati una volta in un'immagine sola.
 *
 * Non cambiano mentre si gioca: rigenerarli a ogni fotogramma sarebbe lavoro sprecato. Il
 * renderer copia questa immagine e ci disegna sopra avatar e mobili.
 */
const STYLES = {
  neon: {
    floor: '#262a4d', floorAlt: '#2b3056', edge: '#3d4380', side: '#171a33',
    wallLeft: '#2a1f55', wallRight: '#1f173f', wallTop: '#8b5cf6', trim: '#ec4899'
  },
  arena: {
    floor: '#3a2330', floorAlt: '#432838', edge: '#6b3a52', side: '#20121b',
    wallLeft: '#3b1d2c', wallRight: '#2a1420', wallTop: '#ffd700', trim: '#ff6b35'
  }
};

export function roomStyle(name) {
  return STYLES[name] || STYLES.neon;
}

/** Rombo di una casella, riga per riga: bordi a scalini di 2 pixel come la pixel art iso. */
function diamond(ctx, tx, ty, fill, edge) {
  for (let row = 0; row < TILE_H; row += 1) {
    const r = row < HALF_H ? row : TILE_H - 1 - row;
    const half = 2 * (r + 1);
    px(ctx, tx - half, ty + row, half * 2, 1, fill);
    if (edge) {
      px(ctx, tx - half, ty + row, 2, 1, edge);
      if (row < HALF_H) px(ctx, tx + half - 2, ty + row, 2, 1, shade(edge, -0.15));
    }
  }
}

/** Faccia laterale di una casella rialzata: sinistra (verso +y) o destra (verso +x). */
function sideFace(ctx, tx, ty, depth, color, left) {
  for (let c = 0; c < HALF_W; c += 1) {
    const x = left ? tx - HALF_W + c : tx + c;
    const yTop = left ? ty + HALF_H + Math.floor(c / 2) : ty + TILE_H - 1 - Math.floor(c / 2);
    px(ctx, x, yTop, 1, depth, color);
  }
}

/**
 * Parete lungo il lato sinistro (-x) o destro (-y) di una casella.
 * La base segue il pavimento, la cima e' alla stessa quota per tutte le pareti.
 */
function wall(ctx, tx, ty, z, style, left) {
  // La base e' gia' alzata di z livelli: la parete si accorcia di altrettanto, cosi' la cima
  // resta alla stessa quota anche sopra il palco.
  const top = WALL_H - z * LEVEL_H;
  for (let c = 0; c < HALF_W; c += 1) {
    const x = left ? tx - HALF_W + c : tx + c;
    const baseY = left ? ty + HALF_H - Math.floor(c / 2) : ty + Math.floor(c / 2);
    px(ctx, x, baseY - top, 1, top, left ? style.wallLeft : style.wallRight);
    px(ctx, x, baseY - top, 1, 2, style.wallTop);
    px(ctx, x, baseY - 5, 1, 1, style.trim);
  }
}

/**
 * @returns {{ canvas, originX, originY }} immagine della stanza e posizione, al suo interno,
 * del vertice alto della casella (0, 0).
 */
export function renderRoom(layout, styleName, door) {
  const style = roomStyle(styleName);
  const isDoor = (x, y) => door && door.x === x && door.y === y;

  // Ingombro in pixel base, pareti e dislivelli compresi.
  let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
  for (let y = 0; y < layout.height; y += 1) {
    for (let x = 0; x < layout.width; x += 1) {
      const z = layout.heightAt(x, y);
      if (z < 0) continue;
      const t = tileTop(x, y, z);
      minX = Math.min(minX, t.x - HALF_W);
      maxX = Math.max(maxX, t.x + HALF_W);
      minY = Math.min(minY, t.y + z * LEVEL_H - WALL_H);
      maxY = Math.max(maxY, t.y + TILE_H + z * LEVEL_H);
    }
  }
  const originX = -minX + 2;
  const originY = -minY + 2;
  const { canvas, ctx } = createCanvas(Math.ceil(maxX - minX) + 4, Math.ceil(maxY - minY) + 4);

  // Pareti: dietro a tutto, lungo i lati che confinano con il vuoto. La porta resta aperta.
  for (let y = 0; y < layout.height; y += 1) {
    for (let x = 0; x < layout.width; x += 1) {
      const z = layout.heightAt(x, y);
      if (z < 0 || isDoor(x, y)) continue;
      const t = tileTop(x, y, z);
      if (!layout.isTile(x - 1, y) && !isDoor(x - 1, y)) wall(ctx, originX + t.x, originY + t.y, z, style, true);
      if (!layout.isTile(x, y - 1) && !isDoor(x, y - 1)) wall(ctx, originX + t.x, originY + t.y, z, style, false);
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
    const leftDrop = z - below(x, y + 1);
    const rightDrop = z - below(x + 1, y);
    if (leftDrop > 0) sideFace(ctx, tx, ty, leftDrop * LEVEL_H, shade(style.side, 0.1), true);
    if (rightDrop > 0) sideFace(ctx, tx, ty, rightDrop * LEVEL_H, style.side, false);

    const alt = (x + y) % 2 === 0;
    diamond(ctx, tx, ty, isDoor(x, y) ? '#0c0a1a' : (alt ? style.floor : style.floorAlt), style.edge);
  });

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
