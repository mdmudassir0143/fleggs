import { expect, test, vi } from 'vitest';
import { pollUntil } from './poll';

test('keeps reading until the change shows up', async () => {
  const read = vi.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(1);
  const v = await pollUntil(read, (n) => n === 1, { tries: 5, delayMs: 1 });
  expect(v).toBe(1);
  expect(read).toHaveBeenCalledTimes(3);
});

test('returns the last read when the change never shows up', async () => {
  const read = vi.fn().mockResolvedValue(0);
  expect(await pollUntil(read, (n) => n === 1, { tries: 3, delayMs: 1 })).toBe(0);
  expect(read).toHaveBeenCalledTimes(3);
});
