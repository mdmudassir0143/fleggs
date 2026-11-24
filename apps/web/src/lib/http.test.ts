import { expect, test, vi } from 'vitest';
import { createPost } from './http';

test('network failure becomes a plain-language message', async () => {
  const post = createPost('https://w', vi.fn(async () => { throw new TypeError('Failed to fetch'); }) as never);
  await expect(post('/x', {})).rejects.toThrow("Can't reach the game server. Check your connection and try again.");
});

test('server error message is passed through', async () => {
  const post = createPost('https://w', vi.fn(async () => new Response(JSON.stringify({ error: 'Servers are busy.' }), { status: 503 })) as never);
  await expect(post('/x', {})).rejects.toThrow('Servers are busy.');
});

test('returns parsed JSON on success', async () => {
  const post = createPost('https://w', vi.fn(async () => new Response('{"ok":1}')) as never);
  expect(await post('/x', {})).toEqual({ ok: 1 });
});
