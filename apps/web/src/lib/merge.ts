import { LEVEL_NAMES, MAX_LEVEL, slotsFor } from '@flurry/shared';
import type { Yeti } from './flurry';
import { mergeReadiness } from './train';

export const HOLD_MS = 1000;

/** Levels that have at least two ready-to-merge yetis, with their ids. */
export function mergeGroups(yetis: Yeti[]): { level: number; yetis: string[] }[] {
  const byLevel = new Map<number, string[]>();
  for (const y of yetis) {
    if (y.level >= MAX_LEVEL || !mergeReadiness(y).ready) continue;
    byLevel.set(y.level, [...(byLevel.get(y.level) ?? []), y.id]);
  }
  return [...byLevel.entries()].filter(([, ids]) => ids.length >= 2).map(([level, ids]) => ({ level, yetis: ids })).sort((a, b) => a.level - b.level);
}

/** What the merged yeti will look like (mirrors merge::merge, minus the random new slot and mutation). */
export function previewChild(a: Yeti, b: Yeti, picks: number[]) {
  const level = a.level + 1, cap = level * 2;
  const traits: { variant: number | null; points: number; from: 'a' | 'b' | 'new' }[] = picks.map((p, i) => {
    const src = p === 0 ? a : b;
    return { variant: src.variants[i], points: Math.min(cap, (src.points?.[i] ?? 0) + 1), from: p === 0 ? 'a' : 'b' };
  });
  while (traits.length < slotsFor(level)) traits.push({ variant: null, points: 0, from: 'new' });
  const ea = a.elements[0], eb = b.elements[0];
  return { level, name: LEVEL_NAMES[level], cap, traits, elements: ea === eb ? [ea] : [Math.min(ea, eb), Math.max(ea, eb)] };
}

export const holdDone = (start: number, now: number) => now - start >= HOLD_MS;
export const canAfford = (balance: bigint, price: bigint) => balance >= price;
export const FAUCET_URL = 'https://faucet.sui.io/?network=testnet';
export const sui = (mist: bigint) => `${(Number(mist) / 1e9).toFixed(3).replace(/\.?0+$/, '')} SUI`;
