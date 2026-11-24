import { DAY_MS, STREAK_FOR_EGG, dailyGame, dayIndex } from '@flurry/shared';

export type StepState = 'done' | 'today' | 'todo' | 'egg';

/**
 * Everything the daily card needs, from the profile's on-chain streak and the (chain-synced) time:
 * today's game, whether it's done, the 7-step path to the streak egg, and whether the streak broke.
 */
export function dailyState(p: { streak?: number; lastDailyDay?: number }, now: number) {
  const day = dayIndex(now);
  const last = p.lastDailyDay ?? 0;
  const doneToday = last === day;
  const raw = p.streak ?? 0;
  const broken = !doneToday && raw > 0 && last < day - 1;
  const streak = broken ? 0 : raw;
  const eggToday = doneToday && raw === 0; // the 7th run resets the streak to 0 and mints the egg
  const steps: StepState[] = Array.from({ length: STREAK_FOR_EGG }, (_, i) => {
    if (eggToday || i < streak) return 'done';
    if (i === streak && !doneToday) return 'today';
    return i === STREAK_FOR_EGG - 1 ? 'egg' : 'todo';
  });
  return { day, game: dailyGame(day), doneToday, streak, broken, eggToday, steps, msUntilNext: (day + 1) * DAY_MS - now };
}
