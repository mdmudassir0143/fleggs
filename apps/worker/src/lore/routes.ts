import { Hono } from 'hono';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { TESTNET, YetiBcs } from '@flurry/shared';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { createSuiClient, getHatched } from '../chain';
import type { Env } from '../env';
import { renderPng } from './assets';
import { createLoreService, LoreUnavailable } from './service';
import { blobUrl, uploadBlob } from './walrus';

export const lore = new Hono<{ Bindings: Env }>();

function service(env: Env) {
  const walrus = { publisher: env.WALRUS_PUBLISHER, aggregator: env.WALRUS_AGGREGATOR, epochs: Number(env.WALRUS_EPOCHS) };
  const client = createSuiClient();
  return createLoreService({
    kv: env.RUNS,
    chain: {
      getHatched: (d) => getHatched(client, d, TESTNET.packageId),
      async getUnnamedYeti(yetiId: string) {
        const { object } = await client.core.getObject({ objectId: yetiId, include: { content: true } });
        const y = YetiBcs.parse(object.content);
        const owner = (object.owner as { AddressOwner?: string })?.AddressOwner ?? '';
        const variants = y.traits.map((t) => t.variant);
        return { yetiId, owner: normalizeSuiAddress(owner), element: y.elements[0] ?? 0, variants, mutated: variants.some((v) => v >= 12), named: y.lore_blob !== null };
      },
    },
    ai: env.AI as never,
    upload: (bytes, type) => uploadBlob(bytes, type, walrus),
    blobUrl: (id) => blobUrl(id, walrus),
    render: renderPng,
    signer: Ed25519Keypair.fromSecretKey(env.ATTESTOR_SK),
    now: () => Date.now(),
  });
}

const UNAVAILABLE = 'Your yeti hatched, but its card could not be saved yet. Try "Save to my yeti" in a moment.';

lore.post('/lore', async (c) => {
  const { digest } = await c.req.json<{ digest: string }>();
  try {
    return c.json(await service(c.env).lore(digest));
  } catch (e) {
    if (e instanceof LoreUnavailable) return c.json({ error: UNAVAILABLE, retryable: true }, 503);
    throw e;
  }
});

/** Names a yeti whose hatch-time naming never finished. */
lore.post('/lore/yeti', async (c) => {
  const { yetiId } = await c.req.json<{ yetiId: string }>();
  try {
    return c.json(await service(c.env).loreForYeti(yetiId));
  } catch (e) {
    if (e instanceof LoreUnavailable) {
      return c.json({ error: UNAVAILABLE, retryable: true }, 503);
    }
    throw e;
  }
});
