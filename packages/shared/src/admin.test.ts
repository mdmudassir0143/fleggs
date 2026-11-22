import { expect, test } from 'vitest';
import { weekSummary } from './admin';

test('week summary: counts and SUI from events', () => {
  const n = (json: Record<string, string>) => ({ timestamp: '2026-11-20T00:00:00Z', contents: { json } });
  const s = weekSummary({
    eggs: [n({ paid_mist: '500000000', paid_snowflakes: '0' }), n({ paid_mist: '0', paid_snowflakes: '400' }), n({ paid_mist: '0', paid_snowflakes: '0', partner: 'true' })],
    hatches: [n({}), n({})],
    merges: [n({})],
    sales: [n({ price: '50000000' }), n({ price: '30000000' })],
    claims: [n({ amount: '320000000' })],
    synced: [n({ amount: '300000000' })],
    sold: [n({ paid: '20000000' })],
  });
  expect(s).toEqual({
    eggsBought: 3, eggRevenue: 500_000_000n, hatches: 2, merges: 1,
    marketSales: 2, marketVolume: 80_000_000n, claimed: 320_000_000n, sharedOut: 300_000_000n,
    treasuryBuys: 1, treasuryPaid: 20_000_000n,
  });
});
