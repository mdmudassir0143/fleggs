import { bcs } from '@mysten/sui/bcs';
import type { ClientWithCoreApi } from '@mysten/sui/client';
import { TESTNET } from './deployments';

const E = () => TESTNET.earnTypesId;
const EMPTY_KEY = new Uint8Array([0]);
const ACC_SCALE = 10n ** 18n;

export type Treasury = { reserve: bigint; pot: bigint; split: [number, number]; prices: bigint[]; capBps: number };
export const DEFAULT_PRICES = [0n, 0n, 600_000_000n, 1_400_000_000n, 3_000_000_000n, 6_500_000_000n];

const Balance = bcs.struct('Balance', { value: bcs.u64() });
const Split = bcs.struct('Split', { reserve_bps: bcs.u64(), pot_bps: bcs.u64() });
export const ListingBcs = bcs.struct('Listing', { seller: bcs.Address, price: bcs.u64(), listed_ms: bcs.u64(), level: bcs.u8() });
export const StakeBcs = bcs.struct('Stake', { owner: bcs.Address, weight: bcs.u64(), debt: bcs.u128(), owed: bcs.u64(), unlock_ms: bcs.u64(), level: bcs.u8() });
/** A dynamic field object `Field<Key { id: ID }, V>` as stored on chain. */
export const ListingFieldBcs = bcs.struct('LF', { id: bcs.Address, name: bcs.Address, value: ListingBcs });
export const StakeFieldBcs = bcs.struct('SF', { id: bcs.Address, name: bcs.Address, value: StakeBcs });
export const LodgeBcs = bcs.struct('Lodge', {
  id: bcs.Address, total_weight: bcs.u64(), acc: bcs.u128(), rewards: Balance, carry: bcs.u64(),
  weights: bcs.vector(bcs.u64()), unstake_ms: bcs.u64(), count: bcs.u64(),
});

/** What the treasury pays now for a yeti of `level` (same rule as `earn::treasury_price`). */
export function treasuryPrice(t: Treasury, level: number): bigint {
  if (level < 2) return 0n;
  const cap = (t.reserve * BigInt(t.capBps)) / 10_000n;
  const p = t.prices[level] ?? 0n;
  return p < cap ? p : cap;
}

/** A stake's share of `pot` by weight. */
export function estimateShare(weight: number, totalWeight: number, pot: bigint): bigint {
  return totalWeight > 0 ? (pot * BigInt(weight)) / BigInt(totalWeight) : 0n;
}

/** Claimable now: owed + weight × acc − debt (scaled), as `lodge::pending`. */
export function stakePending(s: { weight: number; debt: bigint; owed: bigint }, acc: bigint): bigint {
  return s.owed + (BigInt(s.weight) * acc - s.debt) / ACC_SCALE;
}

async function field<T>(client: ClientWithCoreApi, parentId: string, type: string, parse: (b: Uint8Array) => T, fallback: T): Promise<T> {
  try {
    const { dynamicField } = await client.core.getDynamicField({ parentId, name: { type, bcs: EMPTY_KEY } });
    return parse(dynamicField.value.bcs);
  } catch { return fallback; }
}

export async function readTreasury(client: ClientWithCoreApi): Promise<Treasury> {
  const shop = TESTNET.shopId;
  const [reserve, pot, split, prices, capBps] = await Promise.all([
    field(client, shop, `${E()}::shop::ReserveKey`, (b) => BigInt(Balance.parse(b).value), 0n),
    field(client, shop, `${E()}::shop::PotKey`, (b) => BigInt(Balance.parse(b).value), 0n),
    field(client, shop, `${E()}::shop::SplitKey`, (b) => { const s = Split.parse(b); return [Number(s.reserve_bps), Number(s.pot_bps)] as [number, number]; }, [5000, 3000] as [number, number]),
    field(client, shop, `${E()}::earn::PricesKey`, (b) => bcs.vector(bcs.u64()).parse(b).map(BigInt), DEFAULT_PRICES),
    field(client, shop, `${E()}::earn::CapKey`, (b) => Number(bcs.u64().parse(b)), 200),
  ]);
  return { reserve, pot, split, prices, capBps };
}

export type LodgeState = { totalWeight: number; acc: bigint; weights: number[]; unstakeMs: number; rewards: bigint; count: number; carry: bigint };

export async function readLodge(client: ClientWithCoreApi): Promise<LodgeState> {
  const { object } = await client.core.getObject({ objectId: TESTNET.lodgeId, include: { content: true } });
  const l = LodgeBcs.parse(object.content);
  return { totalWeight: Number(l.total_weight), acc: BigInt(l.acc), weights: l.weights.map(Number), unstakeMs: Number(l.unstake_ms), rewards: BigInt(l.rewards.value), count: Number(l.count), carry: BigInt(l.carry) };
}

/** Field objects whose key type ends with `keySuffix`, decoded in batches. */
async function fieldsOf<T>(client: ClientWithCoreApi, parentId: string, keySuffix: string, parse: (b: Uint8Array) => T): Promise<T[]> {
  const ids: string[] = [];
  let cursor: string | null | undefined = null;
  do {
    const r = await client.core.listDynamicFields({ parentId, cursor: cursor ?? undefined } as never) as { dynamicFields: { fieldId: string; name: { type: string } }[]; cursor?: string | null; hasNextPage?: boolean };
    for (const f of r.dynamicFields) if (f.name.type.endsWith(keySuffix)) ids.push(f.fieldId);
    cursor = r.hasNextPage ? r.cursor : null;
  } while (cursor);
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const { objects } = await client.core.getObjects({ objectIds: ids.slice(i, i + 50), include: { content: true } });
    for (const o of objects) if (!(o instanceof Error) && o.content) out.push(parse(o.content));
  }
  return out;
}

export type ListingInfo = { id: string; seller: string; price: bigint; listedMs: number; level: number };

export async function readListings(client: ClientWithCoreApi): Promise<ListingInfo[]> {
  const rows = await fieldsOf(client, TESTNET.marketId, '::market::ListingKey', (b) => ListingFieldBcs.parse(b));
  return rows.map((r) => ({ id: r.name, seller: r.value.seller, price: BigInt(r.value.price), listedMs: Number(r.value.listed_ms), level: r.value.level }));
}

export type StakeInfo = { id: string; owner: string; weight: number; debt: bigint; owed: bigint; unlockMs: number; level: number };

export async function readStakes(client: ClientWithCoreApi, owner?: string): Promise<StakeInfo[]> {
  const rows = await fieldsOf(client, TESTNET.lodgeId, '::lodge::StakeKey', (b) => StakeFieldBcs.parse(b));
  return rows
    .map((r) => ({ id: r.name, owner: r.value.owner, weight: Number(r.value.weight), debt: BigInt(r.value.debt), owed: BigInt(r.value.owed), unlockMs: Number(r.value.unlock_ms), level: r.value.level }))
    .filter((s) => !owner || s.owner === owner);
}

export type LodgeAccount = { owed: bigint; lastClaimMs: number };
export type LodgeTotals = { claimed: bigint; forfeited: bigint };
const AccountBcs = bcs.struct('Account', { owed: bcs.u64(), last_claim_ms: bcs.u64() });
const TotalsBcs = bcs.struct('Totals', { claimed: bcs.u64(), forfeited: bcs.u64() });

/** A player's kept rewards and last claim time (one claim per 24 h). */
export async function readAccount(client: ClientWithCoreApi, owner: string): Promise<LodgeAccount> {
  try {
    const { dynamicField } = await client.core.getDynamicField({
      parentId: TESTNET.lodgeId,
      name: { type: `${TESTNET.lodgeV2TypesId}::lodge::AccountKey`, bcs: bcs.struct('K', { owner: bcs.Address }).serialize({ owner }).toBytes() },
    });
    const a = AccountBcs.parse(dynamicField.value.bcs);
    return { owed: BigInt(a.owed), lastClaimMs: Number(a.last_claim_ms) };
  } catch { return { owed: 0n, lastClaimMs: 0 }; }
}

/** All-time claimed by players, and forfeited back to stakers. */
export async function readTotals(client: ClientWithCoreApi): Promise<LodgeTotals> {
  return field(client, TESTNET.lodgeId, `${TESTNET.lodgeV2TypesId}::lodge::TotalsKey`, (b) => { const t = TotalsBcs.parse(b); return { claimed: BigInt(t.claimed), forfeited: BigInt(t.forfeited) }; }, { claimed: 0n, forfeited: 0n });
}

/**
 * What a player can claim now (stakes past their 24 h + kept rewards), what's still locked, and
 * whether their once-a-day claim is open. Mirrors `lodge::claim_all`.
 */
export function claimableFor(stakes: Pick<StakeInfo, 'weight' | 'debt' | 'owed' | 'unlockMs'>[], acc: bigint, account: LodgeAccount, now: number, intervalMs: number) {
  let ready = account.owed, locked = 0n, unlocksAt = 0;
  for (const s of stakes) {
    if (s.weight === 0) { ready += s.owed; continue; }
    const p = stakePending(s, acc);
    if (now >= s.unlockMs) ready += p;
    else { locked += p; unlocksAt = unlocksAt === 0 ? s.unlockMs : Math.min(unlocksAt, s.unlockMs); }
  }
  const nextClaimAt = account.lastClaimMs ? account.lastClaimMs + intervalMs : 0;
  return { now: ready, locked, unlocksAt, nextClaimAt, canClaim: ready > 0n && (nextClaimAt === 0 || now >= nextClaimAt) };
}

export type EventPage = { nodes: { timestamp: string; contents: { json: Record<string, string> } }[]; pageInfo: { hasPreviousPage: boolean; startCursor: string | null } };

/** Sum of `amount` over events since `sinceMs`, paging backwards (newest first) until it passes that time. */
export async function sumSince(page: (before?: string) => Promise<EventPage>, sinceMs: number, maxPages = 40): Promise<bigint> {
  let total = 0n, before: string | undefined;
  for (let i = 0; i < maxPages; i++) {
    const p = await page(before);
    let reachedOld = false;
    for (const n of p.nodes) {
      if (Date.parse(n.timestamp) >= sinceMs) total += BigInt(n.contents.json.amount ?? '0');
      else reachedOld = true;
    }
    if (reachedOld || !p.pageInfo.hasPreviousPage || !p.pageInfo.startCursor) break;
    before = p.pageInfo.startCursor;
  }
  return total;
}

export const GRAPHQL_URL = 'https://graphql.testnet.sui.io/graphql';
type EvNode = { timestamp: string; contents: { json: Record<string, string> } };

export async function gql<T>(query: string, f: typeof fetch = fetch): Promise<T> {
  const r = await f(GRAPHQL_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query }) });
  const j = (await r.json()) as { data?: T; errors?: { message: string }[] };
  if (j.errors?.length || !j.data) throw new Error(j.errors?.[0]?.message ?? 'GraphQL error');
  return j.data;
}

/** Sum of `amount` in events of `type` over the last 7 days (paged). */
export async function readWeekSum(type: string, now = Date.now()): Promise<bigint> {
  return sumSince((before) => gql<{ events: EventPage }>(
    `{ events(last: 50${before ? `, before: "${before}"` : ''}, filter: { type: "${type}" }) { nodes { timestamp contents { json } } pageInfo { hasPreviousPage startCursor } } }`,
  ).then((d) => d.events), now - 7 * 86_400_000);
}

/** Paid into the stakers' pool in the last 7 days (Synced events). */
export const readWeekSynced = (now = Date.now()) => readWeekSum(`${TESTNET.earnTypesId}::lodge::Synced`, now);

/** Claimed by stakers in the last 7 days: daily claims (ClaimedAll) plus claims under the first rules (Claimed). */
export async function readWeekClaimed(now = Date.now()): Promise<bigint> {
  const [a, b] = await Promise.all([
    readWeekSum(`${TESTNET.lodgeV2TypesId}::lodge::ClaimedAll`, now).catch(() => 0n),
    readWeekSum(`${TESTNET.earnTypesId}::lodge::Claimed`, now).catch(() => 0n),
  ]);
  return a + b;
}

/** Recent market sales (newest 50). */
export async function readSales(): Promise<{ level: number; price: bigint; at: number }[]> {
  const d = await gql<{ events: { nodes: EvNode[] } }>(`{ events(last: 50, filter: { type: "${TESTNET.earnTypesId}::market::Sold" }) { nodes { timestamp contents { json } } } }`);
  return d.events.nodes.map((n) => ({ level: Number(n.contents.json.level), price: BigInt(n.contents.json.price), at: Date.parse(n.timestamp) }));
}
