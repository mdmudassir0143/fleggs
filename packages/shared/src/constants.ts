export const ELEMENT = { Frost: 0, Storm: 1, Aurora: 2, Ember: 3 } as const;
export const PURPOSE = { EggStage: 0, Training: 1, Daily: 2, Trial: 3 } as const;
export const GAME = { KeepItWarm: 0, IcicleDash: 1, LofiBeats: 2, IglooStack: 3 } as const;
export const ATTESTATION_TTL_MS = 600_000;

/** Score → trait quality tier (0, 1 or 2). */
export function scoreTier(score: number): 0 | 1 | 2 {
  if (score < 400) return 0;
  if (score < 700) return 1;
  return 2;
}

export const DAY_MS = 86_400_000;
/** UTC day index used on chain (clock ms / one day). */
export const dayIndex = (ms: number) => Math.floor(ms / DAY_MS);
/** The daily run's game for a UTC day (mirrors daily::game_for_day). */
export const dailyGame = (day: number) => day % 4;
/** Snowflakes to raise a trait from `points` to points+1 (mirrors training::start). */
export const trainingCost = (points: number) => 25 * (points + 1);
/** Training timer for the next point, ms. */
export const trainingMs = (points: number) => 120_000 * (points + 1);
/** Snowflakes a training or daily run earns. Egg stages keep floor(score / 10). */
export const trainSnowflakes = (score: number) => Math.min(20, Math.floor(score / 50));
/** Which trait slot gives a bonus in each game (Fur/Warmth, Horns/Speed, Power/Magic, slot 3/Strength — L2+). */
export const GAME_SLOT: Record<number, number> = { 0: 0, 1: 1, 2: 2, 3: 3 };
export const STREAK_FOR_EGG = 7;
/** Trait slots per level (mirrors merge::slots_for). */
export const slotsFor = (level: number) => (level <= 1 ? 3 : level === 2 ? 4 : 5);
export const LEVEL_NAMES = ['', 'Hatchling', 'Drifter', 'Ridge Runner', 'Peak Warden', 'Elder Yeti'];
export const MAX_LEVEL = 5;
