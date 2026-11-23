import { expect, test } from 'vitest';
import { TESTNET } from '@flurry/shared';
import { buildSyncTx } from './sync';

test('the hourly job makes exactly one lodge::sync call on the Lodge and the Shop', () => {
  const tx = buildSyncTx();
  const calls = tx.getData().commands.filter((c) => c.MoveCall);
  expect(calls).toHaveLength(1);
  const m = calls[0].MoveCall!;
  expect(`${m.module}::${m.function}`).toBe('lodge::sync');
  expect(m.package).toBe(TESTNET.latestPackageId);
  const objs = tx.getData().inputs.map((i) => (i as { UnresolvedObject?: { objectId: string } }).UnresolvedObject?.objectId);
  expect(objs).toEqual([TESTNET.lodgeId, TESTNET.shopId]);
});
