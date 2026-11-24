import { useEffect, useState } from 'react';
import { getSession, isGoogleWallet } from '@mysten/enoki';
import { useWallets } from '@mysten/dapp-kit-react';
import { WORKER_URL } from '../config';

export type AccessView = { kind: 'checking' } | { kind: 'allowed' } | { kind: 'pending'; email: string | null } | { kind: 'resign' };

/**
 * Decide what a signed-in player sees. The server is the real gate (it refuses to sponsor or score
 * unapproved accounts); this only picks the screen.
 */
export async function resolveAccess(io: {
  status(): Promise<{ allowed: boolean; linked: boolean }>;
  getJwt(): Promise<string | null>;
  link(jwt: string): Promise<{ email: string; status: 'pending' | 'approved' }>;
}): Promise<Exclude<AccessView, { kind: 'checking' }>> {
  let s: { allowed: boolean; linked: boolean };
  try { s = await io.status(); } catch { return { kind: 'allowed' }; }
  if (s.allowed) return { kind: 'allowed' };
  if (s.linked) return { kind: 'pending', email: null };
  const jwt = await io.getJwt().catch(() => null);
  if (!jwt) return { kind: 'resign' };
  try {
    const r = await io.link(jwt);
    return r.status === 'approved' ? { kind: 'allowed' } : { kind: 'pending', email: r.email };
  } catch { return { kind: 'resign' }; }
}

/** Checks access for the signed-in address; `recheck` re-runs it (the "Check again" button). */
export function useAccess(address: string | null): [AccessView, () => void] {
  const google = useWallets().find(isGoogleWallet);
  const [view, setView] = useState<AccessView>({ kind: 'checking' });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!address) return;
    let live = true;
    setView({ kind: 'checking' });
    resolveAccess({
      status: async () => (await fetch(`${WORKER_URL}/access/status?address=${address}`)).json(),
      getJwt: async () => (google ? (await getSession(google))?.jwt ?? null : null),
      link: async (jwt) => {
        const r = await fetch(`${WORKER_URL}/access/link`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jwt, address }) });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? 'link failed');
        return j;
      },
    }).then((v) => { if (live) setView(v); });
    return () => { live = false; };
  }, [address, google, n]);
  return [view, () => setN((x) => x + 1)];
}
