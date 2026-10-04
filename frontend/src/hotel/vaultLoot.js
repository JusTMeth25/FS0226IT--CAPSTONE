/**
 * Tesoro del Caveau che cresce con gli incassi da riscuotere: monete, banconote e gemme sparse
 * per terra, cumuli d'oro sempre piu' alti e pile di lingotti. Solo grafica (non blocca il
 * cammino): piu' la cassa del banco e' piena, piu' il pavimento si riempie; riscuotendo si svuota.
 */

export const VAULT_ID = '00000000-0000-0000-0000-00000000a023';

/** Regole dei "mobili finti" del tesoro, come DECOR_DEFS delle decorazioni di stagione. */
export const LOOT_DEFS = {
  loot_coins: { width: 1, length: 1, wall: false, walkable: true, sitDir: -1 },
  loot_cash: { width: 1, length: 1, wall: false, walkable: true, sitDir: -1 },
  loot_gems: { width: 1, length: 1, wall: false, walkable: true, sitDir: -1 },
  loot_heap_s: { width: 1, length: 1, wall: false, walkable: false, sitDir: -1 },
  loot_heap_m: { width: 1, length: 1, wall: false, walkable: false, sitDir: -1 },
  loot_heap_l: { width: 1, length: 1, wall: false, walkable: false, sitDir: -1 },
  loot_bars: { width: 1, length: 1, wall: false, walkable: false, sitDir: -1 }
};

function noise(a, b, c = 0) {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * Quanto e' pieno il Caveau, da 0 a 1, dagli incassi (fiches + gold): 100 = un po' di monete,
 * 1.000 = mezzo pavimento, 10.000 = quasi tutto, da 30.000 in su strapieno.
 */
export function fillLevel(total) {
  if (!(total > 0)) return 0;
  return Math.min(1, Math.log10(1 + total / 60) / Math.log10(1 + 30_000 / 60));
}

/**
 * Le caselle del tesoro, sempre le stesse per lo stesso livello (crescendo se ne aggiungono, non
 * si rimescolano). Resta libero il corridoio dalla porta alla cassaforte.
 */
export function vaultLoot(layout, items, footprintOf, door, total) {
  const level = fillLevel(total);
  if (!layout || level <= 0) return [];
  const taken = new Set();
  let safe = null;
  items.forEach((item) => {
    const { fx, fy } = footprintOf(item);
    if (item.type === 'vault_safe') safe = { x: item.x, y: item.y, fx };
    for (let dx = 0; dx < fx; dx += 1) for (let dy = 0; dy < fy; dy += 1) taken.add(`${item.x + dx},${item.y + dy}`);
  });
  const corridor = (x, y) => {
    if (door && Math.abs(y - door.y) <= 1 && x <= (safe ? safe.x + safe.fx : 10)) return true;
    if (safe && x >= safe.x - 1 && x <= safe.x + safe.fx && y <= (door ? door.y : 9)) return true;
    return door && Math.max(Math.abs(x - door.x), Math.abs(y - door.y)) <= 1;
  };
  const out = [];
  for (let y = 0; y < layout.height; y += 1) {
    for (let x = 0; x < layout.width; x += 1) {
      if (!layout.isTile(x, y) || taken.has(`${x},${y}`)) continue;
      const k = noise(x, y, 23);
      // Le caselle si riempiono in ordine fisso (k): con piu' incassi entrano quelle con k piu' alto.
      if (k > level) continue;
      const z = Math.max(0, layout.heightAt(x, y));
      const wall = !layout.isTile(x - 1, y) || !layout.isTile(x, y - 1);
      const pick = noise(x, y, 91);
      let type;
      if (corridor(x, y)) {
        // Nel corridoio solo roba bassa, che si calpesta.
        type = pick < 0.5 ? 'loot_coins' : pick < 0.8 ? 'loot_cash' : 'loot_gems';
      } else {
        // Piu' e' pieno, piu' i cumuli sono alti; lungo i muri le pile di lingotti.
        const rich = k / Math.max(level, 0.001);
        if (wall && level > 0.35 && pick < 0.45) type = 'loot_bars';
        else if (level > 0.75 && rich < 0.45) type = 'loot_heap_l';
        else if (level > 0.45 && rich < 0.6) type = 'loot_heap_m';
        else if (level > 0.2 && rich < 0.75) type = 'loot_heap_s';
        else type = pick < 0.5 ? 'loot_coins' : pick < 0.8 ? 'loot_cash' : 'loot_gems';
      }
      out.push({ id: `loot-${x}-${y}`, type, x, y, z, rot: 0 });
    }
  }
  return out;
}
