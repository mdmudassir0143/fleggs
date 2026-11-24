import { expect, test } from 'vitest';
import { eggPalette } from './eggPalette';

test('stage 0 is icy with no cracks', () => {
  expect(eggPalette(0)).toMatchObject({ cracks: 0, label: '−40°C' });
});

test('stage 3 is warm with 3 cracks', () => {
  const p = eggPalette(3);
  expect(p).toMatchObject({ cracks: 3, label: '0°C' });
  expect(p.shell).not.toBe(eggPalette(0).shell);
});

test('each stage gets warmer', () => {
  const warmth = [0, 1, 2, 3].map((s) => parseInt(eggPalette(s as 0).shell.slice(1, 3), 16));
  expect(warmth).toEqual([...warmth].sort((a, b) => a - b));
});

test('an element tints the shell and spots', () => {
  const frost = eggPalette(0, 0), ember = eggPalette(0, 3);
  expect(frost.shell).not.toBe(ember.shell);
  expect(frost.shell).not.toBe(eggPalette(0).shell);
  expect(ember.cracks).toBe(0);
  // Ember is orange: red channel beats blue.
  const n = parseInt(ember.shell.slice(1), 16);
  expect(n >> 16).toBeGreaterThan(n & 255);
});

test('unknown element falls back to the plain egg', () => {
  expect(eggPalette(1, 99)).toEqual(eggPalette(1));
});
