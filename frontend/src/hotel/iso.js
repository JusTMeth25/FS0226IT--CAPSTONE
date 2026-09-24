/**
 * Geometria isometrica dell'hotel, alla risoluzione "base" della pixel art.
 *
 * Tutto il mondo viene disegnato a 1x su un canvas piccolo e poi ingrandito (di solito 2x)
 * senza smussature: cosi' i pixel restano netti come su Habbo. Le misure qui sono in pixel base.
 *
 * Caselle a rombo 2:1: larghe 32, alte 16. Un livello di altezza vale 8 pixel.
 * La casella (x, y) ha il vertice alto in screen = ((x - y) * 16, (x + y) * 8 - z * 8).
 */
export const TILE_W = 32;
export const TILE_H = 16;
export const HALF_W = TILE_W / 2;
export const HALF_H = TILE_H / 2;
export const LEVEL_H = 8;
export const WALL_H = 64;

/** Millisecondi per casella: devono coincidere con il tick del server (RoomRegistry.TICK_MILLIS). */
export const STEP_MS = 500;

/** Vertice alto della casella, relativo all'origine del mondo. */
export function tileTop(x, y, z = 0) {
  return { x: (x - y) * HALF_W, y: (x + y) * HALF_H - z * LEVEL_H };
}

/** Centro della casella: e' il punto dove poggiano i piedi degli avatar. */
export function tileCenter(x, y, z = 0) {
  const top = tileTop(x, y, z);
  return { x: top.x, y: top.y + HALF_H };
}

/**
 * Il punto (px, py) cade dentro il rombo della casella con vertice alto in (tx, ty)?
 * Test esatto al pixel, lo stesso rombo che viene disegnato.
 */
export function insideDiamond(px, py, tx, ty) {
  const dy = py - ty;
  if (dy < 0 || dy >= TILE_H) return false;
  const row = dy < HALF_H ? dy : TILE_H - 1 - dy;
  const half = 2 * (row + 1);
  return px >= tx - half && px < tx + half;
}

/** Direzioni come sul server: 0 nord (y-1), 2 est (x+1), 4 sud (y+1), 6 ovest (x-1). */
const DIRECTION_DELTAS = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];

export function directionBetween(fromX, fromY, toX, toY, fallback = 2) {
  const dx = Math.sign(toX - fromX);
  const dy = Math.sign(toY - fromY);
  const index = DIRECTION_DELTAS.findIndex(([ddx, ddy]) => ddx === dx && ddy === dy);
  return index === -1 ? fallback : index;
}

/**
 * Da direzione nel mondo a vista dello sprite. Gli sprite sono disegnati girati verso destra,
 * di fronte o di spalle; la sinistra si ottiene specchiandoli.
 */
const VIEWS = [
  { back: true, flip: false },  // 0 nord: verso l'alto a destra
  { back: false, flip: false }, // 1 nord-est: verso destra
  { back: false, flip: false }, // 2 est: verso il basso a destra
  { back: false, flip: false }, // 3 sud-est: verso il basso
  { back: false, flip: true },  // 4 sud: verso il basso a sinistra
  { back: false, flip: true },  // 5 sud-ovest: verso sinistra
  { back: true, flip: true },   // 6 ovest: verso l'alto a sinistra
  { back: true, flip: true }    // 7 nord-ovest: verso l'alto
];

export function viewForDirection(dir) {
  return VIEWS[((dir % 8) + 8) % 8];
}

/** Legge la mappa delle altezze come la scrive il server (rooms.layout). */
export function parseLayout(layout) {
  const rows = layout.replace(/\r/g, '').split('\n');
  const width = Math.max(...rows.map((r) => r.length));
  const heights = rows.map((row) => Array.from({ length: width }, (_, x) => {
    const c = row[x];
    return c !== undefined && c >= '0' && c <= '9' ? Number(c) : -1;
  }));
  return {
    width,
    height: rows.length,
    heightAt: (x, y) => (y >= 0 && y < rows.length && x >= 0 && x < width ? heights[y][x] : -1),
    isTile(x, y) {
      return this.heightAt(x, y) >= 0;
    }
  };
}
