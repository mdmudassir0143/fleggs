import { describe, expect, test } from 'vitest';
import { GasPoolCore } from './gasPool';

const coins = Array.from({ length: 10 }, (_, i) => '0x' + i.toString(16).padStart(64, '0'));

describe('GasPoolCore', () => {
  test('leases distinct coins under concurrent requests', async () => {
    const pool = new GasPoolCore(coins);
    const leases = await Promise.all(Array.from({ length: 10 }, async () => pool.lease(1_000)));
    expect(new Set(leases.map((l) => l!.coinId)).size).toBe(10);
  });

  test('returns null when all coins are leased', () => {
    const pool = new GasPoolCore(coins.slice(0, 1));
    expect(pool.lease(0)).not.toBeNull();
    expect(pool.lease(1)).toBeNull();
  });

  test('released coin can be leased again', () => {
    const pool = new GasPoolCore(coins.slice(0, 1));
    const l = pool.lease(0)!;
    pool.release(l.leaseId);
    expect(pool.lease(1)?.coinId).toBe(coins[0]);
  });

  test('expired lease returns coin to pool', () => {
    const pool = new GasPoolCore(coins.slice(0, 1));
    pool.lease(0);
    expect(pool.lease(59_999)).toBeNull();
    expect(pool.lease(60_000)?.coinId).toBe(coins[0]);
  });

  test('lease info is retrievable by id until released', () => {
    const pool = new GasPoolCore(coins.slice(0, 1));
    const l = pool.lease(0)!;
    pool.attach(l.leaseId, { txBytes: 'AA==', sponsorSignature: 'sig' });
    expect(pool.get(l.leaseId, 10)?.txBytes).toBe('AA==');
    pool.release(l.leaseId);
    expect(pool.get(l.leaseId, 10)).toBeNull();
  });

  test('spreads leases across coins instead of draining the first', () => {
    const pool = new GasPoolCore(['a', 'b', 'c']);
    const used: string[] = [];
    for (let i = 0; i < 6; i++) { const l = pool.lease(0)!; used.push(l.coinId); pool.release(l.leaseId); }
    expect(used).toEqual(['a', 'b', 'c', 'a', 'b', 'c']);
  });

  test('a retired coin is never leased again', () => {
    const pool = new GasPoolCore(['a', 'b']);
    pool.retire('a');
    for (let i = 0; i < 4; i++) { const l = pool.lease(0)!; expect(l.coinId).toBe('b'); pool.release(l.leaseId); }
    expect(pool.coinsLeft()).toBe(1);
  });
});

