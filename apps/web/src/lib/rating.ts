export type Rating = 'Chilly' | 'Toasty' | 'Perfect';

/** How warm a run felt: under 400 Chilly, under 700 Toasty, otherwise Perfect. */
export function rating(score: number): Rating {
  return score < 400 ? 'Chilly' : score < 700 ? 'Toasty' : 'Perfect';
}
