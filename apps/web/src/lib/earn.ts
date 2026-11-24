import { sui } from './merge';
import { estimateShare, treasuryPrice, type ListingInfo, type LodgeState, type StakeInfo, type Treasury } from '@flurry/shared';
import type { Held, Yeti } from './flurry';

export type Sale = { level: number; price: bigint; at: number };

/** Price hints for listing a yeti: what the treasury pays, the cheapest same-level listing, the latest same-level sale. */
export function listSuggestions(level: number, treasury: bigint, listings: ListingInfo[], sales: Sale[]) {
  const same = listings.filter((l) => l.level === level).map((l) => l.price);
  const floor = same.length ? same.reduce((a, b) => (b < a ? b : a)) : null;
  const lastSale = sales.filter((s) => s.level === level).sort((a, b) => b.at - a.at)[0];
  return { treasury, floor, last: lastSale ? lastSale.price : null };
}

/**
 * The three ways to cash in a yeti, in numbers. The stake estimate is forward-looking: its share of a
 * week like this one (`weekPot`). Pot already waiting goes to current stakers when you stake — except
 * when nobody is staked, then the first staker gets the waiting pot and carry.
 */
export function cashInOptions(y: Yeti, t: Treasury, lodge: LodgeState, weekPot: bigint) {
  const weight = lodge.weights[y.level] ?? 0;
  const first = lodge.totalWeight === 0;
  return {
    sellNow: treasuryPrice(t, y.level),
    stakeWeight: weight,
    weeklyEstimate: !weight ? 0n : first ? t.pot + (lodge.carry ?? 0n) : estimateShare(weight, lodge.totalWeight + weight, weekPot),
    firstStaker: first,
  };
}

/** Where a yeti is right now. */
export function yetiHolding(yetiId: string, snap: { yetis: { id: string }[]; held?: Held[] }): 'wallet' | Held['where'] | null {
  if (snap.yetis.some((y) => y.id === yetiId)) return 'wallet';
  return snap.held?.find((h) => h.yeti.id === yetiId)?.where ?? null;
}

/** "0.25" → 250_000_000n MIST; null for anything not a positive amount with ≤ 9 decimals. */
export function parseSui(text: string): bigint | null {
  const m = /^\s*(\d+)(?:\.(\d{1,9}))?\s*$/.exec(text);
  if (!m) return null;
  const v = BigInt(m[1]) * 1_000_000_000n + BigInt((m[2] ?? '').padEnd(9, '0') || '0');
  return v > 0n ? v : null;
}

export { sumSince } from '@flurry/shared';

/** Confirmation rows for changing a listing's price, plus a warning when it's below what the treasury pays. */
export function repriceSummary(oldPrice: bigint, newPrice: bigint, royaltyBps: number, treasury: bigint) {
  const fee = (newPrice * BigInt(royaltyBps)) / 10_000n;
  const rows: [string, string][] = [['Was', sui(oldPrice)], ['New price', sui(newPrice)], [`Fee (${royaltyBps / 100}%)`, sui(fee)], ['You get when it sells', sui(newPrice - fee)]];
  const warning = treasury > 0n && newPrice - fee < treasury ? `That's less than selling it now: the treasury pays ${sui(treasury)}.` : null;
  return { rows, warning };
}

/** The market as a buyer sees it: other players' listings, cheapest first, optionally one level, and each level's floor. */
export function marketView<T extends ListingInfo>(listings: T[], me: string, level: number | null) {
  const others = listings.filter((l) => l.seller.toLowerCase() !== me.toLowerCase()).sort((a, b) => (a.price < b.price ? -1 : a.price > b.price ? 1 : 0));
  const floors: Record<number, bigint> = {};
  for (const l of others) if (floors[l.level] === undefined) floors[l.level] = l.price;
  return { items: level === null ? others : others.filter((l) => l.level === level), floors };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export type EarnState = {
  at: number; treasury: Treasury; lodge: LodgeState; listings: ListingInfo[]; stakes: StakeInfo[];
  totals: { claimed: bigint; forfeited: bigint }; weekPot: bigint; claimedWeek: bigint; sales: Sale[];
};
const B = (x: any) => BigInt(x ?? 0);

/** The server's shared snapshot (amounts as strings) back into exact numbers. */
export function parseEarnState(j: any): EarnState {
  return {
    at: Number(j.at),
    treasury: { ...j.treasury, reserve: B(j.treasury.reserve), pot: B(j.treasury.pot), prices: j.treasury.prices.map(B) },
    lodge: { ...j.lodge, acc: B(j.lodge.acc), rewards: B(j.lodge.rewards), carry: B(j.lodge.carry) },
    listings: j.listings.map((l: any) => ({ ...l, price: B(l.price) })),
    stakes: j.stakes.map((s: any) => ({ ...s, debt: B(s.debt), owed: B(s.owed) })),
    totals: { claimed: B(j.totals?.claimed), forfeited: B(j.totals?.forfeited) },
    weekPot: B(j.weekPot),
    claimedWeek: B(j.claimedWeek),
    sales: (j.sales ?? []).map((s: any) => ({ ...s, price: B(s.price) })),
  };
}

/** A staked yeti is locked until `unlockMs` (staked + 24 h); after that it can be unstaked. */
export function unstakeState(unlockMs: number, now: number) {
  if (unlockMs > now) {
    const m = Math.ceil((unlockMs - now) / 60_000);
    return { locked: true, label: `Locked · ${m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`}` };
  }
  return { locked: false, label: 'Unstake' };
}
