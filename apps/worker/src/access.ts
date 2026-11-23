/**
 * Who may play while the site is in waitlist mode. A player proves their email by sending the Google
 * token from their sign-in: Google's signature proves the email, and Enoki says which game address
 * that token controls, so nobody can attach someone else's email. Players from before the waitlist
 * are allowed by address. In open mode everyone may play.
 */
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { getEntry, normalizeEmail, putEntry, SiteError, type KV, type Status } from './site';

export type AccessDeps = {
  kv: KV;
  now(): number;
  verifyGoogle(jwt: string): Promise<{ email: string; emailVerified: boolean }>;
  addressFor(jwt: string): Promise<string>;
};

export function createAccess(d: AccessDeps) {
  const norm = (a: string) => normalizeSuiAddress(a);
  return {
    async allowed(address: string): Promise<boolean> {
      if ((await d.kv.get('site:mode')) !== 'waitlist') return true;
      const a = norm(address);
      if (await d.kv.get(`allow:${a}`)) return true;
      const email = await d.kv.get(`acct:${a}`);
      return !!email && (await getEntry(d.kv, email))?.status === 'approved';
    },
    async link(r: { jwt: string; address: string }): Promise<{ email: string; status: Status }> {
      let g: { email: string; emailVerified: boolean };
      try { g = await d.verifyGoogle(r.jwt); } catch { throw new SiteError('Sign in again to check your access.'); }
      if (!g.emailVerified) throw new SiteError('Google has not verified this email.');
      const email = normalizeEmail(g.email);
      if (!email) throw new SiteError('Google did not share an email for this account.');
      if (norm(await d.addressFor(r.jwt)) !== norm(r.address)) throw new SiteError('That sign-in does not match this account.');
      await d.kv.put(`acct:${norm(r.address)}`, email);
      const e = (await getEntry(d.kv, email)) ?? { email, at: d.now(), status: 'pending' as const };
      if (!(await getEntry(d.kv, email))) await putEntry(d.kv, e);
      const grand = !!(await d.kv.get(`allow:${norm(r.address)}`));
      return { email, status: grand ? 'approved' : e.status };
    },
    async isLinked(address: string): Promise<boolean> {
      return !!(await d.kv.get(`acct:${norm(address)}`)) || !!(await d.kv.get(`allow:${norm(address)}`));
    },
    async grandfather(addresses: string[]) {
      for (const a of addresses) await d.kv.put(`allow:${norm(a)}`, '1');
    },
  };
}
