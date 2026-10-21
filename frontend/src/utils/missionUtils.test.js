import { afterEach, describe, expect, it, vi } from 'vitest';
import { todayString } from './missionUtils.js';

describe('missionUtils: todayString', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('stesso giorno a ore diverse: stessa stringa', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 21, 0, 5));
    const morning = todayString();
    vi.setSystemTime(new Date(2026, 9, 21, 23, 55));
    expect(todayString()).toBe(morning);
    expect(morning).toBe(new Date(2026, 9, 21).toDateString());
  });

  it('il giorno dopo cambia anche se sono passati pochi minuti', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 21, 23, 59));
    const before = todayString();
    vi.setSystemTime(new Date(2026, 9, 22, 0, 1));
    expect(todayString()).not.toBe(before);
  });
});
