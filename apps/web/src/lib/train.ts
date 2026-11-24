import { GAME, GAME_SLOT, trainingCost, trainingMs } from '@flurry/shared';
import { band } from '@flurry/art';
import type { Yeti } from './flurry';

export const SLOT_LABEL = ['Fur', 'Horns', 'Power', 'Build'];
export const STAT_LABEL = ['Warmth', 'Speed', 'Magic', 'Strength'];

export const GAME_INFO: Record<number, { name: string; element: number; blurb: string }> = {
  [GAME.KeepItWarm]: { name: 'Keep It Warm', element: 0, blurb: 'Hold to warm, let go to cool.' },
  [GAME.IcicleDash]: { name: 'Icicle Dash', element: 1, blurb: 'Swipe between lanes, dodge icicles.' },
  [GAME.LofiBeats]: { name: 'Lofi Beats', element: 2, blurb: 'Tap the snowflakes on the beat.' },
  [GAME.IglooStack]: { name: 'Igloo Stack', element: 3, blurb: 'Drop the ice blocks, build it tall.' },
};

/** One tile per game: what it trains and the yeti's bonus in it. */
export function gameTiles(y: Yeti) {
  return [GAME.KeepItWarm, GAME.IcicleDash, GAME.LofiBeats, GAME.IglooStack].map((game) => {
    const slot = GAME_SLOT[game];
    const has = slot < (y.points?.length ?? y.variants.length);
    return {
      game, slot, ...GAME_INFO[game],
      stat: `${SLOT_LABEL[slot]} · ${STAT_LABEL[slot]}`,
      bonus: has ? y.points?.[slot] ?? 0 : 0,
      note: has ? null : 'Strength unlocks at level 2',
    };
  });
}

/** Trait rows with whether +1 can be trained now, and why not. */
export function traitRows(y: Yeti, snowflakes: number, now: number) {
  const cap = y.level * 2;
  const busy = y.training && y.training.readyAt > 0 ? y.training : null;
  return (y.points ?? y.variants.map(() => 0)).map((points, slot) => {
    const cost = trainingCost(points);
    let reason: string | null = null;
    if (points >= cap) reason = `Maxed for level ${y.level}`;
    else if (busy) reason = busy.slot === slot ? 'Training now' : 'Another trait is training';
    else if (snowflakes < cost) reason = `Needs ${cost} Snowflakes`;
    return {
      slot, label: SLOT_LABEL[slot], stat: STAT_LABEL[slot], band: band(y.variants[slot] ?? 0),
      points, cap, cost, ms: trainingMs(points), canTrain: reason === null, reason, now,
    };
  });
}

/**
 * The training in progress, measured against chain time (`clockOffsetMs` = chain − local),
 * so a wrong phone clock can't show "ready" before the chain agrees.
 */
export function trainingStatus(y: Yeti, localNow: number, clockOffsetMs: number) {
  if (!y.training) return null;
  const remainingMs = Math.max(0, y.training.readyAt - (localNow + clockOffsetMs));
  return { slot: y.training.slot, remainingMs, ready: remainingMs === 0, totalMs: trainingMs((y.points?.[y.training.slot] ?? 0)) };
}

export function formatDuration(ms: number) {
  const s = Math.ceil(ms / 1000);
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`;
}

/** Merging needs every trait at its level cap (level × 2) and no training in progress. */
export function mergeReadiness(y: Yeti) {
  const cap = y.level * 2;
  const points = y.points ?? y.variants.map(() => 0);
  const trainingsLeft = points.reduce((n, p) => n + Math.max(0, cap - p), 0);
  return { ready: trainingsLeft === 0 && !y.training, trainingsLeft };
}

/** The Train tile's play line: free plays, then bought plays, then the price of one more. */
export function playLabel(left: { free: number; credits: number; total: number }, price: bigint) {
  if (left.free > 0 && left.credits > 0) return { text: `${left.free} free + ${left.credits} bought`, paid: false };
  if (left.free > 0) return { text: `${left.free} free ${left.free === 1 ? 'play' : 'plays'} left`, paid: false };
  if (left.credits > 0) return { text: `${left.credits} bought ${left.credits === 1 ? 'play' : 'plays'}`, paid: false };
  return { text: `Play · ${(Number(price) / 1e9).toFixed(3).replace(/\.?0+$/, '')} SUI`, paid: true };
}

/** One line per yeti on the Train list: what it's doing, or how close it is to merging. */
export function yetiStatus(y: Yeti, localNow: number, clockOffsetMs: number): { text: string; tone: 'busy' | 'ready' | 'merge' | 'idle' } {
  const t = trainingStatus(y, localNow, clockOffsetMs);
  if (t) return t.ready ? { text: `${SLOT_LABEL[t.slot]} is ready`, tone: 'ready' } : { text: `${SLOT_LABEL[t.slot]} · ${formatDuration(t.remainingMs)}`, tone: 'busy' };
  const m = mergeReadiness(y);
  if (m.ready) return { text: 'Ready to merge', tone: 'merge' };
  return { text: `${m.trainingsLeft} ${m.trainingsLeft === 1 ? 'training' : 'trainings'} to merge`, tone: 'idle' };
}

/** A trait's tier as shown on the yeti card: Common, Fine, Rare or Mutant. */
export const bandName = (b: string) => b.charAt(0).toUpperCase() + b.slice(1);

/** "8 min", "45 s", "1 h 30 min": costs and durations in plain words. */
export function shortDuration(ms: number) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
}

type Row = ReturnType<typeof traitRows>[number];
type Status = ReturnType<typeof trainingStatus>;
export type TraitAction =
  | { kind: 'train'; label: string; meta: string }
  | { kind: 'need'; label: string; meta: string }
  | { kind: 'training'; label: string; frac: number }
  | { kind: 'ready'; label: string }
  | { kind: 'maxed'; label: string }
  | { kind: 'waiting'; label: string };

/** What a trait card offers right now, in words a player understands. */
export function traitAction(r: Row, status: Status, trainingLabel: string | null, snowflakes?: number): TraitAction {
  const meta = `${r.cost} Snowflakes · ${shortDuration(r.ms)}`;
  if (status && status.slot === r.slot) {
    if (status.ready) return { kind: 'ready', label: 'Finish +1' };
    return { kind: 'training', label: `${formatDuration(status.remainingMs)} left`, frac: Math.round((1 - status.remainingMs / status.totalMs) * 1000) / 1000 };
  }
  if (r.points >= r.cap) return { kind: 'maxed', label: `Maxed for level ${r.cap / 2}` };
  if (r.reason === 'Another trait is training') return { kind: 'waiting', label: `Waiting · ${trainingLabel ?? 'another trait'} is training` };
  if (!r.canTrain) return { kind: 'need', label: `Need ${Math.max(0, r.cost - (snowflakes ?? 0))} more Snowflakes`, meta };
  return { kind: 'train', label: 'Train +1', meta };
}

/** Points earned toward merging: every trait at the level cap. */
export function mergeProgress(y: Yeti) {
  const cap = y.level * 2;
  const pts = y.points ?? y.variants.map(() => 0);
  const points = pts.reduce((a, p) => a + Math.min(p, cap), 0);
  const total = pts.length * cap;
  return { points, total, left: total - points };
}
