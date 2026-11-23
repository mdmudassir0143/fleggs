/**
 * Site settings and the waitlist, kept in Workers KV.
 *  - mode: 'open' (the landing button signs you in) or 'waitlist' (it takes you to the waitlist page).
 *  - waitlist: one key per email (`wl:<email>`, joined time as metadata), so listing never loses a
 *    sign-up to a race. Only the admin can switch the mode or read the list: they sign a short
 *    message with their wallet, and the address must hold the game's AdminCap.
 */
import { adminMessage, type SiteMode } from '@flurry/shared';
export { adminMessage };
export type { SiteMode };
export type KV = {
  get(k: string): Promise<string | null>;
  put(k: string, v: string, o?: { expirationTtl?: number; metadata?: unknown }): Promise<void>;
  list(o: { prefix: string; cursor?: string }): Promise<{ keys: { name: string; metadata?: unknown }[]; list_complete: boolean; cursor?: string }>;
};
export type SiteDeps = {
  kv: KV; now(): number; verifyAdmin(address: string, message: string, signature: string): Promise<boolean>;
  /** Called once when an email goes from waiting to approved (sends the "you're in" email). */
  onApproved?(email: string): Promise<unknown>;
};
export class SiteError extends Error {}
export type Status = 'pending' | 'approved';
export type Entry = { email: string; at: number; status: Status };

/** One waitlist entry per email; status and time also kept as metadata so listing needs no reads. */
export async function getEntry(kv: KV, email: string): Promise<Entry | null> {
  const v = await kv.get(`wl:${email}`);
  if (!v) return null;
  const e = JSON.parse(v) as Partial<Entry>;
  return { email, at: Number(e.at ?? 0), status: e.status === 'approved' ? 'approved' : 'pending' };
}
export async function putEntry(kv: KV, e: Entry) {
  await kv.put(`wl:${e.email}`, JSON.stringify(e), { metadata: { at: e.at, status: e.status } });
}

const MODE_KEY = 'site:mode';
const MAX_JOINS_PER_HOUR = 5;
const SIGNATURE_MAX_AGE_MS = 5 * 60_000;


export function normalizeEmail(raw: string): string | null {
  const e = String(raw ?? '').trim().toLowerCase();
  if (e.length > 254 || !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(e)) return null;
  return e;
}

export function createSite(d: SiteDeps) {
  async function requireAdmin(action: string, a: { address: string; ts: number; signature: string }) {
    if (!a?.address || !a.signature || !Number.isFinite(a.ts)) throw new SiteError('Only the admin can do that.');
    if (Math.abs(d.now() - a.ts) > SIGNATURE_MAX_AGE_MS) throw new SiteError('That approval expired. Try again.');
    if (!(await d.verifyAdmin(a.address, adminMessage(action, a.ts), a.signature))) throw new SiteError('Only the admin can do that.');
  }
  return {
    async getMode(): Promise<SiteMode> {
      return (await d.kv.get(MODE_KEY)) === 'waitlist' ? 'waitlist' : 'open';
    },
    async setMode(r: { mode: SiteMode; address: string; ts: number; signature: string }) {
      if (r.mode !== 'open' && r.mode !== 'waitlist') throw new SiteError('Unknown mode.');
      await requireAdmin(`site-mode:${r.mode}`, r);
      await d.kv.put(MODE_KEY, r.mode);
      return { mode: r.mode };
    },
    async join(r: { email: string; ip: string }) {
      const email = normalizeEmail(r.email);
      if (!email) throw new SiteError('That email doesn’t look right.');
      const bucket = `wlrate:${r.ip}:${Math.floor(d.now() / 3_600_000)}`;
      const n = Number((await d.kv.get(bucket)) ?? 0);
      if (n >= MAX_JOINS_PER_HOUR) throw new SiteError('Too many sign-ups from here. Try again later.');
      await d.kv.put(bucket, String(n + 1), { expirationTtl: 3_600 });
      if (await getEntry(d.kv, email)) return { ok: true, already: true };
      await putEntry(d.kv, { email, at: d.now(), status: 'pending' });
      return { ok: true, already: false };
    },
    async count() {
      return (await all()).length;
    },
    async list(a: { address: string; ts: number; signature: string }) {
      await requireAdmin('waitlist', a);
      return (await all()).sort((x, y) => y.at - x.at);
    },
    /** Approve (or revoke) an email; works whether or not they joined or signed in yet. */
    async approve(r: { email: string; approved: boolean; address: string; ts: number; signature: string }) {
      const email = normalizeEmail(r.email);
      if (!email) throw new SiteError('That email doesn’t look right.');
      await requireAdmin(`approve:${email}:${!!r.approved}`, r);
      const e = (await getEntry(d.kv, email)) ?? { email, at: d.now(), status: 'pending' as const };
      await putEntry(d.kv, { ...e, status: r.approved ? 'approved' : 'pending' });
      const newly = r.approved && e.status !== 'approved';
      const sent = newly && d.onApproved ? ((await d.onApproved(email)) as { ok?: boolean; error?: string } | undefined) : undefined;
      return { email, status: r.approved ? 'approved' : 'pending', emailed: !!sent?.ok, emailError: sent && !sent.ok ? sent.error ?? 'not sent' : undefined };
    },
  };
  async function all() {
    const out: Entry[] = [];
    let cursor: string | undefined;
    do {
      const r = await d.kv.list({ prefix: 'wl:', cursor });
      for (const k of r.keys) {
        const m = (k.metadata ?? {}) as { at?: number; status?: Status };
        out.push({ email: k.name.slice(3), at: Number(m.at ?? 0), status: m.status === 'approved' ? 'approved' : 'pending' });
      }
      cursor = r.list_complete ? undefined : r.cursor;
    } while (cursor);
    return out;
  }
}
