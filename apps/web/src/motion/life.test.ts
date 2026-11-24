// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest';
import { composeYeti } from '@flurry/art';
import { bringToLife, nextBlinkDelay } from './life';
import { gsap } from './gsap';

function stubMotion(reduce: boolean) {
  window.matchMedia = vi.fn((q: string) => ({ matches: q.includes(': reduce') ? reduce : !reduce, media: q, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() })) as never;
}

describe('life', () => {
  test('nextBlinkDelay within 2–5 s', () => {
    expect(nextBlinkDelay(() => 0)).toBe(2);
    expect(nextBlinkDelay(() => 0.999)).toBeLessThanOrEqual(5);
    for (let i = 0; i < 50; i++) { const d = nextBlinkDelay(Math.random); expect(d).toBeGreaterThanOrEqual(2); expect(d).toBeLessThanOrEqual(5); }
  });

  test('bringToLife is a no-op with reduced motion and returns cleanup', () => {
    stubMotion(true);
    document.body.innerHTML = `<div id="r">${composeYeti({ level: 1, elements: [0], variants: [0, 0, 0] })}</div>`;
    const stop = bringToLife(document.getElementById('r')!, { track: true });
    for (const el of Array.from(document.querySelectorAll('[data-rig]'))) expect(gsap.getTweensOf(el).length).toBe(0);
    expect(typeof stop).toBe('function');
    stop();
  });

  test('with full motion it starts breathing and cleans up', () => {
    stubMotion(false);
    document.body.innerHTML = `<div id="r">${composeYeti({ level: 1, elements: [0], variants: [0, 0, 0] })}</div>`;
    const char = document.querySelector('[data-rig="char"]')!;
    const stop = bringToLife(document.getElementById('r')!, {});
    expect(gsap.getTweensOf(char).length).toBeGreaterThan(0);
    stop();
    expect(gsap.getTweensOf(char).length).toBe(0);
  });
});
