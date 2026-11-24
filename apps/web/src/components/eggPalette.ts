import { ELEMENT_COLORS, shade } from '@flurry/art';

const STAGES = [
  { shell: '#CFE3F5', spots: '#9CC3E6', cracks: 0, label: '−40°C' },
  { shell: '#E4EEF6', spots: '#AFCBE4', cracks: 1, label: '−25°C' },
  { shell: '#F4EEE6', spots: '#E3C9B0', cracks: 2, label: '−10°C' },
  { shell: '#FFF1DC', spots: '#F5B98A', cracks: 3, label: '0°C' },
] as const;

/** Blend two #RRGGBB colours: t = 0 is `a`, t = 1 is `b`. */
export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return '#' + ((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0').toUpperCase();
}

/**
 * How the egg looks at each warming stage: icy → pale → warm cream, one more crack per stage.
 * Given an element, the shell takes that element's colour (Frost blue, Storm violet, Aurora green,
 * Ember orange); it still softens toward cream as it warms so the stage stays readable.
 */
export function eggPalette(stage: 0 | 1 | 2 | 3, element?: number) {
  const base = STAGES[stage];
  const color = element === undefined ? undefined : ELEMENT_COLORS[element];
  if (!color) return { ...base };
  const t = 0.62 - stage * 0.08; // strong tint when frozen, a little warmer each stage
  return { ...base, shell: mix(base.shell, color, t), spots: shade(color, -0.12) };
}
