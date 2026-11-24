import type { PlayerIdentity } from '@flurry/shared';
import type { Egg, Held, Profile, Yeti } from './flurry';

export type Snapshot = { address: string; profile: Profile | null; eggs: Egg[]; yetis: Yeti[]; identity?: PlayerIdentity | null;
  /** Yetis listed on the Market or in the Lodge on the player's behalf. */
  held?: Held[];
  /** This player's admin key, if they're an admin. */
  adminCapId?: string | null;
  /** Snowflake gifts from the team waiting to be claimed. */
  gifts?: import('./admin').Gift[] };

/** Number of on-chain changes the player has made; any new transaction moves it forward. */
export const progress = (s: Snapshot) =>
  (s.profile ? 1 : 0) + s.eggs.reduce((n, e) => n + e.stageScores.length, 0) + s.yetis.length * 10 + s.yetis.filter((y) => y.named).length;
