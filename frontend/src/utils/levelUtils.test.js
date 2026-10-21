import { describe, expect, it } from 'vitest';
import { calcLevel, getLevelRewards } from './levelUtils.js';

/** XP totali per arrivare al livello indicato (formula: lv * 100 + (lv - 1) * 50 per livello). */
const xpTo = (level) => {
  let total = 0;
  for (let lv = 1; lv < level; lv++) total += lv * 100 + (lv - 1) * 50;
  return total;
};

describe('levelUtils: calcLevel', () => {
  it('zero XP: livello 1, servono 100 XP', () => {
    expect(calcLevel(0)).toEqual({ level: 1, xpRemaining: 0, xpForNext: 100 });
  });

  it('appena sotto la soglia si resta al livello 1', () => {
    expect(calcLevel(99)).toEqual({ level: 1, xpRemaining: 99, xpForNext: 100 });
  });

  it('alla soglia esatta si sale e il resto riparte da zero', () => {
    expect(calcLevel(100)).toEqual({ level: 2, xpRemaining: 0, xpForNext: 250 });
    expect(calcLevel(xpTo(10) + 42)).toEqual({ level: 10, xpRemaining: 42, xpForNext: 10 * 100 + 9 * 50 });
  });

  it('oltre l\'ultimo livello: 51 e la soglia resta quella del 50', () => {
    expect(xpTo(51)).toBe(188750);
    expect(calcLevel(188750)).toEqual({ level: 51, xpRemaining: 0, xpForNext: 7450 });
    expect(calcLevel(10_000_000).level).toBe(51);
  });
});

describe('levelUtils: getLevelRewards', () => {
  it.each([
    [1, 5, null],
    [3, 15, null],
    [4, 40, null],
    [5, 125, 'pack-deluxe'],
    [10, 250, 'pack-premium'],
    [15, 375, null],
    [25, 625, 'pack-premium'],
    [50, 1250, 'pack-premium']
  ])('livello %i: %i gold, pacchetto %s', (lv, gold, pack) => {
    expect(getLevelRewards(lv)).toEqual({ gold, pack });
  });
});
