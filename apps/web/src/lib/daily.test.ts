import { describe, expect, test } from 'vitest';
import { DAY_MS, GAME } from '@flurry/shared';
import { dailyState } from './daily';

const DAY = 20_001; // Icicle Dash day
const at = (day: number, h = 10) => day * DAY_MS + h * 3_600_000;

describe('daily state', () => {
  test("shows today's game by UTC day", () => {
    expect(dailyState({ streak: 0, lastDailyDay: 0 }, at(DAY)).game).toBe(GAME.IcicleDash);
    expect(dailyState({ streak: 0, lastDailyDay: 0 }, at(DAY + 1)).game).toBe(GAME.LofiBeats);
  });

  test("done state after today's submission, with time until the next run", () => {
    const s = dailyState({ streak: 3, lastDailyDay: DAY }, at(DAY, 20));
    expect(s.doneToday).toBe(true);
    expect(s.msUntilNext).toBe(4 * 3_600_000);
  });

  test('streak path fills to the streak', () => {
    const s = dailyState({ streak: 4, lastDailyDay: DAY - 1 }, at(DAY));
    expect(s.streak).toBe(4);
    expect(s.steps.filter((x) => x === 'done')).toHaveLength(4);
    expect(s.steps[4]).toBe('today');
    expect(s.steps[6]).toBe('egg');
  });

  test('day-7 completion shows the egg reward', () => {
    const s = dailyState({ streak: 0, lastDailyDay: DAY }, at(DAY));
    expect(s.eggToday).toBe(true);
    expect(s.steps.every((x) => x === 'done')).toBe(true);
  });

  test('a missed day shows the streak restarting', () => {
    const s = dailyState({ streak: 5, lastDailyDay: DAY - 2 }, at(DAY));
    expect(s.broken).toBe(true);
    expect(s.streak).toBe(0);
    expect(s.steps[0]).toBe('today');
  });
});
