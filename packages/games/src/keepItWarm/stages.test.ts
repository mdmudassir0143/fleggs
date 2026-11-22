import { describe, expect, test } from 'vitest';
import { KIW, KIWRunner, KIW_STAGES, simulateKeepItWarm, type KIWInput } from './sim';

/** A human-ish player: reacts to what it saw `lag` ticks ago, with a little hesitation. */
function play(seed: number, stage: 0 | 1 | 2, lag = 12): { log: KIWInput[]; score: number } {
  const r = new KIWRunner(seed, 0, stage);
  const seen: boolean[] = [];
  let f = r.step(false);
  while (f) {
    seen.push(f.heat < f.zoneCenter);
    const want = seen[Math.max(0, seen.length - 1 - lag)];
    f = r.step(want);
  }
  return { log: r.inputs, score: r.result().score };
}

describe('Keep It Warm stages', () => {
  test('stage 0 replays exactly like before stages existed', () => {
    for (let s = 1; s <= 20; s++) {
      const { log } = play(s, 0);
      const old = simulateKeepItWarm(s, log, 0, { record: true });
      const staged = simulateKeepItWarm(s, log, 0, { record: true, stage: 0 });
      expect(staged.score).toBe(old.score);
      expect(staged.frames!.map((x) => x.zoneCenter)).toEqual(old.frames!.map((x) => x.zoneCenter));
    }
  });

  test('every stage has a name and a one-line rule', () => {
    expect(KIW_STAGES.map((s) => s.name)).toEqual(['First warmth', 'Wind gusts', 'Blizzard']);
    for (const s of KIW_STAGES) expect(s.rule.length).toBeGreaterThan(10);
  });

  test('stage 1 gusts are seeded, warned 60 ticks ahead, last 90 ticks, and cool the egg faster', () => {
    const a = simulateKeepItWarm(5, [], 0, { record: true, stage: 1 }).frames!;
    const b = simulateKeepItWarm(5, [], 0, { record: true, stage: 1 }).frames!;
    expect(a.map((f) => f.gust)).toEqual(b.map((f) => f.gust));
    const starts = a.map((f, i) => (f.gust === 'on' && a[i - 1]?.gust !== 'on' ? i : -1)).filter((i) => i >= 0);
    expect(starts.length).toBeGreaterThanOrEqual(3);
    for (const s of starts) {
      for (let k = 1; k <= 60; k++) expect(a[s - k].gust).toBe('warn');
      for (let k = 0; k < 90; k++) expect(a[s + k].gust).toBe('on');
    }
    // From the same heat, letting go cools faster while a gust blows than in calm air.
    const dropAt = (tick: number) => {
      const r = new KIWRunner(5, 0, 1);
      while (r.tick < tick) r.step(false);
      r.heat = 0.5; r.step(false);
      return 0.5 - r.heat;
    };
    const calm = a.findIndex((f, i) => i > 10 && f.gust === null);
    expect(dropAt(starts[0] + 10)).toBeGreaterThan(dropAt(calm) + 0.005);
  });

  test('gusts never fire on stage 0 or 2', () => {
    for (const st of [0, 2] as const) expect(simulateKeepItWarm(9, [], 0, { record: true, stage: st }).frames!.every((f) => f.gust === null)).toBe(true);
  });

  test('stage 2 combo builds in the zone, resets outside, caps at 1.5, score stays ≤ 1000', () => {
    const fr = simulateKeepItWarm(3, play(3, 2).log, 0, { record: true, stage: 2 }).frames!;
    expect(Math.max(...fr.map((f) => f.combo))).toBeLessThanOrEqual(1.5);
    expect(Math.max(...fr.map((f) => f.combo))).toBeGreaterThan(1.2);
    const out = fr.findIndex((f, i) => i > 0 && !f.inZone && fr[i - 1].combo > 1.05);
    expect(fr[out].combo).toBe(1);
    expect(simulateKeepItWarm(3, play(3, 2, 0).log, 0, { stage: 2 }).score).toBeLessThanOrEqual(KIW.MAX_SCORE);
    expect(simulateKeepItWarm(3, [], 0, { record: true, stage: 0 }).frames!.every((f) => f.combo === 1)).toBe(true);
  });

  test.each([6, 12, 24])('balance: a player reacting %i ticks late scores about the same on every stage (±10%)', (lag) => {
    const mean = (st: 0 | 1 | 2) => { let t = 0; for (let s = 1; s <= 60; s++) t += play(s, st, lag).score; return t / 60; };
    const m0 = mean(0), m1 = mean(1), m2 = mean(2);
    expect(Math.abs(m1 - m0) / m0).toBeLessThanOrEqual(0.1);
    expect(Math.abs(m2 - m0) / m0).toBeLessThanOrEqual(0.1);
  });
});

test('an egg stage lasts 30 seconds', () => {
  expect(KIW.TICKS).toBe(1800);
  expect(simulateKeepItWarm(1, [], 0, { stage: 1 }).endTick).toBe(1800);
});

test('the live score only grows and ends at the final score, on every stage', () => {
  for (const st of [0, 1, 2] as const) {
    const r = new KIWRunner(4, 0, st);
    let last = 0, f = r.step(false), i = 0;
    while (f) { const s = r.liveScore(); expect(s).toBeGreaterThanOrEqual(last); last = s; f = r.step(i++ % 50 < 22); }
    expect(r.liveScore()).toBe(r.result().score);
  }
});
