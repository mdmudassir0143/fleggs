import { describe, expect, test } from 'vitest';
import { bcs } from '@mysten/sui/bcs';
import { ListingFieldBcs, StakeFieldBcs, estimateShare, stakePending, treasuryPrice, type Treasury } from './earn';

const T = (reserve: bigint): Treasury => ({ reserve, pot: 0n, split: [5000, 3000], prices: [0n, 0n, 600_000_000n, 1_400_000_000n, 3_000_000_000n, 6_500_000_000n], capBps: 200 });

describe('treasury price', () => {
  test('table price, capped at 2% of the reserve; nothing below level 2', () => {
    expect(treasuryPrice(T(100_000_000_000n), 3)).toBe(1_400_000_000n);
    expect(treasuryPrice(T(10_000_000_000n), 5)).toBe(200_000_000n);
    expect(treasuryPrice(T(100_000_000_000n), 1)).toBe(0n);
  });
});

describe('Lodge maths', () => {
  test('a share of the pot by weight', () => {
    expect(estimateShare(3, 23, 23_000_000_000n)).toBe(3_000_000_000n);
    expect(estimateShare(3, 0, 23_000_000_000n)).toBe(0n);
  });
  test('pending = owed + weight × acc − debt (scaled)', () => {
    const SCALE = 10n ** 18n;
    expect(stakePending({ weight: 3, debt: 0n, owed: 5n }, 2n * SCALE)).toBe(11n);
    expect(stakePending({ weight: 0, debt: 0n, owed: 7n }, 9n * SCALE)).toBe(7n);
  });
});

describe('BCS layouts match the Move structs', () => {
  const id = '0x' + 'ab'.repeat(32);
  test('market listing field', () => {
    const bytes = bcs.struct('F', { id: bcs.Address, name: bcs.Address, value: bcs.struct('L', { seller: bcs.Address, price: bcs.u64(), listed_ms: bcs.u64(), level: bcs.u8() }) })
      .serialize({ id, name: id, value: { seller: id, price: 5n, listed_ms: 9n, level: 3 } }).toBytes();
    expect(ListingFieldBcs.parse(bytes).value).toEqual({ seller: id, price: '5', listed_ms: '9', level: 3 });
  });
  test('lodge stake field', () => {
    const bytes = bcs.struct('F', { id: bcs.Address, name: bcs.Address, value: bcs.struct('S', { owner: bcs.Address, weight: bcs.u64(), debt: bcs.u128(), owed: bcs.u64(), unlock_ms: bcs.u64(), level: bcs.u8() }) })
      .serialize({ id, name: id, value: { owner: id, weight: 3n, debt: 4n, owed: 5n, unlock_ms: 0n, level: 3 } }).toBytes();
    expect(StakeFieldBcs.parse(bytes).value).toMatchObject({ owner: id, weight: '3', owed: '5', level: 3 });
  });
});

import { claimableFor } from './earn';
describe('what a player can claim (24 h rules)', () => {
  const SCALE = 10n ** 18n, DAY = 86_400_000;
  const st = (id: string, weight: number, unlockMs: number) => ({ id, owner: 'me', weight, debt: 0n, owed: 0n, unlockMs, level: 2 });
  test('only stakes past their 24 h count now; the rest is locked; one claim per day', () => {
    const now = 10 * DAY;
    const r = claimableFor([st('a', 1, now - 1), st('b', 1, now + 3_600_000)], 2n * SCALE, { owed: 5n, lastClaimMs: 0 }, now, DAY);
    expect(r).toEqual({ now: 7n, locked: 2n, unlocksAt: now + 3_600_000, nextClaimAt: 0, canClaim: true });
  });
  test('claimed in the last day: nothing until the cooldown ends', () => {
    const now = 10 * DAY;
    const r = claimableFor([st('a', 1, now - DAY)], 2n * SCALE, { owed: 0n, lastClaimMs: now - 1000 }, now, DAY);
    expect(r).toMatchObject({ now: 2n, canClaim: false, nextClaimAt: now - 1000 + DAY });
  });
});
