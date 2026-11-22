import { bcs } from '@mysten/sui/bcs';
import type { ClientWithCoreApi } from '@mysten/sui/client';
import { TESTNET } from './deployments';
import { gql, type EventPage } from './earn';

type Node = EventPage['nodes'][number];
const B = (x: string | undefined) => BigInt(x ?? '0');
const sum = (ns: Node[], k: string) => ns.reduce((a, n) => a + B(n.contents.json[k]), 0n);

/** All events of `type` in the last 7 days (paged, newest first). */
export async function readWeekNodes(type: string, now = Date.now(), maxPages = 20): Promise<Node[]> {
  const since = now - 7 * 86_400_000;
  const out: Node[] = [];
  let before: string | undefined;
  for (let i = 0; i < maxPages; i++) {
    const { events: p } = await gql<{ events: EventPage }>(`{ events(last: 50${before ? `, before: "${before}"` : ''}, filter: { type: "${type}" }) { nodes { timestamp contents { json } } pageInfo { hasPreviousPage startCursor } } }`);
    let old = false;
    for (const n of p.nodes) { if (Date.parse(n.timestamp) >= since) out.push(n); else old = true; }
    if (old || !p.pageInfo.hasPreviousPage || !p.pageInfo.startCursor) break;
    before = p.pageInfo.startCursor;
  }
  return out;
}

export type WeekEvents = { eggs: Node[]; hatches: Node[]; merges: Node[]; sales: Node[]; claims: Node[]; synced: Node[]; sold: Node[] };

/** This week's activity, from events. */
export function weekSummary(e: WeekEvents) {
  return {
    eggsBought: e.eggs.length, eggRevenue: sum(e.eggs, 'paid_mist'),
    hatches: e.hatches.length, merges: e.merges.length,
    marketSales: e.sales.length, marketVolume: sum(e.sales, 'price'),
    claimed: sum(e.claims, 'amount'), sharedOut: sum(e.synced, 'amount'),
    treasuryBuys: e.sold.length, treasuryPaid: sum(e.sold, 'paid'),
  };
}

export async function readWeekEvents(): Promise<WeekEvents> {
  const T = TESTNET;
  const safe = (t: string) => readWeekNodes(t).catch(() => [] as Node[]);
  const [eggs, hatches, merges, sales, claimsNew, claimsOld, synced, sold] = await Promise.all([
    safe(`${T.shopTypesId}::shop::EggBought`), safe(`${T.packageId}::yeti::Hatched`), safe(`${T.shopTypesId}::merge::Merged`),
    safe(`${T.earnTypesId}::market::Sold`), safe(`${T.lodgeV2TypesId}::lodge::ClaimedAll`), safe(`${T.earnTypesId}::lodge::Claimed`),
    safe(`${T.earnTypesId}::lodge::Synced`), safe(`${T.earnTypesId}::earn::SoldToTreasury`),
  ]);
  return { eggs, hatches, merges, sales, claims: [...claimsNew, ...claimsOld], synced, sold };
}

const RegistryBcs = bcs.struct('Registry', { id: bcs.Address, profiles: bcs.struct('Table', { id: bcs.Address, size: bcs.u64() }) });
const GameConfigBcs = bcs.struct('GameConfig', { id: bcs.Address, attestor_pk: bcs.vector(bcs.u8()), paused: bcs.bool(), version: bcs.u64() });

/** Number of players (profiles in the registry). */
export async function readPlayerCount(client: ClientWithCoreApi): Promise<number> {
  const { object } = await client.core.getObject({ objectId: TESTNET.registryId, include: { content: true } });
  return Number(RegistryBcs.parse(object.content).profiles.size);
}

export async function readPaused(client: ClientWithCoreApi): Promise<boolean> {
  const { object } = await client.core.getObject({ objectId: TESTNET.gameConfigId, include: { content: true } });
  return GameConfigBcs.parse(object.content).paused;
}
