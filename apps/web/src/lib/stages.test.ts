import { describe, expect, test, vi } from 'vitest';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { TESTNET } from '@flurry/shared';
import { nextStage, submitStageWithRetry, buildSubmitStage, buildHatch, isExpiredAbort, type Attested } from './stages';

const att = (over: Partial<Attested> = {}): Attested => ({
  runId: 'R1', score: 812, snowflakes: '81', expiresMs: '1800000000000', signature: 'AAEC', nonce: '0', ...over,
});
const ids = { eggId: '0x' + '0e'.repeat(32), profileId: '0x' + '0f'.repeat(32) };

describe('nextStage', () => {
  test('nextStage returns 0 for a new egg', () => expect(nextStage({ stageScores: [] })).toBe(0));
  test('nextStage returns 2 for an egg with two scores', () => expect(nextStage({ stageScores: [812, 500] })).toBe(2));
  test('nextStage returns hatch after three scores', () => expect(nextStage({ stageScores: [1, 2, 3] })).toBe('hatch'));
});

describe('transactions', () => {
  test('submit_stage passes egg, profile, config, score, snowflakes, expiry, signature bytes, clock', () => {
    const data = buildSubmitStage(ids.eggId, ids.profileId, att()).getData();
    const call = (data.commands[0] as any).MoveCall;
    expect(normalizeSuiAddress(call.package)).toBe(normalizeSuiAddress(TESTNET.packageId));
    expect(`${call.module}::${call.function}`).toBe('egg::submit_stage');
    expect(call.arguments).toHaveLength(8);
  });

  test('hatch calls yeti::hatch with the egg and Random', () => {
    const data = buildHatch(ids.eggId).getData();
    const call = (data.commands[0] as any).MoveCall;
    expect(`${call.module}::${call.function}`).toBe('yeti::hatch');
    const objs = data.inputs.map((i: any) => i.UnresolvedObject?.objectId).filter(Boolean).map((a: string) => normalizeSuiAddress(a));
    expect(objs).toEqual([ids.eggId, '0x8'].map((a) => normalizeSuiAddress(a)));
  });
});

describe('isExpiredAbort', () => {
  test('recognises an attest abort code 12', () => {
    expect(isExpiredAbort('{"kind":"MoveAbort","abortCode":"12","location":{"module":"attest"}}')).toBe(true);
    expect(isExpiredAbort('MoveAbort(MoveLocation { module: ModuleId { name: Identifier("attest") } }, 12) in command 0')).toBe(true);
  });
  test('ignores other aborts', () => {
    expect(isExpiredAbort('{"kind":"MoveAbort","abortCode":"10","location":{"module":"attest"}}')).toBe(false);
    expect(isExpiredAbort(null)).toBe(false);
  });
});

describe('submitStageWithRetry', () => {
  test('resubmits with fresh attestation on EExpired', async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce({ digest: 'D0', ok: false, error: '{"kind":"MoveAbort","abortCode":"12","location":{"module":"attest"}}' })
      .mockResolvedValueOnce({ digest: 'D1', ok: true, error: null });
    const reattest = vi.fn(async () => att({ expiresMs: '1900000000000' }));
    const digest = await submitStageWithRetry(att(), ids, { execute, reattest });
    expect(reattest).toHaveBeenCalledOnce();
    expect(reattest).toHaveBeenCalledWith('R1');
    expect(execute).toHaveBeenCalledTimes(2);
    expect(digest).toBe('D1');
  });

  test('gives up with a clear message on any other failure', async () => {
    const execute = vi.fn(async () => ({ digest: 'D0', ok: false, error: '{"kind":"MoveAbort","abortCode":"10"}' }));
    await expect(submitStageWithRetry(att(), ids, { execute, reattest: vi.fn() })).rejects.toThrow(/score/i);
  });
});
