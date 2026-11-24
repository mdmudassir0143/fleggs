import { expect, test } from 'vitest';
import { rating } from './rating';

test('rating thresholds 399/400/699/700', () => {
  expect(rating(0)).toBe('Chilly');
  expect(rating(399)).toBe('Chilly');
  expect(rating(400)).toBe('Toasty');
  expect(rating(699)).toBe('Toasty');
  expect(rating(700)).toBe('Perfect');
  expect(rating(1000)).toBe('Perfect');
});
