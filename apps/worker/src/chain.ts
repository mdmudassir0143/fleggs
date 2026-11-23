import { SuiGrpcClient } from '@mysten/sui/grpc';
import { EggBcs, ProfileBcs, HatchedBcs, YetiBcs, MergedBcs, TESTNET, readPlays } from '@flurry/shared';
import { normalizeSuiAddress } from '@mysten/sui/utils';

export function createSuiClient() {
  return new SuiGrpcClient({ network: 'testnet', baseUrl: 'https://fullnode.testnet.sui.io:443' });
}

/** Reads a Profile's current attestation nonce from chain. */
export function createChain(client: SuiGrpcClient) {
  return {
    async getNonce(profileId: string): Promise<bigint> {
      const { object } = await client.core.getObject({ objectId: profileId, include: { content: true } });
      return BigInt(ProfileBcs.parse(object.content).nonce);
    },
    async getProfileOwner(profileId: string): Promise<string> {
      const { object } = await client.core.getObject({ objectId: profileId });
      return ownerOf(object.owner);
    },
    getPlays: (profileId: string, game: number) => readPlays(client, profileId, game),
    async getEggs(owner: string): Promise<{ id: string; stages: number }[]> {
      const out: { id: string; stages: number }[] = [];
      let cursor: string | null | undefined;
      do {
        const r = await client.core.listOwnedObjects({ owner, type: `${TESTNET.packageId}::egg::Egg`, include: { content: true }, cursor });
        for (const o of r.objects) out.push({ id: o.objectId, stages: EggBcs.parse(o.content).stage_scores.length });
        cursor = r.hasNextPage ? r.cursor : null;
      } while (cursor);
      return out;
    },
    async getYeti(yetiId: string): Promise<{ owner: string; points: number[] }> {
      const { object } = await client.core.getObject({ objectId: yetiId, include: { content: true } });
      const y = YetiBcs.parse(object.content);
      const points: number[] = [];
      for (const t of y.traits) points[t.slot] = t.points;
      return { owner: ownerOf(object.owner), points };
    },
  };
}

/** Reads the Hatched event from a hatch transaction, or null if the digest isn't one. */
export async function getHatched(client: SuiGrpcClient, digest: string, packageId: string) {
  const res = await client.core.getTransaction({ digest, include: { events: true } });
  const tx = res.Transaction ?? res.FailedTransaction;
  const ev = tx?.events?.find((e) => e.eventType.endsWith('::yeti::Hatched') && normalizeSuiAddress(e.packageId) === normalizeSuiAddress(packageId));
  if (!tx?.status.success) return null;
  if (!ev) {
    // A merge: the Merged event type lives at the package that introduced flurry::merge.
    const m = tx.events?.find((e) => e.eventType === `${normalizeSuiAddress(TESTNET.shopTypesId)}::merge::Merged`);
    if (!m) return null;
    const g = MergedBcs.parse(m.bcs);
    return { yetiId: g.yeti_id, owner: g.owner, element: g.elements[0], elements: g.elements, level: g.level, variants: g.variants, mutated: g.mutated };
  }
  const h = HatchedBcs.parse(ev.bcs);
  return { yetiId: h.yeti_id, owner: h.owner, element: h.element, variants: h.variants, mutated: h.mutated };
}

/** The address that owns an object (address-owned only; anything else can't lend stats). */
function ownerOf(owner: unknown): string {
  const o = owner as { $kind?: string; AddressOwner?: string; ObjectOwner?: string } | undefined;
  if (o?.$kind === 'AddressOwner' && o.AddressOwner) return normalizeSuiAddress(o.AddressOwner);
  throw new Error('object is not owned by an address');
}
