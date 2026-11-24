import { describe, expect, test } from 'vitest';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { TESTNET } from '@flurry/shared';
import type { Transaction } from '@mysten/sui/transactions';
import * as A from './admin';

const CAP = '0x' + 'ca'.repeat(32), WHO = '0x' + 'be'.repeat(32), PROFILE = '0x' + 'pf'.replace(/[^0-9a-f]/g, '0').repeat(32).slice(0, 64);
const call = (tx: Transaction, fn: string) => tx.getData().commands.map((c: any) => c.MoveCall).find((m: any) => m && `${m.module}::${m.function}` === fn);

describe('admin transactions', () => {
  const cases: [string, Transaction, string, number][] = [
    ['pause', A.buildSetPaused(CAP, true), 'config::set_paused', 3],
    ['shop prices', A.buildSetShopPrices(CAP, { egg: 1n, elementEgg: 2n, snowflakeEgg: 400, mergeFee: 3n, skipPerMin: 4n }), 'shop::set_prices', 7],
    ['extra play', A.buildSetExtraPlayPrice(CAP, 5n), 'shop::set_extra_play_price', 3],
    ['split', A.buildSetSplit(CAP, 5000, 3000), 'shop::set_split', 4],
    ['buyback', A.buildSetTreasuryPrices(CAP, [0n, 0n, 1n, 2n, 3n, 4n], 200), 'earn::set_prices', 4],
    ['royalty', A.buildSetRoyalty(CAP, 300), 'market::set_royalty', 3],
    ['lodge', A.buildSetLodge(CAP, [0, 0, 1, 3, 8, 20], 86_400_000), 'lodge::set_params', 4],
    ['fund reserve', A.buildFund('reserve', 1n), 'shop::fund_reserve', 2],
    ['fund pot', A.buildFund('pot', 1n), 'shop::fund_pot', 2],
    ['withdraw', A.buildWithdrawToMe(CAP, 1n), 'admin::withdraw_to_me', 3],
    ['gift flakes', A.buildGiftSnowflakes(CAP, WHO, 50n, 'Thanks!'), 'admin::gift_snowflakes', 4],
    ['gift egg', A.buildGiftEgg(CAP, WHO, 2), 'admin::gift_egg', 3],
    ['redeem gift', A.buildRedeemGift(CAP, PROFILE), 'admin::redeem_snowflakes', 2],
    ['fund sponsor', A.buildFundSponsor(CAP, 1n, WHO), 'admin::fund_sponsor', 3],
    ['mark test', A.buildMarkTest(CAP, WHO, true), 'config::mark_test_account', 4],
  ];
  test.each(cases)('%s → the right call on the latest package, never the gas coin', (_n, tx, fn, n) => {
    const m: any = call(tx, fn);
    expect(m).toBeTruthy();
    expect(normalizeSuiAddress(m.package)).toBe(normalizeSuiAddress(TESTNET.latestPackageId));
    expect(m.arguments).toHaveLength(n);
    expect(JSON.stringify(tx.getData(), (_k, v) => (typeof v === 'bigint' ? v.toString() : v))).not.toContain('GasCoin');
  });
});

test('admin stats from the server become exact numbers', () => {
  const s = A.parseAdminStats({ at: 1, players: 13, paused: false, week: { eggsBought: 2, eggRevenue: '500', hatches: 1, merges: 0, marketSales: 0, marketVolume: '0', claimed: '7', sharedOut: '7', treasuryBuys: 0, treasuryPaid: '0' },
    money: { opsTreasury: '5', reserve: '6', pot: '7', lodgeRewards: '8', claimedAllTime: '9' },
    settings: { eggPrice: '1', elementEggPrice: '2', snowflakeEggPrice: 400, mergeFee: '3', skipPerMin: '4', extraPlayPrice: '5', split: [5000, 3000], treasuryPrices: ['0', '0', '1', '2', '3', '4'], capBps: 200, royaltyBps: 300, weights: [0, 0, 1, 3, 8, 20], lockMs: 86400000 },
    lodge: { staked: 2, totalWeight: 2 }, market: { listed: 0 }, health: { gasCoins: [{ id: '0x1', balance: '90' }], gasTotal: '90', sponsorBalance: '100', lastSync: 5 }, feed: [] });
  expect(s.week.eggRevenue).toBe(500n);
  expect(s.money.reserve).toBe(6n);
  expect(s.settings.treasuryPrices[5]).toBe(4n);
  expect(s.health.gasCoins[0].balance).toBe(90n);
});

describe('gas runway', () => {
  test('how many transactions the pool (and the spare) can pay for, and for how long at the current pace', () => {
    // 4.775 SUI pool + 0.57 spare, ~0.0013 SUI per tx, 35 tx/day
    expect(A.gasRunway({ pool: 4_775_000_000n, spare: 570_000_000n, avgPerTx: 1_300_000, txPerDay: 35 })).toEqual({ poolTxs: 3673, totalTxs: 4111, days: 117 });
  });
  test('no estimate without a positive average cost', () => {
    expect(A.gasRunway({ pool: 1n, spare: 0n, avgPerTx: 0, txPerDay: 1 })).toBeNull();
    expect(A.gasRunway({ pool: 1n, spare: 0n, avgPerTx: -5, txPerDay: 1 })).toBeNull();
  });
  test('no pace yet means no day estimate', () => {
    expect(A.gasRunway({ pool: 1_300_000n, spare: 0n, avgPerTx: 1_300_000, txPerDay: 0 })).toEqual({ poolTxs: 1, totalTxs: 1, days: null });
  });
});
