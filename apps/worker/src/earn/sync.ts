import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { TESTNET, readTreasury } from '@flurry/shared';
import { createSuiClient } from '../chain';
import type { Env } from '../env';

const GAS_BUDGET = 20_000_000n;

/** `lodge::sync(lodge, shop)`: moves the staker pot into the Lodge and shares it by weight. */
export function buildSyncTx(): Transaction {
  const tx = new Transaction();
  tx.moveCall({ target: `${TESTNET.latestPackageId}::lodge::sync`, arguments: [tx.object(TESTNET.lodgeId), tx.object(TESTNET.shopId)] });
  return tx;
}

/** Hourly: if the pot has anything in it, sync it into the Lodge, paying gas with a leased pool coin. */
export async function syncLodge(env: Env): Promise<{ moved: string; digest?: string }> {
  const client = createSuiClient();
  const { pot } = await readTreasury(client);
  if (pot === 0n) return { moved: '0' };
  const pool = env.GAS_POOL.get(env.GAS_POOL.idFromName('global'));
  const lease = await pool.lease();
  if (!lease) return { moved: '0' };
  try {
    const kp = Ed25519Keypair.fromSecretKey(env.SPONSOR_SK);
    const { object: coin } = await client.core.getObject({ objectId: lease.coinId });
    const tx = buildSyncTx();
    tx.setSender(kp.toSuiAddress());
    tx.setGasPayment([{ objectId: coin.objectId, version: coin.version, digest: coin.digest }]);
    tx.setGasBudget(GAS_BUDGET);
    const res = await client.signAndExecuteTransaction({ transaction: tx, signer: kp });
    const t = res.Transaction ?? res.FailedTransaction!;
    await client.core.waitForTransaction({ digest: t.digest, timeout: 20_000 });
    console.log('[lodge] synced', pot.toString(), t.digest, t.status.success);
    return { moved: pot.toString(), digest: t.digest };
  } finally {
    await pool.release(lease.leaseId);
  }
}
