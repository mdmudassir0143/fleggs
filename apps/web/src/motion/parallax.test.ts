import { expect, test } from 'vitest';
import { storySceneBack, storySceneFront } from '@flurry/art';
import { parallaxOffsets, MAX_SHIFT } from './parallax';

test('centre pointer gives zero offset', () => {
  expect(parallaxOffsets(0, 0, [0.2, 0.7])).toEqual([{ x: 0, y: 0 }, { x: 0, y: 0 }]);
});

test('offsets scale with depth and stay within 24px × depth', () => {
  const [far, near] = parallaxOffsets(1, -1, [0.2, 0.8]);
  expect(Math.abs(near.x)).toBeGreaterThan(Math.abs(far.x));
  for (const [p, d] of [[far, 0.2], [near, 0.8]] as const) {
    expect(Math.abs(p.x)).toBeLessThanOrEqual(MAX_SHIFT * d);
    expect(Math.abs(p.y)).toBeLessThanOrEqual(MAX_SHIFT * d);
  }
  const [clamped] = parallaxOffsets(9, 9, [1]);
  expect(clamped).toEqual({ x: -MAX_SHIFT, y: -MAX_SHIFT * 0.6 });
});

test('scene has #rays and #haze', () => {
  const svg = storySceneBack() + storySceneFront();
  expect(svg).toContain('id="rays"');
  expect(svg).toContain('id="haze"');
});
