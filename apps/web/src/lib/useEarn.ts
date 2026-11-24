import { useCallback, useEffect, useRef, useState } from 'react';
import { useDAppKit } from '@mysten/dapp-kit-react';
import { readAccount, type LodgeAccount } from '@flurry/shared';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { WORKER_URL } from '../config';
import { parseEarnState, type EarnState } from './earn';
import { yetiFromContent, type Held, type Yeti } from './flurry';

const POLL_MS = 20_000;

/** The shared Earn snapshot from the game server (10 s edge cache). `fresh` skips the cache after your own action. */
export async function fetchEarnState(fresh = false): Promise<EarnState> {
  const r = await fetch(`${WORKER_URL}/earn/state${fresh ? '?fresh=1' : ''}`);
  if (!r.ok) throw new Error('earn state unavailable');
  return parseEarnState(await r.json());
}

type ObjClient = { core: { getObjects(a: unknown): Promise<{ objects: ({ content?: Uint8Array } | Error)[] }> } };

/** Your listed / staked yetis from a snapshot, with their art. */
export async function heldFrom(state: EarnState, owner: string, client: ObjClient): Promise<Held[]> {
  const me = normalizeSuiAddress(owner);
  const mine = [
    ...state.listings.filter((l) => normalizeSuiAddress(l.seller) === me).map((l) => ({ id: l.id, where: 'listed' as const, price: l.price })),
    ...state.stakes.filter((s) => normalizeSuiAddress(s.owner) === me).map((s) => ({ id: s.id, where: 'staked' as Held['where'], unlockMs: s.unlockMs, weight: s.weight })),
  ];
  if (!mine.length) return [];
  const out: Held[] = [];
  for (let i = 0; i < mine.length; i += 50) {
    const part = mine.slice(i, i + 50);
    const { objects } = await client.core.getObjects({ objectIds: part.map((m) => m.id), include: { content: true } });
    part.forEach((m, k) => { const o = objects[k]; if (o && !(o instanceof Error) && o.content) { const { id, ...rest } = m; out.push({ yeti: yetiFromContent(id, o.content), ...rest }); } });
  }
  return out;
}

/** Everything the Earn tab shows; refreshes every 20 s so sales by others show up on their own. */
export function useEarn(address: string) {
  const dAppKit = useDAppKit();
  const [state, setState] = useState<EarnState | null>(null);
  const [account, setAccount] = useState<LodgeAccount>({ owed: 0n, lastClaimMs: 0 });
  const [mine, setMine] = useState<Held[]>([]);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  const load = useCallback(async (fresh = false) => {
    const client = dAppKit.getClient('testnet') as never;
    try {
      const [s, a] = await Promise.all([fetchEarnState(fresh), readAccount(client, address)]);
      const h = await heldFrom(s, address, client as ObjClient).catch(() => []);
      if (!alive.current) return;
      setState(s); setAccount(a); setMine(h); setError(null);
    } catch {
      if (alive.current) setError('Earn data could not be loaded. Check your connection and try again.');
    }
  }, [dAppKit, address]);

  useEffect(() => {
    alive.current = true;
    void load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') void load(); }, POLL_MS);
    return () => { alive.current = false; clearInterval(t); };
  }, [load]);

  const myStakes = state ? state.stakes.filter((s) => normalizeSuiAddress(s.owner) === normalizeSuiAddress(address)) : [];
  return { state, account, mine, myStakes, error, loading: !state && !error, reload: load };
}

export type { Yeti };
