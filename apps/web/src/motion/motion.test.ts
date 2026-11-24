// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { MOTION, motionContext, registerGsap, settle } from './gsap';

function stubReducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn((q: string) => ({
    matches: q.includes(': reduce') ? reduce : !reduce,
    media: q, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })) as never;
}

describe('motion tokens', () => {
  test('MOTION durations match the spec', () => {
    expect(MOTION.tap).toEqual({ duration: 0.12, ease: 'power2.out' });
    expect(MOTION.ui).toEqual({ duration: 0.22, ease: 'power2.out' });
    expect(MOTION.enter).toEqual({ duration: 0.45, ease: 'back.out(1.6)' });
    expect(MOTION.hero).toEqual({ duration: 0.9, ease: 'expo.out' });
    expect(MOTION.stagger).toBe(0.06);
  });
});

describe('motionContext', () => {
  afterEach(() => vi.restoreAllMocks());

  test('calls build(true) when reduced motion matches', () => {
    stubReducedMotion(true);
    const build = vi.fn();
    const ctx = motionContext(document.body, build);
    expect(build).toHaveBeenCalledWith(true);
    ctx.revert();
  });

  test('calls build(false) otherwise', () => {
    stubReducedMotion(false);
    const build = vi.fn();
    motionContext(document.body, build).revert();
    expect(build).toHaveBeenCalledWith(false);
  });

  test('reduced branch runs end state', () => {
    const gsap = registerGsap();
    const box = { x: 0 };
    const tl = gsap.timeline().to(box, { x: 10, duration: 5 });
    settle(tl);
    expect(box.x).toBe(10);
  });

  test('registers the snowfall ease', () => {
    const gsap = registerGsap();
    expect(typeof gsap.parseEase('snowfall')).toBe('function');
  });
});
