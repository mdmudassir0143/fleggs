import { describe, expect, test } from 'vitest';
import { bootView } from './boot';

describe('what the first screen shows', () => {
  test('while the wallet reconnects, a loader, never the story', () => {
    expect(bootView({ game: 'signed-out', wallet: 'reconnecting', savedSession: true, waitedMs: 100 })).toBe('loader');
    expect(bootView({ game: 'signed-out', wallet: 'connecting', savedSession: false, waitedMs: 100 })).toBe('loader');
  });
  test('a returning player waits on the loader even before reconnecting starts', () => {
    expect(bootView({ game: 'signed-out', wallet: 'disconnected', savedSession: true, waitedMs: 300 })).toBe('loader');
  });
  test('…but not forever: after 5 s with no session, the story', () => {
    expect(bootView({ game: 'signed-out', wallet: 'disconnected', savedSession: true, waitedMs: 5001 })).toBe('landing');
  });
  test('a first-time visitor sees the story straight away', () => {
    expect(bootView({ game: 'signed-out', wallet: 'disconnected', savedSession: false, waitedMs: 0 })).toBe('landing');
  });
  test('once the game is loading or ready, the app (which shows its own loader while loading)', () => {
    expect(bootView({ game: 'loading', wallet: 'connected', savedSession: true, waitedMs: 0 })).toBe('app');
    expect(bootView({ game: 'ready', wallet: 'connected', savedSession: true, waitedMs: 0 })).toBe('app');
  });
});

test('the moment the wallet connects (before the game starts loading), still the loader', () => {
  expect(bootView({ game: 'signed-out', wallet: 'connected', savedSession: false, waitedMs: 9000 })).toBe('loader');
});
