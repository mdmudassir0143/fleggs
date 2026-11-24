import { Transaction } from '@mysten/sui/transactions';
import { fromBase64 } from '@mysten/sui/utils';
import { TESTNET } from '@flurry/shared';
import type { ExecResult } from './sponsored';

/** A finished, referee-signed run as returned by /run/finish (bigints arrive as strings). */
export type Attested = {
  runId: string;
  score: number;
  snowflakes: string;
  expiresMs: string;
  signature: string;
  nonce: string;
};

export function nextStage(egg: { stageScores: number[] }): 0 | 1 | 2 | 'hatch' {
  const n = egg.stageScores.length;
  return n >= 3 ? 'hatch' : (n as 0 | 1 | 2);
}

export function buildSubmitStage(eggId: string, profileId: string, a: Attested): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${TESTNET.packageId}::egg::submit_stage`,
    arguments: [
      tx.object(eggId),
      tx.object(profileId),
      tx.object(TESTNET.gameConfigId),
      tx.pure.u32(a.score),
      tx.pure.u64(a.snowflakes),
      tx.pure.u64(a.expiresMs),
      tx.pure.vector('u8', fromBase64(a.signature)),
      tx.object.clock(),
    ],
  });
  return tx;
}

export function buildHatch(eggId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({ target: `${TESTNET.packageId}::yeti::hatch`, arguments: [tx.object(eggId), tx.object.random()] });
  return tx;
}

/** True when a transaction failed because the score's signature expired (attest::EExpired = 12). */
export function isExpiredAbort(error: string | null): boolean {
  if (!error || !/attest/.test(error)) return false;
  return /"abortCode"\s*:\s*"?12"?/.test(error) || /,\s*12\)/.test(error);
}

/**
 * Submits a stage score. If the signature expired while the player sat on the result screen,
 * asks the referee to re-sign the same run once and tries again.
 */
export async function submitStageWithRetry(
  a: Attested,
  ids: { eggId: string; profileId: string },
  deps: { execute(tx: Transaction): Promise<ExecResult>; reattest(runId: string): Promise<Attested> },
): Promise<string> {
  let res = await deps.execute(buildSubmitStage(ids.eggId, ids.profileId, a));
  if (!res.ok && isExpiredAbort(res.error)) {
    const fresh = await deps.reattest(a.runId);
    res = await deps.execute(buildSubmitStage(ids.eggId, ids.profileId, fresh));
  }
  if (!res.ok) throw new Error('Your score could not be saved. Play the stage again.');
  return res.digest;
}
