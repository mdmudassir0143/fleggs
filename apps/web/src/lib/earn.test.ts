import { describe, expect, test } from 'vitest';
import { cashInOptions, listSuggestions, yetiHolding } from './earn';

const T = (reserve: bigint) => ({ reserve, pot: 0n, split: [5000, 3000] as [number, number], prices: [0n, 0n, 600_000_000n, 1_400_000_000n, 3_000_000_000n, 6_500_000_000n], capBps: 200 });
const L = { totalWeight: 20, acc: 0n, weights: [0, 0, 1, 3, 8, 20], unstakeMs: 86_400_000, rewards: 0n, count: 1, carry: 0n };
const y = (level: number) => ({ id: 'y', level, elements: [0], variants: [1, 2, 3], name: 'Chill', cardUrl: '', named: true });

describe('listing suggestions', () => {
  test('treasury price, the cheapest same-level listing, and the latest same-level sale', () => {
    const listings = [{ id: 'a', seller: 's', price: 900n, listedMs: 1, level: 3 }, { id: 'b', seller: 's', price: 700n, listedMs: 2, level: 3 }, { id: 'c', seller: 's', price: 100n, listedMs: 3, level: 2 }];
    const sales = [{ level: 3, price: 800n, at: 10 }, { level: 3, price: 650n, at: 20 }, { level: 2, price: 50n, at: 30 }];
    expect(listSuggestions(3, 1_400n, listings, sales)).toEqual({ treasury: 1_400n, floor: 700n, last: 650n });
    expect(listSuggestions(4, 3_000n, listings, sales)).toEqual({ treasury: 3_000n, floor: null, last: null });
  });
});

describe('cash-in options', () => {
  test('sell price follows the treasury (cap included); stake weight and a share of the pot', () => {
    expect(cashInOptions(y(3) as never, T(100_000_000_000n), L, 46_000_000_000n)).toMatchObject({ sellNow: 1_400_000_000n, stakeWeight: 3, weeklyEstimate: 6_000_000_000n });
    expect(cashInOptions(y(5) as never, T(10_000_000_000n), L, 0n).sellNow).toBe(200_000_000n);
    expect(cashInOptions(y(1) as never, T(100_000_000_000n), L, 0n)).toMatchObject({ sellNow: 0n, stakeWeight: 0, weeklyEstimate: 0n });
  });
});

describe('where a yeti is', () => {
  test('wallet, listed, staked or unstaking', () => {
    const snap = { yetis: [{ id: 'w' }], held: [{ yeti: { id: 'l' }, where: 'listed' }, { yeti: { id: 's' }, where: 'staked' }, { yeti: { id: 'u' }, where: 'unstaking' }] } as never;
    expect(['w', 'l', 's', 'u', 'x'].map((id) => yetiHolding(id, snap))).toEqual(['wallet', 'listed', 'staked', 'unstaking', null]);
  });
});

import { parseSui } from './earn';
test('typed SUI amounts become MIST; anything else is refused', () => {
  expect(parseSui('0.25')).toBe(250_000_000n);
  expect(parseSui('2')).toBe(2_000_000_000n);
  expect(parseSui(' 1.5 ')).toBe(1_500_000_000n);
  expect(parseSui('0')).toBeNull();
  expect(parseSui('abc')).toBeNull();
  expect(parseSui('1.0000000001')).toBeNull(); // more precision than MIST
});

describe('stake estimate (review fix)', () => {
  const T2 = { reserve: 100_000_000_000n, pot: 100_000_000_000n, split: [5000, 3000] as [number, number], prices: [0n, 0n, 600_000_000n, 1_400_000_000n, 3_000_000_000n, 6_500_000_000n], capBps: 200 };
  test('uses this week’s rate, not the pot already waiting (that goes to current stakers)', () => {
    const L2 = { totalWeight: 20, acc: 0n, weights: [0, 0, 1, 3, 8, 20], unstakeMs: 1, rewards: 0n, count: 1, carry: 0n };
    expect(cashInOptions(y(3) as never, T2, L2, 23_000_000_000n).weeklyEstimate).toBe(3_000_000_000n);
  });
  test('first staker: the whole waiting pot and carry', () => {
    const L0 = { totalWeight: 0, acc: 0n, weights: [0, 0, 1, 3, 8, 20], unstakeMs: 1, rewards: 0n, count: 0, carry: 5_000_000_000n };
    expect(cashInOptions(y(2) as never, { ...T2, pot: 2_000_000_000n }, L0, 9_000_000_000n).weeklyEstimate).toBe(7_000_000_000n);
  });
});

import { sumSince } from './earn';
test('this week’s pot pages back until it reaches events older than a week', async () => {
  const day = 86_400_000, now = 100 * day;
  const ev = (daysAgo: number, amount: number) => ({ timestamp: new Date(now - daysAgo * day).toISOString(), contents: { json: { amount: String(amount) } } });
  const pages: Record<string, { nodes: ReturnType<typeof ev>[]; pageInfo: { hasPreviousPage: boolean; startCursor: string | null } }> = {
    first: { nodes: [ev(2, 10), ev(1, 20)], pageInfo: { hasPreviousPage: true, startCursor: 'p2' } },
    p2: { nodes: [ev(9, 1000), ev(6, 30)], pageInfo: { hasPreviousPage: true, startCursor: 'p3' } },
    p3: { nodes: [ev(20, 5000)], pageInfo: { hasPreviousPage: false, startCursor: null } },
  };
  const fetched: string[] = [];
  const total = await sumSince(async (before) => { fetched.push(before ?? 'first'); return pages[before ?? 'first']; }, now - 7 * day);
  expect(total).toBe(60n);
  expect(fetched).toEqual(['first', 'p2']); // stops once a page reaches past the week
});

import { repriceSummary } from './earn';
test('repricing shows old vs new, fee and what you get, and warns below the treasury price', () => {
  const r = repriceSummary(6_000_000_000n, 600_000_000n, 300, 1_400_000_000n);
  expect(r.rows).toEqual([['Was', '6 SUI'], ['New price', '0.6 SUI'], ['Fee (3%)', '0.018 SUI'], ['You get when it sells', '0.582 SUI']]);
  expect(r.warning).toMatch(/treasury pays 1.4 SUI/);
  expect(repriceSummary(1_000_000_000n, 2_000_000_000n, 300, 1_400_000_000n).warning).toBeNull();
});

import { marketView } from './earn';
test('market: other players only, cheapest first, filter by level, floor per level', () => {
  const l = (id: string, seller: string, price: bigint, level: number) => ({ id, seller, price, listedMs: 0, level });
  const all = [l('a', 'me', 1n, 2), l('b', 'x', 9n, 2), l('c', 'y', 4n, 3), l('d', 'z', 3n, 2), l('e', 'z', 7n, 5)];
  const v = marketView(all, 'me', null);
  expect(v.items.map((i) => i.id)).toEqual(['d', 'c', 'e', 'b']);
  expect(v.floors).toEqual({ 2: 3n, 3: 4n, 5: 7n });
  expect(marketView(all, 'ME', 2).items.map((i) => i.id)).toEqual(['d', 'b']); // address case doesn't matter
});

import { parseEarnState } from './earn';
test('the shared Earn snapshot from the server turns back into exact numbers', () => {
  const s = parseEarnState({
    at: 5, weekPot: '568000000', claimedWeek: '588000000',
    treasury: { reserve: '1022370000', pot: '0', split: [5000, 3000], prices: ['0', '0', '600000000', '1', '2', '3'], capBps: 200 },
    lodge: { totalWeight: 3, acc: '268000000000000000000000000', weights: [0, 0, 1, 3, 8, 20], unstakeMs: 86400000, rewards: '300000000', count: 1, carry: '0' },
    listings: [{ id: '0xa', seller: '0xb', price: '50000000', listedMs: 1, level: 2 }],
    stakes: [{ id: '0xc', owner: '0xd', weight: 1, debt: '7', owed: '0', unlockMs: 9, level: 2 }],
    totals: { claimed: '248000000', forfeited: '0' },
    sales: [{ level: 2, price: '50000000', at: 3 }],
  });
  expect(s.treasury.reserve).toBe(1_022_370_000n);
  expect(s.treasury.prices[2]).toBe(600_000_000n);
  expect(s.lodge.acc).toBe(268_000_000_000_000_000_000_000_000n);
  expect(s.listings[0].price).toBe(50_000_000n);
  expect(s.stakes[0].debt).toBe(7n);
  expect(s.totals.claimed).toBe(248_000_000n);
  expect(s.weekPot).toBe(568_000_000n);
  expect(s.claimedWeek).toBe(588_000_000n);
  expect(s.sales[0].price).toBe(50_000_000n);
});

import { unstakeState } from './earn';
test('a staked yeti is locked for 24 h; then it can be unstaked', () => {
  const now = 1_000_000_000;
  expect(unstakeState(now + 5 * 3_600_000 + 12 * 60_000, now)).toEqual({ locked: true, label: 'Locked · 5h 12m' });
  expect(unstakeState(now - 1, now)).toEqual({ locked: false, label: 'Unstake' });
  expect(unstakeState(0, now)).toEqual({ locked: false, label: 'Unstake' }); // older stakes can always leave
});
