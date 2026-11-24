export const THINK_STEPS = ['Picking a name', 'Writing its story', 'Drawing its card'] as const;

/** Which step is lit: naming, story, card. Paced to the usual wait; it stays on the last one. */
export function stepAt(ms: number): number {
  return ms < 3000 ? 0 : ms < 7000 ? 1 : 2;
}
