import { describe, expect, test } from 'vitest';
import { LB, LBRunner, chartFor, simulateLofiBeats, type LBInput } from './sim';

const perfect = (seed: number, offset = 0): LBInput[] => chartFor(seed).map((n) => ({ tick: n.tick + offset, lane: n.lane }));

describe('Lofi Beats', () => {
  test('the chart is deterministic per seed and differs between seeds', () => {
    expect(chartFor(5)).toEqual(chartFor(5));
    expect(chartFor(5)).not.toEqual(chartFor(6));
    expect(chartFor(5).length).toBeGreaterThan(40);
  });

  test('perfect taps score at least 950', () => {
    for (const seed of [1, 9, 77]) expect(simulateLofiBeats(seed, perfect(seed)).score).toBeGreaterThanOrEqual(950);
  });

  test('no taps score 0', () => expect(simulateLofiBeats(3, []).score).toBe(0));

  test('the Power bonus widens the perfect window', () => {
    const late = perfect(4, 4);
    expect(simulateLofiBeats(4, late, 2).perfect).toBeGreaterThan(simulateLofiBeats(4, late, 0).perfect);
  });

  test('taps between notes are misses, not crashes', () => {
    const r = simulateLofiBeats(8, Array.from({ length: 200 }, (_, i) => ({ tick: i * 11 + 5, lane: i % 3 })));
    expect(r.score).toBeGreaterThanOrEqual(0); expect(r.score).toBeLessThanOrEqual(1000);
    expect(new LBRunner(8).notes.length).toBe(chartFor(8).length);
    expect(LB.TICKS).toBe(2400);
  });
});
