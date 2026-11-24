/* eslint-disable @typescript-eslint/no-explicit-any */
import { Transaction, coinWithBalance } from '@mysten/sui/transactions';
import type { SuiGrpcClient } from '@mysten/sui/grpc';
import { TESTNET } from '@flurry/shared';
import { WORKER_URL } from '../config';

const L = (s: string) => `${TESTNET.latestPackageId}::${s}`;
const tx1 = (f: (tx: Transaction) => void) => { const tx = new Transaction(); f(tx); return tx; };

export const buildSetPaused = (cap: string, paused: boolean) => tx1((tx) => tx.moveCall({ target: L('config::set_paused'), arguments: [tx.object(TESTNET.gameConfigId), tx.object(cap), tx.pure.bool(paused)] }));
export const buildSetShopPrices = (cap: string, p: { egg: bigint; elementEgg: bigint; snowflakeEgg: number; mergeFee: bigint; skipPerMin: bigint }) =>
  tx1((tx) => tx.moveCall({ target: L('shop::set_prices'), arguments: [tx.object(TESTNET.shopId), tx.object(cap), tx.pure.u64(p.egg), tx.pure.u64(p.elementEgg), tx.pure.u64(p.snowflakeEgg), tx.pure.u64(p.mergeFee), tx.pure.u64(p.skipPerMin)] }));
export const buildSetExtraPlayPrice = (cap: string, price: bigint) => tx1((tx) => tx.moveCall({ target: L('shop::set_extra_play_price'), arguments: [tx.object(TESTNET.shopId), tx.object(cap), tx.pure.u64(price)] }));
export const buildSetSplit = (cap: string, reserveBps: number, potBps: number) => tx1((tx) => tx.moveCall({ target: L('shop::set_split'), arguments: [tx.object(TESTNET.shopId), tx.object(cap), tx.pure.u64(reserveBps), tx.pure.u64(potBps)] }));
export const buildSetTreasuryPrices = (cap: string, table: bigint[], capBps: number) => tx1((tx) => tx.moveCall({ target: L('earn::set_prices'), arguments: [tx.object(TESTNET.shopId), tx.object(cap), tx.pure.vector('u64', table), tx.pure.u64(capBps)] }));
export const buildSetRoyalty = (cap: string, bps: number) => tx1((tx) => tx.moveCall({ target: L('market::set_royalty'), arguments: [tx.object(TESTNET.marketId), tx.object(cap), tx.pure.u64(bps)] }));
export const buildSetLodge = (cap: string, weights: number[], lockMs: number) => tx1((tx) => tx.moveCall({ target: L('lodge::set_params'), arguments: [tx.object(TESTNET.lodgeId), tx.object(cap), tx.pure.vector('u64', weights.map(BigInt)), tx.pure.u64(lockMs)] }));
export const buildFund = (to: 'reserve' | 'pot', amount: bigint) => tx1((tx) => tx.moveCall({ target: L(to === 'reserve' ? 'shop::fund_reserve' : 'shop::fund_pot'), arguments: [tx.object(TESTNET.shopId), coinWithBalance({ balance: amount, useGasCoin: false })] }));
export const buildWithdrawToMe = (cap: string, amount: bigint) => tx1((tx) => tx.moveCall({ target: L('admin::withdraw_to_me'), arguments: [tx.object(TESTNET.shopId), tx.object(cap), tx.pure.u64(amount)] }));
export const buildGiftSnowflakes = (cap: string, to: string, amount: bigint, note: string) => tx1((tx) => tx.moveCall({ target: L('admin::gift_snowflakes'), arguments: [tx.object(cap), tx.pure.address(to), tx.pure.u64(amount), tx.pure.string(note)] }));
export const buildGiftEgg = (cap: string, to: string, element: number) => tx1((tx) => tx.moveCall({ target: L('admin::gift_egg'), arguments: [tx.object(cap), tx.pure.address(to), tx.pure.u8(element)] }));
/** The player claims a Snowflake gift into their profile. */
export const buildRedeemGift = (giftId: string, profileId: string) => tx1((tx) => tx.moveCall({ target: L('admin::redeem_snowflakes'), arguments: [tx.object(giftId), tx.object(profileId)] }));

const B = (x: any) => BigInt(x ?? 0);
export function parseAdminStats(j: any) {
  return {
    at: Number(j.at), players: Number(j.players), testAccounts: Number(j.testAccounts ?? 0), paused: !!j.paused,
    week: { ...j.week, eggRevenue: B(j.week.eggRevenue), marketVolume: B(j.week.marketVolume), claimed: B(j.week.claimed), sharedOut: B(j.week.sharedOut), treasuryPaid: B(j.week.treasuryPaid) },
    money: Object.fromEntries(Object.entries(j.money).map(([k, v]) => [k, B(v)])) as Record<'opsTreasury' | 'reserve' | 'pot' | 'lodgeRewards' | 'claimedAllTime', bigint>,
    settings: { ...j.settings, eggPrice: B(j.settings.eggPrice), elementEggPrice: B(j.settings.elementEggPrice), mergeFee: B(j.settings.mergeFee), skipPerMin: B(j.settings.skipPerMin), extraPlayPrice: B(j.settings.extraPlayPrice), treasuryPrices: j.settings.treasuryPrices.map(B) },
    lodge: j.lodge, market: j.market,
    health: { ...j.health, gasCoins: j.health.gasCoins.map((c: any) => ({ id: c.id, balance: B(c.balance) })), gasTotal: B(j.health.gasTotal), sponsorBalance: B(j.health.sponsorBalance) },
    feed: j.feed as { at: string; kind: string; text: string }[],
  };
}
export type AdminStats = ReturnType<typeof parseAdminStats>;

export async function fetchAdminStats(fresh = false): Promise<AdminStats> {
  const r = await fetch(`${WORKER_URL}/admin/stats${fresh ? '?fresh=1' : ''}`);
  if (!r.ok) throw new Error('admin stats unavailable');
  return parseAdminStats(await r.json());
}

/** The admin key this player holds (if any). */
export async function getMyAdminCap(client: SuiGrpcClient, owner: string): Promise<string | null> {
  try {
    const { objects } = await client.core.listOwnedObjects({ owner, type: `${TESTNET.packageId}::config::AdminCap` });
    return objects[0]?.objectId ?? null;
  } catch { return null; }
}

export type Gift = { id: string; amount: bigint; note: string };
/** Snowflake gifts waiting in the player's wallet. */
export async function getMyGifts(client: SuiGrpcClient, owner: string): Promise<Gift[]> {
  const { bcs } = await import('@mysten/sui/bcs');
  const G = bcs.struct('SnowflakeGift', { id: bcs.Address, amount: bcs.u64(), note: bcs.string() });
  try {
    const { objects } = await client.core.listOwnedObjects({ owner, type: `${TESTNET.adminTypesId}::admin::SnowflakeGift`, include: { content: true } });
    return objects.map((o: any) => { const g = G.parse(o.content); return { id: o.objectId, amount: BigInt(g.amount), note: g.note }; });
  } catch { return []; }
}

/** Admin sends SUI from their wallet to the game's gas sponsor. */
export const buildFundSponsor = (cap: string, amount: bigint, sponsor: string) => tx1((tx) => tx.moveCall({ target: L('admin::fund_sponsor'), arguments: [tx.object(cap), coinWithBalance({ balance: amount, useGasCoin: false }), tx.pure.address(sponsor)] }));
/** Mark (or unmark) an account as a test account so stats count real players only. */
export const buildMarkTest = (cap: string, who: string, isTest: boolean) => tx1((tx) => tx.moveCall({ target: L('config::mark_test_account'), arguments: [tx.object(TESTNET.registryId), tx.object(cap), tx.pure.address(who), tx.pure.bool(isTest)] }));

export type PlayerRow = { address: string; profileId: string; nickname: string | null; element: number; snowflakes: bigint; streak: number; eggs: number; yetis: number; sui: bigint; staked: number; listed: number; isTest: boolean; lastActive: string | null };
export type PlayerDetail = { address: string; sui: bigint; eggs: { id: string; element: number; stages: number }[]; yetis: { id: string; name: string; level: number; element: number }[]; activity: { digest: string; at: string; ok: boolean; text: string; sui: bigint }[] };

export async function fetchPlayers(fresh = false): Promise<{ total: number; real: number; players: PlayerRow[] }> {
  const r = await fetch(`${WORKER_URL}/admin/players${fresh ? '?fresh=1' : ''}`);
  if (!r.ok) throw new Error('players unavailable');
  const j: any = await r.json();
  return { total: j.total, real: j.real, players: j.players.map((p: any) => ({ ...p, snowflakes: B(p.snowflakes), sui: B(p.sui) })) };
}

export async function fetchPlayer(address: string, fresh = false): Promise<PlayerDetail> {
  const r = await fetch(`${WORKER_URL}/admin/player/${address}${fresh ? '?fresh=1' : ''}`);
  if (!r.ok) throw new Error('player unavailable');
  const j: any = await r.json();
  return { ...j, sui: B(j.sui), activity: j.activity.map((a: any) => ({ ...a, sui: B(a.sui) })) };
}

export async function refillGasPool(): Promise<{ added: number; reason?: string }> {
  const r = await fetch(`${WORKER_URL}/admin/gas/refill`, { method: 'POST' });
  return r.json();
}

/**
 * Roughly how many player transactions the gas pool can still pay for (and with the spare SUI
 * split into coins), at the recent average cost, and how many days that lasts at the current pace.
 */
export function gasRunway(o: { pool: bigint; spare: bigint; avgPerTx: number; txPerDay: number }): { poolTxs: number; totalTxs: number; days: number | null } | null {
  if (!(o.avgPerTx > 0)) return null;
  const poolTxs = Math.floor(Number(o.pool) / o.avgPerTx);
  const totalTxs = Math.floor(Number(o.pool + (o.spare > 0n ? o.spare : 0n)) / o.avgPerTx);
  return { poolTxs, totalTxs, days: o.txPerDay > 0 ? Math.floor(totalTxs / o.txPerDay) : null };
}
