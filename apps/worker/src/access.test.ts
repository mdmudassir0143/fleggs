import { beforeEach, describe, expect, test } from 'vitest';
import { createAccess } from './access';
import { adminMessage, createSite } from './site';

class FakeKV {
  m = new Map<string, { v: string; meta?: unknown }>();
  async get(k: string) { return this.m.get(k)?.v ?? null; }
  async put(k: string, v: string, o?: { metadata?: unknown }) { this.m.set(k, { v, meta: o?.metadata }); }
  async delete(k: string) { this.m.delete(k); }
  async list(o: { prefix: string }) { return { keys: [...this.m.entries()].filter(([k]) => k.startsWith(o.prefix)).map(([name, x]) => ({ name, metadata: x.meta })), list_complete: true }; }
}

const ADMIN = '0x' + 'ad'.repeat(32);
const ALICE = '0x' + 'a1'.repeat(32), BOB = '0x' + 'b0'.repeat(32), OLD = '0x' + '01'.repeat(32);
const now = 1_800_000_000_000;
// Tokens are "jwt:<email>:<verified>:<address>"; a real token is checked with Google's keys and Enoki.
const google = async (jwt: string) => { const [, email, v] = jwt.split(':'); if (!email) throw new Error('bad token'); return { email, emailVerified: v === 'true' }; };
const addressFor = async (jwt: string) => jwt.split(':')[3];
const signed = (action: string) => ({ address: ADMIN, ts: now, signature: `sig:${ADMIN}:${adminMessage(action, now)}` });

function setup() {
  const kv = new FakeKV();
  const deps = { kv: kv as never, now: () => now, verifyAdmin: async (a: string, m: string, s: string) => a === ADMIN && s === `sig:${a}:${m}` };
  return { kv, site: createSite(deps), access: createAccess({ ...deps, verifyGoogle: google, addressFor }) };
}

describe('approval-only access', () => {
  let s: ReturnType<typeof setup>;
  beforeEach(() => { s = setup(); });

  test('in open mode everyone is allowed', async () => {
    expect(await s.access.allowed(ALICE)).toBe(true);
  });

  test('in waitlist mode, signing in links the address to the verified email and joins the waitlist as pending', async () => {
    await s.site.setMode({ mode: 'waitlist', ...signed('site-mode:waitlist') });
    expect(await s.access.link({ jwt: `jwt:Alice@Snow.example:true:${ALICE}`, address: ALICE })).toEqual({ email: 'alice@snow.example', status: 'pending' });
    expect(await s.access.allowed(ALICE)).toBe(false);
    const list = await s.site.list(signed('waitlist'));
    expect(list).toEqual([expect.objectContaining({ email: 'alice@snow.example', status: 'pending' })]);
  });

  test('approving the email lets that account play; revoking stops it', async () => {
    await s.site.setMode({ mode: 'waitlist', ...signed('site-mode:waitlist') });
    await s.access.link({ jwt: `jwt:alice@snow.example:true:${ALICE}`, address: ALICE });
    await s.site.approve({ email: 'alice@snow.example', approved: true, ...signed('approve:alice@snow.example:true') });
    expect(await s.access.allowed(ALICE)).toBe(true);
    expect((await s.access.link({ jwt: `jwt:alice@snow.example:true:${ALICE}`, address: ALICE })).status).toBe('approved');
    await s.site.approve({ email: 'alice@snow.example', approved: false, ...signed('approve:alice@snow.example:false') });
    expect(await s.access.allowed(ALICE)).toBe(false);
  });

  test('approving before they ever sign in works too', async () => {
    await s.site.setMode({ mode: 'waitlist', ...signed('site-mode:waitlist') });
    await s.site.join({ email: 'bob@snow.example', ip: '1' });
    await s.site.approve({ email: 'bob@snow.example', approved: true, ...signed('approve:bob@snow.example:true') });
    expect((await s.access.link({ jwt: `jwt:bob@snow.example:true:${BOB}`, address: BOB })).status).toBe('approved');
    expect(await s.access.allowed(BOB)).toBe(true);
  });

  test("a token for someone else's address, or an unverified email, is refused", async () => {
    await expect(s.access.link({ jwt: `jwt:alice@snow.example:true:${BOB}`, address: ALICE })).rejects.toThrow('That sign-in does not match this account.');
    await expect(s.access.link({ jwt: `jwt:alice@snow.example:false:${ALICE}`, address: ALICE })).rejects.toThrow('Google has not verified this email.');
  });

  test('players from before the waitlist stay allowed', async () => {
    await s.site.setMode({ mode: 'waitlist', ...signed('site-mode:waitlist') });
    await s.access.grandfather([OLD]);
    expect(await s.access.allowed(OLD)).toBe(true);
    expect(await s.access.allowed(ALICE)).toBe(false);
  });

  test('only the admin can approve', async () => {
    await expect(s.site.approve({ email: 'x@y.io', approved: true, address: ALICE, ts: now, signature: 'nope' })).rejects.toThrow('Only the admin can do that.');
  });
});
