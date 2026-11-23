import { expect, test, vi } from 'vitest';
import { uploadBlob, blobUrl } from './walrus';

const cfg = (fetch: typeof globalThis.fetch) => ({ publisher: 'https://pub', aggregator: 'https://agg', epochs: 50, fetch, sleep: async () => {} });
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

test('uploadBlob reads newlyCreated and alreadyCertified blob IDs', async () => {
  const f1 = vi.fn(async () => ok({ newlyCreated: { blobObject: { blobId: 'NEW1' } } }));
  expect(await uploadBlob(new Uint8Array([1]), 'image/png', cfg(f1 as never))).toBe('NEW1');
  expect(f1).toHaveBeenCalledWith('https://pub/v1/blobs?epochs=50', expect.objectContaining({ method: 'PUT' }));
  const f2 = vi.fn(async () => ok({ alreadyCertified: { blobId: 'OLD1' } }));
  expect(await uploadBlob(new Uint8Array([1]), 'image/png', cfg(f2 as never))).toBe('OLD1');
});

test('retries three times then throws', async () => {
  const f = vi.fn(async () => new Response('busy', { status: 503 }));
  await expect(uploadBlob(new Uint8Array([1]), 'image/png', cfg(f as never))).rejects.toThrow(/Walrus/);
  expect(f).toHaveBeenCalledTimes(3);
});

test('blobUrl points at the aggregator', () => {
  expect(blobUrl('abc', { aggregator: 'https://agg' })).toBe('https://agg/v1/blobs/abc');
});

const multi = (fetch: typeof globalThis.fetch) => ({ publisher: 'https://pub1, https://pub2,https://pub3', aggregator: 'https://agg', epochs: 50, fetch, sleep: async () => {} });

test('falls back to the next publisher when one is out of WAL', async () => {
  const f = vi.fn(async (url: string) => url.startsWith('https://pub1')
    ? new Response('{"error":{"message":"could not find WAL coins with sufficient balance"}}', { status: 500 })
    : ok({ newlyCreated: { blobObject: { blobId: 'FROM2' } } }));
  expect(await uploadBlob(new Uint8Array([1]), 'image/png', multi(f as never))).toBe('FROM2');
  expect(f.mock.calls.map((c) => (c as unknown as [string])[0])).toEqual(['https://pub1/v1/blobs?epochs=50', 'https://pub2/v1/blobs?epochs=50']);
});

test('a publisher that hangs or drops the connection is skipped, with a timeout on every request', async () => {
  const f = vi.fn(async (url: string, init: RequestInit) => {
    expect(init.signal).toBeDefined();
    if (url.startsWith('https://pub1')) throw new DOMException('timed out', 'TimeoutError');
    return ok({ alreadyCertified: { blobId: 'OK' } });
  });
  expect(await uploadBlob(new Uint8Array([1]), 'image/png', multi(f as never))).toBe('OK');
});

test('when every publisher fails, one error says so', async () => {
  const f = vi.fn(async () => new Response('nope', { status: 500 }));
  await expect(uploadBlob(new Uint8Array([1]), 'image/png', multi(f as never))).rejects.toThrow(/all 3 publishers/);
  expect(f).toHaveBeenCalledTimes(3);
});
