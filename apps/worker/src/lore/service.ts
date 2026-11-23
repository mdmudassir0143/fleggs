import type { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { toBase64 } from '@mysten/sui/utils';
import { cardSvg } from '@flurry/art';
import { signLore, ATTESTATION_TTL_MS } from '@flurry/shared';
import type { KVLike } from '../runs';
import { RunError } from '../runs';
import { generateLore, type AiLike } from './generate';

/** A newly made yeti: from a Hatched event (level 1) or a Merged event (level 2–5, maybe hybrid). */
export type Hatched = { yetiId: string; owner: string; element: number; variants: number[]; mutated: boolean; level?: number; elements?: number[] };

export type LoreResult = {
  yetiId: string;
  name: string;
  story: string;
  loreBlob: string;
  cardBlob: string;
  cardUrl: string;
  expiresMs: string;
  signature: string;
};

/** Walrus (or rendering) failed; the client can retry and the AI result is kept. */
export class LoreUnavailable extends Error {}

type Stored = { name: string; story: string; loreBlob?: string; cardBlob?: string };

export function createLoreService(deps: {
  kv: KVLike;
  chain: {
    getHatched(digest: string): Promise<Hatched | null>;
    /** Reads a yeti object directly (for naming a yeti whose hatch-time naming never finished). */
    getUnnamedYeti?(yetiId: string): Promise<(Hatched & { named: boolean }) | null>;
  };
  ai: AiLike;
  upload(bytes: Uint8Array, contentType: string): Promise<string>;
  blobUrl(blobId: string): string;
  render(svg: string): Promise<Uint8Array>;
  signer: Ed25519Keypair;
  now(): number;
}) {
  const key = (yetiId: string) => `lore:${yetiId}`;

  async function loreFor(h: Hatched): Promise<LoreResult> {
      const spec = { level: h.level ?? 1, elements: h.elements ?? [h.element], variants: h.variants };

      const raw = await deps.kv.get(key(h.yetiId));
      let stored: Stored = raw ? JSON.parse(raw) : null;
      if (!stored) {
        const gen = await generateLore({ yetiId: h.yetiId, elements: spec.elements, variants: h.variants, mutated: h.mutated, level: spec.level }, deps.ai);
        stored = { name: gen.name, story: gen.story };
        await deps.kv.put(key(h.yetiId), JSON.stringify(stored));
      }

      if (!stored.cardBlob || !stored.loreBlob) {
        try {
          const png = await deps.render(cardSvg(spec, stored));
          const cardBlob = await deps.upload(png, 'image/png');
          const loreJson = { yetiId: h.yetiId, name: stored.name, story: stored.story, elements: spec.elements, variants: h.variants, mutated: h.mutated };
          const loreBlob = await deps.upload(new TextEncoder().encode(JSON.stringify(loreJson)), 'application/json');
          stored = { ...stored, cardBlob, loreBlob };
          await deps.kv.put(key(h.yetiId), JSON.stringify(stored));
        } catch (e) {
          console.error('[lore] card render/upload failed', h.yetiId, (e as Error).message);
          throw new LoreUnavailable((e as Error).message);
        }
      }

      const cardUrl = deps.blobUrl(stored.cardBlob!);
      const expiresMs = BigInt(deps.now() + ATTESTATION_TTL_MS);
      const { signature } = await signLore(
        { yetiId: h.yetiId, name: stored.name, loreBlob: stored.loreBlob!, cardBlob: stored.cardBlob!, cardUrl, expiresMs },
        deps.signer,
      );
      return {
        yetiId: h.yetiId, name: stored.name, story: stored.story, loreBlob: stored.loreBlob!, cardBlob: stored.cardBlob!,
        cardUrl, expiresMs: expiresMs.toString(), signature: toBase64(signature),
      };
  }

  return {
    /** Names a freshly hatched yeti, stores its card and lore on Walrus, and signs the result. */
    async lore(digest: string): Promise<LoreResult> {
      const h = await deps.chain.getHatched(digest);
      if (!h) throw new RunError('not a hatch transaction');
      return loreFor(h);
    },
    /** Names a yeti later from the yeti itself, if naming at hatch time never finished. */
    async loreForYeti(yetiId: string): Promise<LoreResult> {
      const y = await deps.chain.getUnnamedYeti?.(yetiId);
      if (!y) throw new RunError('unknown yeti');
      if (y.named) throw new RunError('this yeti already has a name');
      return loreFor(y);
    },
  };
}
