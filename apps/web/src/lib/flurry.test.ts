import { describe, expect, test, vi } from 'vitest';
import { Transaction } from '@mysten/sui/transactions';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { TESTNET } from '@flurry/shared';
import { buildCreateProfile } from './flurry';
import { sponsoredExecute } from './sponsored';

type MoveCall = { package: string; module: string; function: string; arguments: unknown[] };

describe('buildCreateProfile', () => {
  test('calls onboard::create_profile with registry, config and the element', () => {
    const data = buildCreateProfile(2).getData();
    const call = (data.commands[0] as { MoveCall: MoveCall }).MoveCall;
    expect(normalizeSuiAddress(call.package)).toBe(normalizeSuiAddress(TESTNET.packageId));
    expect(`${call.module}::${call.function}`).toBe('onboard::create_profile');
    expect(call.arguments).toHaveLength(3);
    const ids = data.inputs.map((i: any) => i.UnresolvedObject?.objectId).filter(Boolean).map((a: string) => normalizeSuiAddress(a));
    expect(ids).toEqual([TESTNET.registryId, TESTNET.gameConfigId].map((a: string) => normalizeSuiAddress(a)));
  });
});

describe('sponsoredExecute', () => {
  test('sends kind bytes, signs the sponsored bytes and executes with both', async () => {
    const calls: Array<{ path: string; body: any }> = [];
    const post = vi.fn(async (path: string, body: any) => {
      calls.push({ path, body });
      if (path === '/sponsor') return { leaseId: 'L1', txBytes: 'VFhCWVRFUw==', sponsorSignature: 'S' };
      return { digest: 'D1', ok: true, error: null };
    });
    const sign = vi.fn(async (_txBytes: string) => 'USER_SIG');
    const buildKind = vi.fn(async (_tx: Transaction) => new Uint8Array([1, 2, 3]));
    const res = await sponsoredExecute(new Transaction(), '0xabc', { post, sign, buildKind });
    expect(calls[0]).toEqual({ path: '/sponsor', body: { kindBytes: 'AQID', sender: '0xabc' } });
    expect(sign).toHaveBeenCalledWith('VFhCWVRFUw==');
    expect(calls[1]).toEqual({ path: '/execute', body: { leaseId: 'L1', txBytes: 'VFhCWVRFUw==', userSignature: 'USER_SIG' } });
    expect(res).toEqual({ digest: 'D1', ok: true, error: null });
  });
});

import { buildEarn, buildFinishTraining, buildStartTraining, buildSubmitDaily, getMyYetis } from './flurry';

const call0 = (tx: Transaction) => (tx.getData().commands[0] as { MoveCall: MoveCall }).MoveCall;
const objIds = (tx: Transaction) => tx.getData().inputs.map((i: any) => i.UnresolvedObject?.objectId).filter(Boolean).map((a: string) => normalizeSuiAddress(a));
const A = '0x' + 'a1'.repeat(32), P = '0x' + 'b2'.repeat(32);
const att = { score: 500, snowflakes: 10n, expiresMs: 1_800_000_000_000n, signature: 'AQID' };

describe('training and daily builders', () => {
  test('buildStartTraining targets training::start with yeti, profile, config, slot and clock', () => {
    const tx = buildStartTraining(A, P, 2);
    const c = call0(tx);
    expect(normalizeSuiAddress(c.package)).toBe(normalizeSuiAddress(TESTNET.latestPackageId));
    expect(`${c.module}::${c.function}`).toBe('training::start');
    expect(c.arguments).toHaveLength(5);
    expect(objIds(tx)).toEqual([A, P, TESTNET.gameConfigId].map((a) => normalizeSuiAddress(a))); // + the shared Clock
  });
  test('buildFinishTraining targets training::finish with yeti and clock', () => {
    const c = call0(buildFinishTraining(A));
    expect(`${c.module}::${c.function}`).toBe('training::finish');
    expect(c.arguments).toHaveLength(2);
  });
  test('buildEarn and buildSubmitDaily pass the attested run', () => {
    expect(`${call0(buildEarn(P, 1, att)).module}::${call0(buildEarn(P, 1, att)).function}`).toBe('training::earn');
    expect(call0(buildEarn(P, 1, att)).arguments).toHaveLength(8);
    const d = call0(buildSubmitDaily(P, 3, att));
    expect(`${d.module}::${d.function}`).toBe('daily::submit');
    expect(d.arguments).toHaveLength(8);
  });
});

describe('getMyYetis', () => {
  test('returns trait points and the training in progress', async () => {
    const { YetiBcs, TrainingBcs } = await import('@flurry/shared');
    const content = YetiBcs.serialize({
      id: A, level: 1, elements: [2], traits: [{ slot: 0, variant: 9, points: 1 }, { slot: 1, variant: 6, points: 0 }, { slot: 2, variant: 3, points: 2 }],
      name: 'Moss', card_url: '', lore_blob: 'L', card_blob: 'C', parents: [],
    }).toBytes();
    const client = {
      core: {
        listOwnedObjects: async () => ({ objects: [{ objectId: A, content }] }),
        getDynamicField: async () => ({ dynamicField: { value: { bcs: TrainingBcs.serialize({ slot: 1, ready_at_ms: 99n }).toBytes() } } }),
      },
    };
    const [y] = await getMyYetis(client as never, '0x1');
    expect(y.points).toEqual([1, 0, 2]);
    expect(y.training).toEqual({ slot: 1, readyAt: 99 });
  });
});

import { buildBuyEgg, buildBuyElementEgg, buildBuySnowflakeEgg, buildClaimPartnerEgg, buildMerge, buildSkipTraining } from './flurry';

describe('shop and merge builders', () => {
  const S = TESTNET as unknown as { shopId: string };
  test("buying an egg pays from the player's own SUI, never the gas coin", () => {
    const tx = buildBuyEgg(P, 500_000_000n);
    const json = JSON.stringify(tx.getData(), (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
    expect(json).not.toContain('GasCoin');
    const call = tx.getData().commands.find((c: any) => c.MoveCall)!.MoveCall as MoveCall;
    expect(`${call.module}::${call.function}`).toBe('shop::buy_egg');
    expect(call.arguments).toHaveLength(3);
    expect(objIds(tx)).toContain(normalizeSuiAddress(S.shopId));
  });
  test('element egg passes the element; Snowflake and partner eggs need no payment', () => {
    const e = buildBuyElementEgg(P, 3, 1_000_000_000n).getData().commands.find((c: any) => c.MoveCall)!.MoveCall as MoveCall;
    expect(`${e.module}::${e.function}`).toBe('shop::buy_element_egg');
    expect(`${call0(buildBuySnowflakeEgg(P)).module}::${call0(buildBuySnowflakeEgg(P)).function}`).toBe('shop::buy_egg_snowflakes');
    expect(`${call0(buildClaimPartnerEgg(P, A)).function}`).toBe('claim_partner_egg');
  });
  test('buildMerge passes both yetis, the picks, the shop, the fee and randomness', () => {
    const tx = buildMerge(A, '0x' + 'a2'.repeat(32), [0, 1, 0], 100_000_000n);
    const call = tx.getData().commands.find((c: any) => c.MoveCall)!.MoveCall as MoveCall;
    expect(`${call.module}::${call.function}`).toBe('merge::merge');
    expect(call.arguments).toHaveLength(6);
  });
  test('skip pays the quoted price', () => {
    const call = buildSkipTraining(A, 20_000_000n).getData().commands.find((c: any) => c.MoveCall)!.MoveCall as MoveCall;
    expect(`${call.module}::${call.function}`).toBe('shop::skip_training');
  });
});

import { buildBuyExtraPlay } from './flurry';
test('buying an extra play calls shop::buy_extra_play with the game, paid from the player', () => {
  const tx = buildBuyExtraPlay(P, 1, 20_000_000n);
  const call = tx.getData().commands.find((c: any) => c.MoveCall?.function === 'buy_extra_play')!.MoveCall as MoveCall;
  expect(`${call.module}::${call.function}`).toBe('shop::buy_extra_play');
  expect(call.arguments).toHaveLength(4);
  expect(JSON.stringify(tx.getData(), (_k, v) => (typeof v === 'bigint' ? v.toString() : v))).not.toContain('GasCoin');
});

import { buildSellToTreasury, buildList, buildDelist, buildSetPrice, buildBuyListing, buildStake, buildRequestUnstake, buildWithdraw } from './flurry';
describe('Earn transactions', () => {
  const Y = '0x' + '12'.repeat(32);
  const cases: [string, Transaction, string, number][] = [
    ['sell', buildSellToTreasury(Y, 1_400_000_000n), 'earn::sell_to_treasury_min', 3],
    ['list', buildList(Y, 200_000_000n), 'market::list', 4],
    ['delist', buildDelist(Y), 'market::delist', 2],
    ['reprice', buildSetPrice(Y, 300_000_000n), 'market::set_price', 3],
    ['buy', buildBuyListing(Y, 200_000_000n), 'market::buy', 4],
    ['stake', buildStake(Y), 'lodge::stake', 4],
    ['unstake', buildRequestUnstake(Y), 'lodge::request_unstake', 4],
    ['withdraw', buildWithdraw(Y), 'lodge::withdraw', 3],
  ];
  test.each(cases)('%s calls the latest package with the right arguments and never the gas coin', (_n, tx, fn, n) => {
    const call = tx.getData().commands.map((c: any) => c.MoveCall).find((m: MoveCall | undefined) => m && `${m.module}::${m.function}` === fn) as MoveCall;
    expect(call).toBeTruthy();
    expect(normalizeSuiAddress(call.package)).toBe(normalizeSuiAddress(TESTNET.latestPackageId));
    expect(call.arguments).toHaveLength(n);
    expect(JSON.stringify(tx.getData(), (_k, v) => (typeof v === 'bigint' ? v.toString() : v))).not.toContain('GasCoin');
  });
});

import { buildClaimAll } from './flurry';
test('claim all: one lodge::claim_all call for all your yetis (one claim per player per day)', () => {
  const tx = buildClaimAll(['0x' + '01'.repeat(32), '0x' + '02'.repeat(32)]);
  const calls = tx.getData().commands.filter((c: any) => c.MoveCall);
  expect(calls).toHaveLength(1);
  expect(calls[0].MoveCall!.function).toBe('claim_all');
  expect(calls[0].MoveCall!.arguments).toHaveLength(4);
});
