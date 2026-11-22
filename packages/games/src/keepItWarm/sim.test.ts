import { describe, expect, test } from 'vitest';
import { KIW, simulateKeepItWarm, type KIWInput } from './sim';
import { mulberry32 } from '../rng';

/** Toggle the button every `period` ticks, starting held. */
function toggles(period: number, until = KIW.TICKS): KIWInput[] {
  const out: KIWInput[] = [];
  for (let t = 0, down = true; t < until; t += period, down = !down) out.push({ tick: t, down });
  return out;
}

function randomLog(seed: number): KIWInput[] {
  const r = mulberry32(seed);
  const out: KIWInput[] = [];
  let t = 0, down = false;
  while (true) {
    t += 1 + Math.floor(r() * 90);
    if (t >= KIW.TICKS) break;
    down = !down;
    out.push({ tick: t, down });
  }
  return out;
}

describe('Keep It Warm sim', () => {
  test('same seed + inputs → same score', () => {
    const a = simulateKeepItWarm(42, toggles(30));
    const b = simulateKeepItWarm(42, toggles(30));
    expect(a).toEqual(b);
  });

  test('no input never cracks and scores < 400', () => {
    const r = simulateKeepItWarm(1, []);
    expect(r.cracked).toBe(false);
    expect(r.endTick).toBe(KIW.TICKS);
    expect(r.score).toBeLessThan(400);
  });

  test('holding forever cracks before tick 2700', () => {
    const r = simulateKeepItWarm(1, [{ tick: 0, down: true }]);
    expect(r.cracked).toBe(true);
    expect(r.endTick).toBeLessThan(KIW.TICKS);
  });

  test('score never exceeds 1000', () => {
    for (let s = 0; s < 200; s++) {
      const r = simulateKeepItWarm(s, randomLog(s + 1000));
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(KIW.MAX_SCORE);
    }
  });

  test('warmth 2 scores ≥ warmth 0 for the same inputs', () => {
    for (let s = 0; s < 50; s++) {
      const log = randomLog(s);
      expect(simulateKeepItWarm(s, log, 2).score).toBeGreaterThanOrEqual(simulateKeepItWarm(s, log, 0).score);
    }
  });

  test('a good player can reach tier 2 (≥ 700)', () => {
    // Greedy bot: hold when heat is below the zone center, release above.
    const seed = 7;
    const frames = simulateKeepItWarm(seed, [], 0, { record: true }).frames!;
    const log: KIWInput[] = [];
    let heat = 0.3, down = false;
    for (let t = 0; t < KIW.TICKS; t++) {
      const want = heat < frames[t].zoneCenter;
      if (want !== down) { down = want; log.push({ tick: t, down }); }
      heat = Math.min(1, Math.max(0, heat + (down ? 0.55 : -0.35) / 60));
    }
    expect(simulateKeepItWarm(seed, log).score).toBeGreaterThanOrEqual(700);
  });

  test('record mode returns one frame per simulated tick', () => {
    const r = simulateKeepItWarm(3, toggles(40), 0, { record: true });
    expect(r.frames!.length).toBe(r.endTick);
  });
});
