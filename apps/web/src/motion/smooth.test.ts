// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest';
import { startSmoothScroll, withViewTransition } from './smooth';

const media = (reduce: boolean, coarse = false) => {
  window.matchMedia = vi.fn((q: string) => ({ matches: q.includes('reduce') ? reduce : q.includes('coarse') ? coarse : !reduce, media: q, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() })) as never;
};

describe('smooth flow', () => {
  test('withViewTransition falls back when unsupported', () => {
    media(false);
    const update = vi.fn();
    (document as { startViewTransition?: unknown }).startViewTransition = undefined;
    withViewTransition(update);
    expect(update).toHaveBeenCalledTimes(1);
  });

  test('withViewTransition uses the browser API when present', () => {
    media(false);
    const update = vi.fn();
    const svt = vi.fn((cb: () => void) => { cb(); return {}; });
    (document as { startViewTransition?: unknown }).startViewTransition = svt;
    withViewTransition(update);
    expect(svt).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
  });

  test('withViewTransition skips the animation under reduced motion', () => {
    media(true);
    const svt = vi.fn();
    (document as { startViewTransition?: unknown }).startViewTransition = svt;
    const update = vi.fn();
    withViewTransition(update);
    expect(svt).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
  });

  test('smooth scroll disabled under reduced motion', () => {
    media(true);
    expect(startSmoothScroll()).toBeNull();
  });

  test('smooth scroll disabled on touch devices', () => {
    media(false, true);
    expect(startSmoothScroll()).toBeNull();
  });
});
