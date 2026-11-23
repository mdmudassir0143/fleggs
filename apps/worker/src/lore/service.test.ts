import { beforeEach, describe, expect, test, vi } from 'vitest';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromBase64 } from '@mysten/sui/utils';
import { encodeLore } from '@flurry/shared';
import { MemoryKV } from '../runs';
import { createLoreService, LoreUnavailable } from './service';

const YETI = '0x' + '0c'.repeat(32);
const hatched = { yetiId: YETI, owner: '0x' + '0b'.repeat(32), element: 2, variants: [9, 2, 13], mutated: true };
const signer = Ed25519Keypair.fromSecretKey(new Uint8Array(32).fill(5));

function setup(over: Partial<Parameters<typeof createLoreService>[0]> = {}) {
  const uploads: Array<{ bytes: Uint8Array; type: string }> = [];
  const deps = {
    kv: new MemoryKV(),
    chain: {
      getHatched: vi.fn(async (d: string) => (d === 'HATCH' ? hatched : d === 'MERGE' ? { ...hatched, yetiId: '0x' + '0e'.repeat(32), level: 2, elements: [1, 3], variants: [9, 2, 13, 4] } : null)),
      getUnnamedYeti: vi.fn(async (id: string) => (id === YETI ? { yetiId: YETI, owner: hatched.owner, element: 2, variants: [9, 2, 13], mutated: true, named: false } : { yetiId: id, owner: '0x1', element: 0, variants: [1, 1, 1], mutated: false, named: true })),
    },
    ai: { run: vi.fn(async () => ({ response: '{"name":"Moss","story":"Moss paints the sky green."}' })) },
    upload: vi.fn(async (bytes: Uint8Array, type: string) => { uploads.push({ bytes, type }); return `B${uploads.length}`; }),
    blobUrl: (id: string) => `https://agg/v1/blobs/${id}`,
    render: vi.fn(async () => new Uint8Array([0x89, 0x50, 0x4e, 0x47])),
    signer,
    now: () => 1_000_000,
    ...over,
  };
  return { svc: createLoreService(deps), deps, uploads };
}

describe('lore service', () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => { ctx = setup(); });

  test('hatch digest → AI lore, card PNG uploaded, signed attestation', async () => {
    const r = await ctx.svc.lore('HATCH');
    expect(r).toMatchObject({ yetiId: YETI, name: 'Moss', story: 'Moss paints the sky green.', cardBlob: 'B1', loreBlob: 'B2', cardUrl: 'https://agg/v1/blobs/B1' });
    expect(ctx.uploads[0].type).toBe('image/png');
    const msg = encodeLore({ yetiId: YETI, name: 'Moss', loreBlob: 'B2', cardBlob: 'B1', cardUrl: 'https://agg/v1/blobs/B1', expiresMs: BigInt(r.expiresMs) });
    expect(await signer.getPublicKey().verify(msg, fromBase64(r.signature))).toBe(true);
  });

  test('lore JSON blob contains name, story, traits and yetiId', async () => {
    await ctx.svc.lore('HATCH');
    const json = JSON.parse(new TextDecoder().decode(ctx.uploads[1].bytes));
    expect(json).toMatchObject({ yetiId: YETI, name: 'Moss', story: 'Moss paints the sky green.', elements: [2], variants: [9, 2, 13], mutated: true });
    expect(ctx.uploads[1].type).toBe('application/json');
  });

  test('second call returns cached lore', async () => {
    const a = await ctx.svc.lore('HATCH');
    const b = await ctx.svc.lore('HATCH');
    expect(b.name).toBe(a.name);
    expect(ctx.deps.ai.run).toHaveBeenCalledTimes(1);
    expect(ctx.deps.upload).toHaveBeenCalledTimes(2);
  });

  test('non-hatch digest is rejected', async () => {
    await expect(ctx.svc.lore('OTHER')).rejects.toThrow(/not a hatch/);
  });

  test('lore without Walrus returns retryable error', async () => {
    const c = setup({ upload: vi.fn(async () => { throw new Error('Walrus is down'); }) });
    await expect(c.svc.lore('HATCH')).rejects.toBeInstanceOf(LoreUnavailable);
    await expect(c.svc.lore('HATCH')).rejects.toBeInstanceOf(LoreUnavailable);
    expect(c.deps.ai.run).toHaveBeenCalledTimes(1); // the AI result is kept for the retry
  });

  test('an unnamed yeti can be named later from the yeti itself (no hatch digest)', async () => {
    const r = await ctx.svc.loreForYeti(YETI);
    expect(r).toMatchObject({ yetiId: YETI, name: 'Moss', cardBlob: 'B1', loreBlob: 'B2' });
  });

  test('a yeti that already has a name is refused', async () => {
    await expect(ctx.svc.loreForYeti('0x' + '0d'.repeat(32))).rejects.toThrow(/already has a name/);
  });

  test('a merge digest names the child, with its level and both elements', async () => {
    const r = await ctx.svc.lore('MERGE');
    expect(r.yetiId).toBe('0x' + '0e'.repeat(32));
    const prompt = JSON.stringify((ctx.deps.ai.run as ReturnType<typeof vi.fn>).mock.calls.at(-1));
    expect(prompt).toContain('Drifter');
    expect(prompt).toContain('Storm + Ember');
  });
});

