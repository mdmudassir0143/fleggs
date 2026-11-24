import { describe, expect, test } from 'vitest';
import { canAfford, holdDone, mergeGroups, previewChild } from './merge';

const y = (id: string, level: number, el: number, points: number, variants?: number[]) => ({
  id, level, elements: [el], variants: variants ?? Array.from({ length: level <= 1 ? 3 : level === 2 ? 4 : 5 }, (_, i) => i + 1),
  name: id, cardUrl: '', named: true, points: Array.from({ length: level <= 1 ? 3 : level === 2 ? 4 : 5 }, () => points), training: null,
});

describe('merge logic', () => {
  test('only same-level ready yetis pair up', () => {
    const g = mergeGroups([y('a', 1, 0, 2), y('b', 1, 1, 2), y('c', 1, 0, 1), y('d', 2, 0, 4)]);
    expect(g).toEqual([{ level: 1, yetis: ['a', 'b'] }]);
  });

  test('preview applies +1 and the new cap, adds the new slot', () => {
    const a = y('a', 1, 0, 2, [1, 2, 3]), b = y('b', 1, 0, 2, [5, 6, 7]);
    const c = previewChild(a, b, [0, 1, 0]);
    expect(c.level).toBe(2);
    expect(c.cap).toBe(4);
    expect(c.traits.map((t) => [t.variant, t.points])).toEqual([[1, 3], [6, 3], [3, 3], [null, 0]]);
  });

  test('different elements preview as a hybrid', () => {
    expect(previewChild(y('a', 1, 3, 2), y('b', 1, 1, 2), [0, 0, 0]).elements).toEqual([1, 3]);
    expect(previewChild(y('a', 1, 2, 2), y('b', 1, 2, 2), [0, 0, 0]).elements).toEqual([2]);
  });

  test('hold-to-confirm needs a full second', () => {
    expect(holdDone(0, 999)).toBe(false);
    expect(holdDone(0, 1000)).toBe(true);
  });

  test('not enough SUI is detected', () => {
    expect(canAfford(99_999_999n, 100_000_000n)).toBe(false);
    expect(canAfford(100_000_000n, 100_000_000n)).toBe(true);
  });
});

import { sui } from './merge';
test('SUI amounts are short and readable', () => {
  expect(sui(993_347_476n)).toBe('0.993 SUI');
  expect(sui(100_000_000n)).toBe('0.1 SUI');
  expect(sui(1_000_000_000n)).toBe('1 SUI');
});
