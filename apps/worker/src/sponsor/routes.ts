import { accessFor } from '../accessEnv';
import { bcs } from '@mysten/sui/bcs';
import { Hono } from 'hono';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { fromBase64, toBase64 } from '@mysten/sui/utils';
import { TESTNET } from '@flurry/shared';
import { createSuiClient } from '../chain';
import type { Env } from '../env';
import { validateKind } from './validate';

export const GAS_BUDGET = 50_000_000n;

const pool = (env: Env) => env.GAS_POOL.get(env.GAS_POOL.idFromName('global'));

export const sponsor = new Hono<{ Bindings: Env }>();

/** Wraps the player's transaction with sponsor gas and the sponsor's signature. */
sponsor.post('/sponsor', async (c) => {
  const { kindBytes, sender } = await c.req.json<{ kindBytes: string; sender: string }>();
  const kind = fromBase64(kindBytes);
  const verdict = validateKind(kind, [TESTNET.packageId, TESTNET.latestPackageId, ...TESTNET.previousPackageIds], sender);
  if (!verdict.ok) return c.json({ error: verdict.reason }, 400);
  // Waitlist mode: only approved players (and players from before the waitlist) are sponsored.
  if (!(await accessFor(c.env).allowed(sender))) return c.json({ error: 'Your account is waiting for approval.' }, 403);

  const client = createSuiClient();
  // Skip (and retire) coins that can no longer cover the gas budget, so one drained coin
  // never blocks everyone.
  let lease: Awaited<ReturnType<ReturnType<typeof pool>['lease']>> = null;
  let coin: { objectId: string; version: string; digest: string } | null = null;
  for (let tries = 0; tries < 6; tries++) {
    lease = await pool(c.env).lease();
    if (!lease) break;
    const { object } = await client.core.getObject({ objectId: lease.coinId, include: { content: true } });
    if (coinBalance(object.content) >= GAS_BUDGET) { coin = object; break; }
    await pool(c.env).retire(lease.coinId);
    lease = null;
  }
  if (!lease || !coin) return c.json({ error: 'Servers are busy. Your progress is saved; try again in a minute.' }, 503);
  try {
    const sponsorKp = Ed25519Keypair.fromSecretKey(c.env.SPONSOR_SK);
    const { referenceGasPrice } = await client.core.getReferenceGasPrice();
    const tx = Transaction.fromKind(kind);
    tx.setSender(sender);
    tx.setGasOwner(sponsorKp.toSuiAddress());
    tx.setGasPayment([{ objectId: coin.objectId, version: coin.version, digest: coin.digest }]);
    tx.setGasBudget(GAS_BUDGET);
    tx.setGasPrice(BigInt(referenceGasPrice));
    const bytes = await tx.build({ client });
    const { signature } = await sponsorKp.signTransaction(bytes);
    const txBytes = toBase64(bytes);
    await pool(c.env).attach(lease.leaseId, { txBytes, sponsorSignature: signature });
    return c.json({ leaseId: lease.leaseId, txBytes, sponsorSignature: signature });
  } catch (err) {
    await pool(c.env).release(lease.leaseId);
    throw err;
  }
});

/** Submits the transaction with both signatures, waits for it, then frees the gas coin. */
sponsor.post('/execute', async (c) => {
  const { leaseId, txBytes, userSignature } = await c.req.json<{ leaseId: string; txBytes: string; userSignature: string }>();
  const lease = await pool(c.env).get(leaseId);
  if (!lease?.txBytes || lease.txBytes !== txBytes) return c.json({ error: 'This transaction expired. Please try again.' }, 400);
  const client = createSuiClient();
  try {
    const res = await client.core.executeTransaction({
      transaction: fromBase64(txBytes),
      signatures: [userSignature, lease.sponsorSignature!],
    });
    const t = res.Transaction ?? res.FailedTransaction!;
    await client.core.waitForTransaction({ digest: t.digest, timeout: 20_000 });
    return c.json({ digest: t.digest, ok: t.status.success, error: t.status.success ? null : JSON.stringify(t.status.error) });
  } catch (err) {
    // A coin drained between /sponsor and /execute: take it out of rotation and ask for a retry.
    if (/lower than the needed amount|insufficient/i.test(decodeURIComponent(String((err as Error).message)))) {
      await pool(c.env).retire(lease.coinId);
      return c.json({ error: 'The game server was busy. Please try again.' }, 503);
    }
    throw err;
  } finally {
    await pool(c.env).release(leaseId);
  }
});

/** Admin: load the sponsor's coin IDs into the pool. */
sponsor.post('/admin/pool/seed', async (c) => {
  if (c.req.header('authorization') !== `Bearer ${c.env.ADMIN_TOKEN}`) return c.json({ error: 'unauthorized' }, 401);
  const { coins } = await c.req.json<{ coins: string[] }>();
  return c.json({ seeded: await pool(c.env).seed(coins) });
});

/** Balance of a Coin<SUI> from its BCS content (UID + u64 balance). */
function coinBalance(content: Uint8Array | undefined): bigint {
  if (!content) return 0n;
  try { return BigInt(bcs.struct('Coin', { id: bcs.Address, balance: bcs.u64() }).parse(content).balance); } catch { return 0n; }
}
