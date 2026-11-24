import { Transaction } from '@mysten/sui/transactions';
import { WORKER_URL } from '../config';
import { dAppKit } from '../dappKit';
import { sponsoredExecute, type ExecResult } from './sponsored';
import { createPost } from './http';

export const post = createPost(WORKER_URL);

/** Runs a Flurry transaction for the signed-in player, paid for by the Worker. */
export function run(tx: Transaction, sender: string): Promise<ExecResult> {
  tx.setSender(sender);
  return sponsoredExecute(tx, sender, {
    post,
    buildKind: (t) => t.build({ client: dAppKit.getClient('testnet'), onlyTransactionKind: true }),
    sign: async (txBytes) => (await dAppKit.signTransaction({ transaction: Transaction.from(txBytes) })).signature,
  });
}
