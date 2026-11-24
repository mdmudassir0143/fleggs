import { describe, expect, test } from 'vitest';
import { GAME } from '@flurry/shared';
import { gameTiles, traitRows, trainingStatus } from './train';

const yeti = (o: Partial<{ level: number; points: number[]; training: { slot: number; readyAt: number } | null }> = {}) => ({
  id: '0x1', level: 1, elements: [1], variants: [9, 6, 3], name: 'Moss', cardUrl: '', named: true,
  points: [1, 2, 0], training: null, ...o,
});

describe('train screen logic', () => {
  test('each tile shows the yeti bonus for that game', () => {
    const tiles = gameTiles(yeti());
    expect(tiles.map((t) => t.game)).toEqual([GAME.KeepItWarm, GAME.IcicleDash, GAME.LofiBeats, GAME.IglooStack]);
    expect(tiles.map((t) => t.bonus)).toEqual([1, 2, 0, 0]);
    expect(tiles[3].note).toMatch(/level 2/i); // L1 has no Strength slot yet
  });

  test('Train +1 is disabled at cap with a reason', () => {
    const rows = traitRows(yeti({ points: [2, 0, 0] }), 1000, 0);
    expect(rows[0].canTrain).toBe(false);
    expect(rows[0].reason).toMatch(/max/i);
    expect(rows[1].canTrain).toBe(true);
    expect(rows[1].cost).toBe(25);
  });

  test('disabled while another slot trains, and when Snowflakes are short', () => {
    const busy = traitRows(yeti({ training: { slot: 2, readyAt: 10_000 } }), 1000, 0);
    expect(busy[0].canTrain).toBe(false);
    expect(busy[0].reason).toMatch(/training/i);
    const poor = traitRows(yeti({ points: [1, 0, 0] }), 30, 0);
    expect(poor[0].canTrain).toBe(false); // next point costs 50
    expect(poor[0].reason).toMatch(/snowflakes/i);
  });

  test('the countdown uses the chain ready time and the clock offset', () => {
    const s = trainingStatus(yeti({ training: { slot: 1, readyAt: 100_000 } }), 40_000, 2_000);
    expect(s?.remainingMs).toBe(58_000); // chain time = local 40 000 + offset 2 000
    expect(s?.ready).toBe(false);
  });

  test('finish is enabled only when ready', () => {
    expect(trainingStatus(yeti({ training: { slot: 1, readyAt: 100_000 } }), 99_999, 0)?.ready).toBe(false);
    expect(trainingStatus(yeti({ training: { slot: 1, readyAt: 100_000 } }), 100_000, 0)?.ready).toBe(true);
    expect(trainingStatus(yeti(), 0, 0)).toBeNull();
  });
});

import { mergeReadiness } from './train';

describe('merge readiness (every trait must be maxed)', () => {
  test('ready only when every trait is at the level cap', () => {
    expect(mergeReadiness(yeti({ points: [2, 2, 2] }))).toEqual({ ready: true, trainingsLeft: 0 });
    expect(mergeReadiness(yeti({ points: [2, 1, 0] }))).toEqual({ ready: false, trainingsLeft: 3 });
  });
  test('a yeti still training is not ready', () => {
    expect(mergeReadiness(yeti({ points: [2, 2, 2], training: { slot: 0, readyAt: 1 } })).ready).toBe(false);
  });
});

import { playLabel } from './train';
describe('plays left on the Train tiles', () => {
  test('free first, then bought plays, then a price', () => {
    expect(playLabel({ free: 2, credits: 0, total: 2 }, 20_000_000n)).toEqual({ text: '2 free plays left', paid: false });
    expect(playLabel({ free: 2, credits: 1, total: 3 }, 20_000_000n)).toEqual({ text: '2 free + 1 bought', paid: false });
    expect(playLabel({ free: 1, credits: 3, total: 4 }, 20_000_000n)).toEqual({ text: '1 free + 3 bought', paid: false });
    expect(playLabel({ free: 0, credits: 1, total: 1 }, 20_000_000n)).toEqual({ text: '1 bought play', paid: false });
    expect(playLabel({ free: 0, credits: 0, total: 0 }, 20_000_000n)).toEqual({ text: 'Play · 0.02 SUI', paid: true });
  });
});

import { yetiStatus } from './train';
describe('yeti status on the Train list', () => {
  const base = { id: 'y', level: 1, elements: [0], variants: [1, 2, 3], name: 'Moss', cardUrl: '', named: true };
  test('training shows the trait and time left; then merge readiness', () => {
    expect(yetiStatus({ ...base, points: [1, 2, 0], training: { slot: 2, readyAt: 95_000 } } as never, 0, 0)).toEqual({ text: 'Power · 1m 35s', tone: 'busy' });
    expect(yetiStatus({ ...base, points: [1, 2, 0], training: { slot: 2, readyAt: 0 } } as never, 10, 0)).toEqual({ text: 'Power is ready', tone: 'ready' });
    expect(yetiStatus({ ...base, points: [2, 2, 2], training: null } as never, 0, 0)).toEqual({ text: 'Ready to merge', tone: 'merge' });
    expect(yetiStatus({ ...base, points: [1, 2, 0], training: null } as never, 0, 0)).toEqual({ text: '3 trainings to merge', tone: 'idle' });
    expect(yetiStatus({ ...base, points: [2, 2, 1], training: null } as never, 0, 0)).toEqual({ text: '1 training to merge', tone: 'idle' });
  });
});

import { bandName } from './train';
test('trait tier names, as on the yeti card', () => {
  expect(['common', 'fine', 'rare', 'mutant'].map(bandName)).toEqual(['Common', 'Fine', 'Rare', 'Mutant']);
});

import { mergeProgress, traitAction, shortDuration } from './train';
describe('trait card actions', () => {
  const row = (o: object) => ({ slot: 0, label: 'Fur', stat: 'Warmth', band: 'rare', points: 3, cap: 4, cost: 100, ms: 480_000, canTrain: true, reason: null, now: 0, ...o });
  test('says exactly what happens, or why not', () => {
    expect(traitAction(row({}) as never, null, 'Power')).toEqual({ kind: 'train', label: 'Train +1', meta: '100 Snowflakes · 8 min' });
    expect(traitAction(row({ points: 4, canTrain: false, reason: 'Maxed for level 2' }) as never, null, null)).toEqual({ kind: 'maxed', label: 'Maxed for level 2' });
    expect(traitAction(row({ canTrain: false, reason: 'Another trait is training' }) as never, null, 'Power')).toEqual({ kind: 'waiting', label: 'Waiting · Power is training' });
    expect(traitAction(row({ canTrain: false, reason: 'Needs 100 Snowflakes' }) as never, null, null, 60)).toEqual({ kind: 'need', label: 'Need 40 more Snowflakes', meta: '100 Snowflakes · 8 min' });
    expect(traitAction(row({ canTrain: false, reason: 'Training now' }) as never, { slot: 0, remainingMs: 93_000, ready: false, totalMs: 120_000 }, null)).toEqual({ kind: 'training', label: '1m 33s left', frac: 0.225 });
    expect(traitAction(row({ canTrain: false, reason: 'Training now' }) as never, { slot: 0, remainingMs: 0, ready: true, totalMs: 120_000 }, null)).toEqual({ kind: 'ready', label: 'Finish +1' });
  });
  test('short durations read naturally', () => {
    expect(shortDuration(480_000)).toBe('8 min');
    expect(shortDuration(120_000)).toBe('2 min');
    expect(shortDuration(45_000)).toBe('45 s');
    expect(shortDuration(5_400_000)).toBe('1 h 30 min');
  });
});

test('merge progress counts every trait point toward the level cap', () => {
  expect(mergeProgress({ level: 2, variants: [1, 2, 3, 4], points: [3, 3, 3, 4] } as never)).toEqual({ points: 13, total: 16, left: 3 });
  expect(mergeProgress({ level: 1, variants: [1, 2, 3], points: [2, 2, 2] } as never)).toEqual({ points: 6, total: 6, left: 0 });
});
