import { band } from '@flurry/art';
import type { Yeti } from './flurry';

export type Foil = 'common' | 'fine' | 'rare' | 'mutant';
const ORDER: Foil[] = ['common', 'fine', 'rare', 'mutant'];
const TRAITS = ['Fur', 'Horns', 'Power'];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** Newest first: the chain lists yetis oldest first. */
export function sortYetis(yetis: Yeti[]): Yeti[] {
  return [...yetis].reverse();
}

/** One row per trait with its quality band, e.g. { trait: 'Horns', band: 'Fine' }. */
export function traitRows(y: Yeti): { trait: string; band: string }[] {
  return TRAITS.map((trait, i) => ({ trait, band: cap(band(y.variants[i] ?? 0)) }));
}

/** The card's foil follows its best trait: ice gloss, frost shimmer, gold, or aurora holo. */
export function foilFor(variants: number[]): Foil {
  return variants.reduce<Foil>((best, v) => (ORDER.indexOf(band(v)) > ORDER.indexOf(best) ? band(v) : best), 'common');
}

export const MAX_TILT = 12;

/** Pointer → card tilt (degrees, clamped ±12) and glare position (percent). */
export function tiltFromPointer(x: number, y: number, r: { left: number; top: number; width: number; height: number }) {
  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  const px = clamp(((x - r.left) / r.width) * 100), py = clamp(((y - r.top) / r.height) * 100);
  return { rx: (1 - py / 50) * MAX_TILT + 0, ry: (px / 50 - 1) * MAX_TILT + 0, px, py };
}
