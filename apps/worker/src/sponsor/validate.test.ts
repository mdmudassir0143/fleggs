import { describe, expect, test } from 'vitest';
import { Transaction } from '@mysten/sui/transactions';
import { validateKind, withdrawalsFromSender } from './validate';

const PKG = '0x' + '67'.repeat(32);
const PKG2 = '0x' + '88'.repeat(32);
const IDS = [PKG, PKG2];
const ref = (b: string) => ({ objectId: '0x' + b.repeat(32), version: '1', digest: '11111111111111111111111111111111' });

async function kind(build: (tx: Transaction) => void) {
  const tx = new Transaction();
  build(tx);
  return tx.build({ onlyTransactionKind: true });
}

describe('validateKind', () => {
  test('accepts a flurry::egg::submit_stage call', async () => {
    const k = await kind((tx) => tx.moveCall({ target: `${PKG}::egg::submit_stage`, arguments: [tx.pure.u32(812)] }));
    expect(validateKind(k, IDS)).toEqual({ ok: true });
  });

  test('accepts a short package address that normalizes to the same package', async () => {
    const k = await kind((tx) => tx.moveCall({ target: `${PKG}::onboard::create_profile`, arguments: [tx.pure.u8(1)] }));
    expect(validateKind(k, [PKG.toUpperCase().replace('0X', '0x')]).ok).toBe(true);
  });

  test('rejects GasCoin use', async () => {
    const k = await kind((tx) => {
      const [c] = tx.splitCoins(tx.gas, [1]);
      tx.moveCall({ target: `${PKG}::egg::submit_stage`, arguments: [c] });
    });
    expect(validateKind(k, IDS).ok).toBe(false);
  });

  test('rejects GasCoin passed straight into our own package', async () => {
    const k = await kind((tx) => tx.moveCall({ target: `${PKG}::egg::submit_stage`, arguments: [tx.gas] }));
    expect(validateKind(k, IDS)).toEqual({ ok: false, reason: 'gas coin may not be used' });
  });

  test('rejects foreign package', async () => {
    const k = await kind((tx) => tx.moveCall({ target: `0x2::coin::zero`, typeArguments: ['0x2::sui::SUI'] }));
    expect(validateKind(k, IDS).ok).toBe(false);
  });

  test('rejects TransferObjects', async () => {
    const k = await kind((tx) => {
      const r = tx.moveCall({ target: `${PKG}::egg::submit_stage`, arguments: [] });
      tx.transferObjects([r], tx.pure.address('0x' + '99'.repeat(32)));
    });
    expect(validateKind(k, IDS).ok).toBe(false);
  });

  test('accepts both original and upgraded package', async () => {
    const k = await kind((tx) => {
      tx.moveCall({ target: `${PKG}::egg::submit_stage`, arguments: [] });
      tx.moveCall({ target: `${PKG2}::yeti::attach_lore`, arguments: [] });
    });
    expect(validateKind(k, IDS)).toEqual({ ok: true });
  });

  test('still rejects foreign package with two allowed ids', async () => {
    const k = await kind((tx) => tx.moveCall({ target: `0x${'99'.repeat(32)}::yeti::attach_lore`, arguments: [] }));
    expect(validateKind(k, IDS).ok).toBe(false);
  });

  test('rejects a blocked nickname', async () => {
    const k = await kind((tx) => tx.moveCall({ target: `${PKG2}::identity::set_nickname`, arguments: [tx.pure.address('0x' + '01'.repeat(32)), tx.pure.string('stupid yeti')] }));
    expect(validateKind(k, IDS)).toEqual({ ok: false, reason: 'nickname not allowed' });
  });

  test('accepts a clean nickname', async () => {
    const k = await kind((tx) => tx.moveCall({ target: `${PKG2}::identity::set_nickname`, arguments: [tx.pure.address('0x' + '01'.repeat(32)), tx.pure.string('Snowy')] }));
    expect(validateKind(k, IDS)).toEqual({ ok: true });
  });

  test('rejects garbage bytes', () => {
    expect(validateKind(new Uint8Array([1, 2, 3]), IDS).ok).toBe(false);
  });

  test("accepts paying with the player's own coin (split, then pass to a flurry call)", async () => {
    const k = await kind((tx) => {
      const [pay] = tx.splitCoins(tx.objectRef(ref('c0')), [500_000_000]);
      tx.moveCall({ target: `${PKG}::shop::buy_egg`, arguments: [tx.sharedObjectRef({ objectId: '0x' + '5a'.repeat(32), initialSharedVersion: '1', mutable: true }), tx.objectRef(ref('b1')), pay] });
    });
    expect(validateKind(k, IDS)).toEqual({ ok: true });
  });

  test('still rejects paying with the gas coin', async () => {
    const k = await kind((tx) => {
      const [pay] = tx.splitCoins(tx.gas, [500_000_000]);
      tx.moveCall({ target: `${PKG}::shop::buy_egg`, arguments: [pay] });
    });
    expect(validateKind(k, IDS).ok).toBe(false);
  });

  test('a transaction that only moves coins (no flurry call) is not sponsored', async () => {
    const k = await kind((tx) => { tx.mergeCoins(tx.objectRef(ref('c0')), [tx.objectRef(ref('c1'))]); });
    expect(validateKind(k, IDS)).toEqual({ ok: false, reason: 'only Flurry Eggs calls are sponsored' });
  });

  describe("paying from the player's address balance", () => {
    const ME = '0x' + 'aa'.repeat(32);
    const coin = () => ({ objectId: '0x' + 'c0'.repeat(32), version: '1', digest: '11111111111111111111111111111111' });
    const withSend = (to: string, type = '0x2::sui::SUI') => kind((tx) => {
      tx.moveCall({ target: '0x2::coin::send_funds', typeArguments: [type], arguments: [tx.objectRef(coin()), tx.pure.address(to)] });
      tx.moveCall({ target: `${PKG}::shop::buy_egg`, arguments: [tx.pure.u8(1)] });
    });
    test('the remainder going back to the sender is allowed', async () => {
      expect(validateKind(await withSend(ME), IDS, ME)).toEqual({ ok: true });
    });
    test('sending funds to anyone else is refused', async () => {
      expect(validateKind(await withSend('0x' + 'bb'.repeat(32)), IDS, ME).ok).toBe(false);
    });
    test('only SUI may be moved', async () => {
      expect(validateKind(await withSend(ME, `${PKG}::fake::COIN`), IDS, ME).ok).toBe(false);
    });
    test('other framework calls stay refused', async () => {
      const k = await kind((tx) => {
        tx.moveCall({ target: '0x2::transfer::public_transfer', typeArguments: ['0x2::coin::Coin<0x2::sui::SUI>'], arguments: [tx.objectRef(coin()), tx.pure.address(ME)] });
        tx.moveCall({ target: `${PKG}::shop::buy_egg`, arguments: [tx.pure.u8(1)] });
      });
      expect(validateKind(k, IDS, ME).ok).toBe(false);
    });
    test('withdrawals must come from the sender, never the sponsor', () => {
      expect(withdrawalsFromSender([{ $kind: 'FundsWithdrawal', FundsWithdrawal: { withdrawFrom: { $kind: 'Sender', Sender: true } } }])).toBe(true);
      expect(withdrawalsFromSender([{ $kind: 'FundsWithdrawal', FundsWithdrawal: { withdrawFrom: { $kind: 'Sponsor', Sponsor: true } } }])).toBe(false);
    });
  });
});

