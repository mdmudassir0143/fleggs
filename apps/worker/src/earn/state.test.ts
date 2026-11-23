import { expect, test, vi } from 'vitest';
import { cachedJson, serialize } from './state';

function fakeCache() {
  const m = new Map<string, Response>();
  return {
    match: vi.fn(async (k: Request) => m.get(k.url)?.clone()),
    put: vi.fn(async (k: Request, r: Response) => { m.set(k.url, r.clone()); }),
  };
}

test('one chain read serves everyone for the cache window; fresh=1 bypasses it', async () => {
  const cache = fakeCache();
  const load = vi.fn(async () => ({ n: load.mock.calls.length }));
  const a = await (await cachedJson('https://w/earn/state', 10, false, load, cache as never)).json();
  const b = await (await cachedJson('https://w/earn/state', 10, false, load, cache as never)).json();
  expect(load).toHaveBeenCalledTimes(1);
  expect(a).toEqual(b);
  await cachedJson('https://w/earn/state', 10, true, load, cache as never);
  expect(load).toHaveBeenCalledTimes(2);
});

test('bigints go out as strings', () => {
  expect(serialize({ a: 5n, b: [1n], c: 'x' })).toBe('{"a":"5","b":["1"],"c":"x"}');
});
