import { describe, expect, test } from 'vitest';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { TESTNET } from '@flurry/shared';
import { initialReveal, revealReducer, type LoreResult, type RevealState } from './reveal';
import { buildAttachLore } from './flurry';

const lore: LoreResult = {
  yetiId: '0x' + '0c'.repeat(32), name: 'Moss', story: 'Moss paints the sky green.', loreBlob: 'L', cardBlob: 'C',
  cardUrl: 'https://agg/v1/blobs/C', expiresMs: '1800000000000', signature: 'AAEC',
};
const run = (events: Parameters<typeof revealReducer>[1][], s: RevealState = initialReveal('D1')) => events.reduce(revealReducer, s);

describe('revealReducer', () => {
  test('happy path: hatching → cracking → naming → saving → revealed', () => {
    let s = initialReveal('D1');
    expect(s.step).toBe('cracking');
    s = revealReducer(s, { type: 'CRACK_DONE' });
    expect(s.step).toBe('naming');
    s = revealReducer(s, { type: 'LORE_OK', lore });
    expect(s.step).toBe('saving');
    s = revealReducer(s, { type: 'SAVED' });
    expect(s).toMatchObject({ step: 'revealed', lore });
  });

  test('lore arriving before the crack animation ends waits for CRACK_DONE', () => {
    const s = run([{ type: 'LORE_OK', lore }]);
    expect(s.step).toBe('cracking');
    expect(run([{ type: 'LORE_OK', lore }, { type: 'CRACK_DONE' }]).step).toBe('saving');
  });

  test('reveal shows yeti when lore fails', () => {
    const s = run([{ type: 'CRACK_DONE' }, { type: 'LORE_FAIL', error: 'Walrus down', retryable: true }]);
    expect(s).toMatchObject({ step: 'failed', retryable: true, error: 'Walrus down', digest: 'D1' });
  });

  test('a lore failure during the crack shows after the crack', () => {
    const s = run([{ type: 'LORE_FAIL', error: 'x', retryable: true }]);
    expect(s.step).toBe('cracking');
    expect(revealReducer(s, { type: 'CRACK_DONE' }).step).toBe('failed');
  });

  test('RETRY from failed goes back to naming', () => {
    const s = run([{ type: 'CRACK_DONE' }, { type: 'LORE_FAIL', error: 'x', retryable: true }, { type: 'RETRY' }]);
    expect(s.step).toBe('naming');
    expect(s.error).toBeUndefined();
  });

  test('RETRY after a failed save keeps the lore and saves again', () => {
    const s = run([{ type: 'CRACK_DONE' }, { type: 'LORE_OK', lore }, { type: 'SAVE_FAIL', error: 'x' }, { type: 'RETRY' }]);
    expect(s).toMatchObject({ step: 'saving', lore });
  });
});

test('attach_lore targets latestPackageId with 9 arguments', () => {
  const data = buildAttachLore(lore.yetiId, lore).getData();
  const call = (data.commands[0] as any).MoveCall;
  expect(normalizeSuiAddress(call.package)).toBe(normalizeSuiAddress(TESTNET.latestPackageId));
  expect(`${call.module}::${call.function}`).toBe('yeti::attach_lore');
  expect(call.arguments).toHaveLength(9);
});
