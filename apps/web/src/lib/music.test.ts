// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createMusic, PROGRESSION } from './music';

const fakeCtx = () => vi.fn(() => { throw new Error('should not create audio yet'); });

describe('music', () => {
  beforeEach(() => localStorage.clear());

  test('on by default, remembered when turned off', () => {
    expect(createMusic(fakeCtx() as never).enabled).toBe(true);
    createMusic(fakeCtx() as never).setEnabled(false);
    expect(localStorage.getItem('flurry:music')).toBe('0');
    expect(createMusic(fakeCtx() as never).enabled).toBe(false);
  });

  test('no audio context before a user gesture', () => {
    const make = fakeCtx();
    const m = createMusic(make as never);
    expect(make).not.toHaveBeenCalled(); // enabled by default, yet silent until a tap or key
    expect(m.playing).toBe(false);
  });

  test('storage errors do not throw', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    const m = createMusic(fakeCtx() as never);
    expect(m.enabled).toBe(true);
    expect(() => m.setEnabled(false)).not.toThrow();
    get.mockRestore(); set.mockRestore();
  });

  test('a calm four-chord loop', () => {
    expect(PROGRESSION).toHaveLength(4);
    for (const chord of PROGRESSION) expect(chord.length).toBeGreaterThanOrEqual(3);
  });
});
