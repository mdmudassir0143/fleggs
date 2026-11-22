import { expect, test } from 'vitest';
import { KIW, KIWRunner, simulateKeepItWarm, type KIWInput } from './sim';

test('stepping the runner live gives the same result and log as the replay', () => {
  const pattern = (t: number) => Math.floor(t / 37) % 2 === 0;
  const r = new KIWRunner(99);
  while (!r.done) r.step(pattern(r.tick));
  const replay = simulateKeepItWarm(99, r.inputs);
  expect(r.result()).toEqual({ score: replay.score, cracked: replay.cracked, endTick: replay.endTick });
  expect(r.inputs.every((i: KIWInput, k: number) => k === 0 || i.tick > r.inputs[k - 1].tick)).toBe(true);
});

test('runner records only button changes', () => {
  const r = new KIWRunner(1);
  r.step(true); r.step(true); r.step(false);
  expect(r.inputs).toEqual([{ tick: 0, down: true }, { tick: 2, down: false }]);
});

test('runner stops at the game length', () => {
  const r = new KIWRunner(1);
  for (let i = 0; i < KIW.TICKS + 50; i++) r.step(false);
  expect(r.tick).toBe(KIW.TICKS);
  expect(r.done).toBe(true);
});
