import { describe, expect, test } from 'vitest';
import { ID, IDRunner, simulateIcicleDash, type IDInput } from './sim';

/** A test autopilot that always heads for the free lane of the next wave. */
function perfectRun(seed: number, bonus = 0): IDInput[] {
  const r = new IDRunner(seed, bonus);
  while (!r.done) {
    const wave = r.nextWave();
    let dir: -1 | 0 | 1 = 0;
    if (wave && !r.moving) {
      const target = wave.free.reduce((b, l) => (Math.abs(l - r.lane) < Math.abs(b - r.lane) ? l : b), wave.free[0]);
      dir = target > r.lane ? 1 : target < r.lane ? -1 : 0;
    }
    r.step(dir);
  }
  return r.inputs;
}

describe('Icicle Dash', () => {
  test('same seed + inputs → same score', () => {
    const inputs = perfectRun(42);
    expect(simulateIcicleDash(42, inputs).score).toBe(simulateIcicleDash(42, inputs).score);
  });

  test('no input dies early with a low score', () => {
    const r = simulateIcicleDash(7, []);
    expect(r.endTick).toBeLessThan(ID.TICKS);
    expect(r.score).toBeLessThan(400);
  });

  test('a perfect dodge script scores at least 900', () => {
    for (const seed of [1, 7, 42, 1234, 99991]) expect(simulateIcicleDash(seed, perfectRun(seed)).score).toBeGreaterThanOrEqual(900);
  });

  test('bonus shortens the lane change', () => {
    expect(new IDRunner(1, 0).changeTicks).toBeGreaterThan(new IDRunner(1, 4).changeTicks);
    expect(new IDRunner(1, 99).changeTicks).toBeGreaterThanOrEqual(4);
  });

  test('score stays within 0..1000', () => {
    for (const seed of [3, 5, 8]) {
      const s = simulateIcicleDash(seed, [{ tick: 10, dir: 1 }, { tick: 400, dir: -1 }, { tick: 900, dir: -1 }]).score;
      expect(s).toBeGreaterThanOrEqual(0); expect(s).toBeLessThanOrEqual(1000);
    }
  });
});
