import { describe, expect, test } from 'vitest';
import { IS, ISRunner, simulateIglooStack, type ISInput } from './sim';

/** Test autopilot: drop when the swinging block is (nearly) over the one below. */
function perfectRun(seed: number, bonus = 0): ISInput[] {
  const r = new ISRunner(seed, bonus);
  while (!r.done) r.step(r.swinging && Math.abs(r.x - r.top.center) < 0.05);
  return r.inputs;
}

describe('Igloo Stack', () => {
  test('deterministic', () => {
    const inputs = perfectRun(11);
    expect(simulateIglooStack(11, inputs)).toEqual(simulateIglooStack(11, inputs));
  });

  test('perfect drops keep full width and score 1000', () => {
    const r = simulateIglooStack(11, perfectRun(11));
    expect(r.placed).toBe(IS.BLOCKS);
    expect(r.width).toBeCloseTo(1, 5);
    expect(r.score).toBe(1000);
  });

  test('missing entirely ends the run', () => {
    const r = new ISRunner(3);
    while (!(r.swinging && Math.abs(r.x - r.top.center) > 1.05) && r.tick < 2000) r.step(false); // wait until it is fully off the tower
    r.step(true);
    expect(r.done).toBe(true);
    expect(r.result().placed).toBe(0);
  });

  test('a sloppy drop trims the block', () => {
    const r = new ISRunner(5);
    while (!(r.swinging && Math.abs(r.x - r.top.center) > 0.3 && Math.abs(r.x - r.top.center) < 0.5) && r.tick < 2000) r.step(false);
    r.step(true);
    expect(r.top.width).toBeLessThan(0.75);
    expect(r.top.width).toBeGreaterThan(0.45);
  });

  test('the Strength bonus reduces the swing', () => {
    expect(new ISRunner(1, 4).amplitude).toBeLessThan(new ISRunner(1, 0).amplitude);
  });

  test('score stays within 0..1000; no input times out at 0', () => {
    const none = simulateIglooStack(9, []);
    expect(none.score).toBe(0);
    const s = simulateIglooStack(9, [{ tick: 100 }, { tick: 180 }, { tick: 300 }]).score;
    expect(s).toBeGreaterThanOrEqual(0); expect(s).toBeLessThanOrEqual(1000);
  });
});
