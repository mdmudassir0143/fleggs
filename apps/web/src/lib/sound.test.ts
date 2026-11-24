// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createSound } from './sound';

function fakeAudio() {
  const started: number[] = [];
  const node = () => ({ connect: vi.fn(() => node()), gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, type: '', start: vi.fn(() => started.push(1)), stop: vi.fn() });
  const ctx = { currentTime: 0, state: 'running', destination: {}, resume: vi.fn(), createOscillator: vi.fn(node), createGain: vi.fn(node) };
  return { factory: vi.fn(() => ctx as never), started };
}

describe('sound', () => {
  beforeEach(() => localStorage.clear());

  test('disabled by default', () => {
    expect(createSound(fakeAudio().factory).enabled).toBe(false);
  });

  test('toggle persists', () => {
    const a = createSound(fakeAudio().factory);
    a.setEnabled(true);
    expect(localStorage.getItem('flurry:sound')).toBe('1');
    expect(createSound(fakeAudio().factory).enabled).toBe(true);
    a.setEnabled(false);
    expect(createSound(fakeAudio().factory).enabled).toBe(false);
  });

  test('play is a no-op before a user gesture', () => {
    const audio = fakeAudio();
    const s = createSound(audio.factory);
    s.setEnabled(true);
    s.play('chime');
    expect(audio.factory).not.toHaveBeenCalled();
    s.unlock();
    s.play('chime');
    expect(audio.started.length).toBeGreaterThan(0);
  });

  test('play is a no-op when disabled', () => {
    const audio = fakeAudio();
    const s = createSound(audio.factory);
    s.unlock();
    s.play('tap');
    expect(audio.started.length).toBe(0);
  });

  test("storage errors don't throw", () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    const s = createSound(fakeAudio().factory);
    expect(s.enabled).toBe(false);
    expect(() => s.setEnabled(true)).not.toThrow();
    expect(s.enabled).toBe(true);
    get.mockRestore(); set.mockRestore();
  });
});
