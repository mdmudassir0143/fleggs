import { bcs } from '@mysten/sui/bcs';
import type { ClientWithCoreApi } from '@mysten/sui/client';
import { TESTNET } from './deployments';

/** Free training plays per game per UTC day (mirrors training::FREE_PLAYS). */
export const FREE_PLAYS = 2;
/** Default extra-play price in MIST (0.02 SUI); the live price is on the Shop. */
export const EXTRA_PLAY_PRICE = 20_000_000n;

export const PlaysBcs = bcs.struct('Plays', { day: bcs.u64(), used: bcs.u8(), credits: bcs.u64() });
export type Plays = { day: number; used: number; credits: number };

/** What's left today for one game. */
export function playsLeft(p: Plays | null, day: number) {
  const used = p && p.day === day ? p.used : 0;
  const credits = p?.credits ?? 0;
  const free = Math.max(0, FREE_PLAYS - used);
  return { free, credits, total: free + credits };
}

/** The profile's play counter for a game (dynamic field `PlaysKey { game }`), or null. */
export async function readPlays(client: ClientWithCoreApi, profileId: string, game: number): Promise<Plays | null> {
  try {
    const { dynamicField } = await client.core.getDynamicField({
      parentId: profileId,
      name: { type: `${TESTNET.playsTypesId}::training::PlaysKey`, bcs: bcs.struct('K', { game: bcs.u8() }).serialize({ game }).toBytes() },
    });
    const p = PlaysBcs.parse(dynamicField.value.bcs);
    return { day: Number(p.day), used: p.used, credits: Number(p.credits) };
  } catch {
    return null;
  }
}

/** The live extra-play price (dynamic field on the Shop), falling back to the default. */
export async function readExtraPlayPrice(client: ClientWithCoreApi): Promise<bigint> {
  try {
    const { dynamicField } = await client.core.getDynamicField({
      parentId: TESTNET.shopId,
      name: { type: `${TESTNET.playsTypesId}::shop::ExtraPlayPriceKey`, bcs: new Uint8Array([0]) },
    });
    return BigInt(bcs.u64().parse(dynamicField.value.bcs));
  } catch {
    return EXTRA_PLAY_PRICE;
  }
}
