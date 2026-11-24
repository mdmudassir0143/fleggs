import { describe, expect, test } from 'vitest';
import { stepAt, THINK_STEPS } from './thinking';

describe('Lofi is thinking of a name', () => {
  test('the steps move on with time and stop at the last one', () => {
    expect(THINK_STEPS).toEqual(['Picking a name', 'Writing its story', 'Drawing its card']);
    expect(stepAt(0)).toBe(0);
    expect(stepAt(3500)).toBe(1);
    expect(stepAt(8000)).toBe(2);
    expect(stepAt(60000)).toBe(2);
  });
});
