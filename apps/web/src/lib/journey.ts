import { ELEMENT_NAMES } from '@flurry/art';
import { rating, type Rating } from './rating';
import { KIW_STAGES } from '@flurry/games';

/** Stage i of warming decides trait slot i (see yeti::roll_traits): Fur, Horns, Power. */
const TRAITS = ['Fur', 'Horns', 'Power'] as const;
const TEMPS = ['−40°C', '−25°C', '−10°C', '0°C'];

export type JourneyStep =
  | { trait: string; state: 'done'; score: number; rating: Rating; stars: 1 | 2 | 3 }
  | { trait: string; state: 'next' | 'locked' };

export function journey(scores: number[]): JourneyStep[] {
  return TRAITS.map((trait, i) => {
    if (i < scores.length) {
      const r = rating(scores[i]);
      return { trait, state: 'done', score: scores[i], rating: r, stars: (r === 'Perfect' ? 3 : r === 'Toasty' ? 2 : 1) as 1 | 2 | 3 };
    }
    return { trait, state: i === scores.length ? 'next' : 'locked' };
  });
}

/** Heading, temperature and story line for the stage that's up next. */
export function stageCopy(stage: 0 | 1 | 2 | 'hatch') {
  if (stage === 'hatch') return { temp: TEMPS[3], title: 'It’s wiggling! Ready to hatch', line: 'All three traits are set. Hatch it to meet your yeti.', fill: 100 };
  const t = TRAITS[stage].toLowerCase();
  return {
    temp: TEMPS[stage],
    title: `Warm its ${t}`,
    line: `This run sets its ${TRAITS[stage]}. Score 700+ for the rarest ${t}.`,
    fill: Math.round((stage / 3) * 100),
  };
}

/** One egg in the nest picker. */
export function eggChip(egg: { id: string; element: number; stageScores: number[] }) {
  const n = egg.stageScores.length;
  return {
    name: `${ELEMENT_NAMES[egg.element] ?? 'Mystery'} egg`,
    status: n >= 3 ? 'Ready to hatch' : n === 0 ? 'Not warmed yet' : `${n} of 3 warm`,
    ready: n >= 3,
  };
}

/** What a finished stage unlocked: stage N sets trait N, tiered as yeti::roll_traits does (700+ Rare, 400+ Fine). */
export function stageReward(stage: 0 | 1 | 2, score: number): { trait: (typeof TRAITS)[number]; tier: 'Common' | 'Fine' | 'Rare' } {
  return { trait: TRAITS[stage], tier: score >= 700 ? 'Rare' : score >= 400 ? 'Fine' : 'Common' };
}

/** The stage's name and its one-line rule, shown before it starts. */
export function stageIntro(stage: 0 | 1 | 2): { name: string; rule: string } {
  const s = KIW_STAGES[stage];
  return { name: s.name, rule: s.rule };
}

/** A teaser from inside the egg, once it's nearly warm. */
export function eggHint(stagesDone: number): string | null {
  if (stagesDone >= 3) return 'It’s knocking from the inside!';
  if (stagesDone === 2) return 'Something fluffy is stirring…';
  return null;
}

/**
 * Which stage to show: the egg's own progress, or the one after a stage the player just finished
 * (the chain refresh can land a moment after "Warm the next stage").
 */
export function shownStage(done: number, justFinished: number | null): 0 | 1 | 2 | 'hatch' {
  const n = Math.max(done, justFinished === null ? 0 : justFinished + 1);
  return n >= 3 ? 'hatch' : (n as 0 | 1 | 2);
}

type EggLike = { id: string; element: number; stageScores: number[] };

/** The egg being warmed: the started one furthest along (one egg warms at a time), or none. */
export function activeEgg<E extends EggLike>(eggs: E[]): E | null {
  return eggs.filter((e) => e.stageScores.length > 0).sort((a, b) => b.stageScores.length - a.stageScores.length)[0] ?? null;
}

/** A fresh egg waits while another egg is part-warmed or ready to hatch (the Worker enforces the same). */
export function waitsFor(eggs: EggLike[], egg: EggLike): { id: string; name: string } | null {
  if (egg.stageScores.length > 0) return null;
  const a = activeEgg(eggs);
  return a ? { id: a.id, name: eggChip(a).name } : null;
}

/** Nest order: the egg in progress first, then the rest as they came. */
export function nestOrder<E extends EggLike>(eggs: E[]): E[] {
  const a = activeEgg(eggs);
  return a ? [a, ...eggs.filter((e) => e !== a)] : eggs;
}
