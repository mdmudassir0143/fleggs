import { describe, expect, test } from 'vitest';
import { bcs } from '@mysten/sui/bcs';
import { DAY_MS, GAME, GAME_SLOT, dailyGame, dayIndex, trainSnowflakes, trainingCost, trainingMs, TrainingBcs } from './index';

describe('training and daily rules', () => {
  test('dailyGame cycles 0..3 by UTC day', () => {
    expect([20000, 20001, 20002, 20003, 20004].map(dailyGame)).toEqual([0, 1, 2, 3, 0]);
    expect(dayIndex(20001 * DAY_MS + 5)).toBe(20001);
  });
  test('trainingCost 25/50/75', () => expect([0, 1, 2].map(trainingCost)).toEqual([25, 50, 75]));
  test('trainingMs 2/4/6 min', () => expect([0, 1, 2].map(trainingMs)).toEqual([120_000, 240_000, 360_000]));
  test('trainSnowflakes caps at 20', () => {
    expect(trainSnowflakes(0)).toBe(0);
    expect(trainSnowflakes(499)).toBe(9);
    expect(trainSnowflakes(1000)).toBe(20);
  });
  test('each game trains one trait slot', () => {
    expect(GAME_SLOT[GAME.KeepItWarm]).toBe(0);
    expect(GAME_SLOT[GAME.IcicleDash]).toBe(1);
    expect(GAME_SLOT[GAME.LofiBeats]).toBe(2);
    expect(GAME_SLOT[GAME.IglooStack]).toBe(3);
  });
  test('Training BCS matches the Move struct', () => {
    const bytes = bcs.struct('T', { slot: bcs.u8(), ready_at_ms: bcs.u64() }).serialize({ slot: 2, ready_at_ms: 1234n }).toBytes();
    expect(TrainingBcs.parse(bytes)).toEqual({ slot: 2, ready_at_ms: '1234' });
  });
});
