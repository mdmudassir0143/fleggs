import type { Snapshot } from './progress';
import { dailyState } from './daily';
import { mergeReadiness } from './train';

/** Default price of an egg bought with Snowflakes (the live price comes from the Shop). */
export const SNOWFLAKE_EGG_PRICE = 400;

export type EggPath = { id: 'streak' | 'snowflakes' | 'shop'; title: string; detail: string; value: number; max: number; soon: boolean };

/** Every way to the next egg, with progress, for the "Next egg" card. */
export function nextEggPaths(s: Snapshot, now: number, snowflakePrice = SNOWFLAKE_EGG_PRICE): EggPath[] {
  const d = dailyState(s.profile ?? {}, now);
  const flakes = Number(s.profile?.snowflakes ?? 0n);
  return [
    { id: 'streak', title: '7-day streak', detail: d.doneToday ? `Day ${d.streak || 7} done. Come back tomorrow.` : `Play today's run to make it ${d.streak + 1} of 7.`, value: d.eggToday ? 7 : d.streak, max: 7, soon: false },
    { id: 'snowflakes', title: 'Snowflake egg', detail: `Trade ${snowflakePrice} Snowflakes for an egg.`, value: Math.min(flakes, snowflakePrice), max: snowflakePrice, soon: false },
    { id: 'shop', title: 'Egg shop', detail: 'Buy an egg, or pick its element.', value: 0, max: 1, soon: false },
  ];
}

export const snowflakeEggReady = (flakes: number, price: number) => flakes >= price;

/** A yeti that earns the one-time partner egg (ready to merge), or null. */
export function partnerCandidate(yetis: Snapshot['yetis'], claimed: boolean) {
  if (claimed) return null;
  return yetis.find((y) => mergeReadiness(y).ready) ?? null;
}

/** Skip price: per started minute left (mirrors shop::skip_training). */
export function skipPrice(remainingMs: number, perMin: bigint): bigint {
  if (remainingMs <= 0) return 0n;
  return BigInt(Math.ceil(remainingMs / 60_000)) * perMin;
}
