import type { Transaction } from '@mysten/sui/transactions';
import { toBase64 } from '@mysten/sui/utils';

export type ExecResult = { digest: string; ok: boolean; error: string | null };

export type SponsorDeps = {
  post(path: string, body: unknown): Promise<any>;
  /** Signs base64 transaction bytes with the player's wallet, returns the signature. */
  sign(txBytes: string): Promise<string>;
  buildKind(tx: Transaction): Promise<Uint8Array>;
};

/** Player signs, the Worker pays gas and submits. No wallet pop-up, no fee. */
export async function sponsoredExecute(tx: Transaction, sender: string, deps: SponsorDeps): Promise<ExecResult> {
  const kindBytes = toBase64(await deps.buildKind(tx));
  const s = await deps.post('/sponsor', { kindBytes, sender });
  const userSignature = await deps.sign(s.txBytes);
  return deps.post('/execute', { leaseId: s.leaseId, txBytes: s.txBytes, userSignature });
}
