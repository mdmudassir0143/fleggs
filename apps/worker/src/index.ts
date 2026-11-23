import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { createRunService, RunError } from './runs';
import { createChain, createSuiClient } from './chain';
import type { Env } from './env';
import { sponsor } from './sponsor/routes';
import { lore } from './lore/routes';
import { syncLodge } from './earn/sync';
import { cachedJson, loadEarnState } from './earn/state';
import { createSite, SiteError } from './site';
import { accessFor } from './accessEnv';
import { approvalEmail, sendEmail } from './email';
import { verifyPersonalMessageSignature } from '@mysten/sui/verify';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { TESTNET } from '@flurry/shared';

export { GasPool } from './sponsor/durable';

const app = new Hono<{ Bindings: Env }>();

app.use('*', (c, next) => cors({ origin: c.env.ALLOWED_ORIGINS.split(',') })(c, next));

app.onError((err, c) => {
  if (err instanceof RunError || err instanceof SiteError) return c.json({ error: err.message }, 400);
  console.error(err);
  return c.json({ error: 'Something went wrong on our side. Try again in a moment.' }, 500);
});

function runs(env: Env) {
  return createRunService({
    kv: env.RUNS,
    chain: createChain(createSuiClient()),
    signer: Ed25519Keypair.fromSecretKey(env.ATTESTOR_SK),
    now: () => Date.now(),
    randomSeed: () => crypto.getRandomValues(new Uint32Array(1))[0],
    allowed: (address) => accessFor(env).allowed(address),
  });
}

/** Site mode + waitlist. Admin actions are approved by a wallet signature from an AdminCap holder. */
function site(env: Env) {
  const client = createSuiClient();
  return createSite({
    kv: env.RUNS as never,
    now: () => Date.now(),
    async onApproved(email) {
      if (!env.RESEND_API_KEY) return { ok: false, error: 'email not configured' };
      const r = await sendEmail({ apiKey: env.RESEND_API_KEY, from: env.MAIL_FROM }, { to: email, ...approvalEmail({ email }) });
      if (!r.ok) console.error('[email] approval email failed', email, r.error);
      return r;
    },
    async verifyAdmin(address, message, signature) {
      try {
        await verifyPersonalMessageSignature(new TextEncoder().encode(message), signature, { client: client as never, address: normalizeSuiAddress(address) });
      } catch { return false; }
      const caps = await client.core.listOwnedObjects({ owner: normalizeSuiAddress(address), type: `${TESTNET.packageId}::config::AdminCap` });
      return caps.objects.length > 0;
    },
  });
}

const json = (v: unknown) => JSON.parse(JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? x.toString() : x)));

app.post('/run/start', async (c) => c.json(await runs(c.env).start(await c.req.json())));
app.post('/run/finish', async (c) => c.json(json(await runs(c.env).finish(await c.req.json()))));
app.post('/run/reattest', async (c) => c.json(json(await runs(c.env).reattest(await c.req.json()))));
app.route('/', sponsor);
app.route('/', lore);
// One shared Earn snapshot for everyone (10 s edge cache); ?fresh=1 after your own action.
app.get('/earn/state', async (c) => cachedJson(c.req.url, 10, c.req.query('fresh') === '1', loadEarnState, (caches as unknown as { default: never }).default));
// Admin overview (public on-chain data + gas health), 30 s cache.
app.get('/site', async (c) => { c.header('cache-control', 'public, max-age=30'); return c.json({ mode: await site(c.env).getMode() }); });
app.post('/waitlist', async (c) => {
  const b = await c.req.json<{ email?: string }>().catch(() => ({} as { email?: string }));
  return c.json(await site(c.env).join({ email: b.email ?? '', ip: c.req.header('cf-connecting-ip') ?? 'unknown' }));
});
app.post('/admin/site', async (c) => c.json(await site(c.env).setMode(await c.req.json())));
app.post('/admin/waitlist', async (c) => {
  const s = site(c.env);
  const list = await s.list(await c.req.json());
  return c.json({ count: list.length, list });
});
// Access: is this account allowed to play? (and link it to its verified Google email at sign-in)
app.get('/access/status', async (c) => {
  const address = c.req.query('address') ?? '';
  const a = accessFor(c.env);
  return c.json({ allowed: await a.allowed(address), linked: await a.isLinked(address) });
});
app.post('/access/link', async (c) => c.json(await accessFor(c.env).link(await c.req.json())));
app.post('/admin/waitlist/approve', async (c) => c.json(await site(c.env).approve(await c.req.json())));
app.get('/admin/waitlist/count', async (c) => c.json({ count: await site(c.env).count() }));
app.get('/health', (c) => c.json({ ok: true, now: Date.now() })); // clients sync countdowns to this clock

export default {
  fetch: app.fetch,
  /** Every 10 min: share new shop revenue with Lodge stakers (skips when the pot is empty). */
  async scheduled(_e: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(syncLodge(env).catch((e) => console.error('[lodge] sync failed', (e as Error).message)));
  },
};
export { app };
