import { beforeEach, describe, expect, test } from 'vitest';
import { adminMessage, createSite, normalizeEmail, SiteError } from './site';

const ADMIN = '0x' + 'ad'.repeat(32);
let now = 1_800_000_000_000;
/** In-memory stand-in for Workers KV with list() and metadata. */
class FakeKV {
  m = new Map<string, { v: string; meta?: unknown }>();
  async get(k: string) { return this.m.get(k)?.v ?? null; }
  async put(k: string, v: string, o?: { metadata?: unknown }) { this.m.set(k, { v, meta: o?.metadata }); }
  async list(o: { prefix: string; cursor?: string }) {
    const keys = [...this.m.entries()].filter(([k]) => k.startsWith(o.prefix)).map(([name, x]) => ({ name, metadata: x.meta }));
    return { keys, list_complete: true, cursor: '' };
  }
}
function setup() {
  const kv = new FakeKV();
  const site = createSite({
    kv: kv as never, now: () => now,
    // A signature is "valid" when it is `sig:<address>:<message>` and the address is the admin.
    verifyAdmin: async (address, message, signature) => address === ADMIN && signature === `sig:${address}:${message}`,
  });
  return { kv, site };
}
const signed = (action: string, ts = now) => ({ address: ADMIN, ts, signature: `sig:${ADMIN}:${adminMessage(action, ts)}` });

describe('emails', () => {
  test('are trimmed, lower-cased and checked', () => {
    expect(normalizeEmail('  Yeti@Snow.Example ')).toBe('yeti@snow.example');
    expect(normalizeEmail('not an email')).toBeNull();
    expect(normalizeEmail('a@b')).toBeNull();
    expect(normalizeEmail('x'.repeat(250) + '@a.io')).toBeNull();
  });
});

describe('waitlist and site mode', () => {
  let s: ReturnType<typeof setup>;
  beforeEach(() => { s = setup(); });

  test('the site starts open', async () => {
    expect(await s.site.getMode()).toBe('open');
  });

  test('joining stores the email once; a repeat says so', async () => {
    expect(await s.site.join({ email: 'Lofi@Yeti.example', ip: '1.1.1.1' })).toEqual({ ok: true, already: false });
    expect(await s.site.join({ email: 'lofi@yeti.example', ip: '1.1.1.1' })).toEqual({ ok: true, already: true });
  });

  test('a bad email is refused', async () => {
    await expect(s.site.join({ email: 'nope', ip: '1.1.1.1' })).rejects.toThrow('That email doesn’t look right.');
  });

  test('one address can only join a few times an hour', async () => {
    for (let i = 0; i < 5; i++) await s.site.join({ email: `p${i}@yeti.example`, ip: '9.9.9.9' });
    await expect(s.site.join({ email: 'p6@yeti.example', ip: '9.9.9.9' })).rejects.toThrow(SiteError);
  });

  test('only the admin, with a fresh signature, can switch the mode', async () => {
    await expect(s.site.setMode({ mode: 'waitlist', address: '0x' + '11'.repeat(32), ts: now, signature: 'x' })).rejects.toThrow('Only the admin can do that.');
    await expect(s.site.setMode({ mode: 'waitlist', ...signed('site-mode:waitlist', now - 10 * 60_000) })).rejects.toThrow('expired');
    await expect(s.site.setMode({ mode: 'open', ...signed('site-mode:waitlist') })).rejects.toThrow('Only the admin can do that.');
    await s.site.setMode({ mode: 'waitlist', ...signed('site-mode:waitlist') });
    expect(await s.site.getMode()).toBe('waitlist');
  });

  test('only the admin can read the list, newest first', async () => {
    await s.site.join({ email: 'first@yeti.example', ip: '1' });
    now += 1000;
    await s.site.join({ email: 'second@yeti.example', ip: '2' });
    await expect(s.site.list({ address: ADMIN, ts: now, signature: 'bad' })).rejects.toThrow('Only the admin can do that.');
    const l = await s.site.list(signed('waitlist'));
    expect(l.map((e) => e.email)).toEqual(['second@yeti.example', 'first@yeti.example']);
    expect(await s.site.count()).toBe(2);
  });
});

describe('approval emails', () => {
  test('approving someone new notifies them once; re-approving or revoking does not', async () => {
    const kv = new FakeKV();
    const notified: string[] = [];
    const site = createSite({ kv: kv as never, now: () => now, verifyAdmin: async (a, m, s) => a === ADMIN && s === `sig:${a}:${m}`, onApproved: async (e) => { notified.push(e); } });
    const approve = (email: string, approved: boolean) => site.approve({ email, approved, ...signed(`approve:${email}:${approved}`) });
    await site.join({ email: 'a@yeti.example', ip: '1' });
    await approve('a@yeti.example', true);
    await approve('a@yeti.example', true);
    await approve('a@yeti.example', false);
    expect(notified).toEqual(['a@yeti.example']);
  });
});
