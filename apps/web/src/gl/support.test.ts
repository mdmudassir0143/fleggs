// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest';
import { canUseWebGL } from './support';

const media = (reduce: boolean) => {
  window.matchMedia = vi.fn((q: string) => ({ matches: q.includes('reduce') ? reduce : !reduce, media: q, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() })) as never;
};
const withContext = (ok: boolean) => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => (ok ? ({} as never) : null)) as never;
};

describe('canUseWebGL', () => {
  test('falls back when WebGL is unavailable', () => {
    media(false); withContext(false);
    expect(canUseWebGL()).toBe(false);
  });
  test('falls back under reduced motion', () => {
    media(true); withContext(true);
    expect(canUseWebGL()).toBe(false);
  });
  test('falls back on low-memory devices', () => {
    media(false); withContext(true);
    Object.defineProperty(navigator, 'deviceMemory', { value: 1, configurable: true });
    expect(canUseWebGL()).toBe(false);
    Object.defineProperty(navigator, 'deviceMemory', { value: 8, configurable: true });
    expect(canUseWebGL()).toBe(true);
  });
});
