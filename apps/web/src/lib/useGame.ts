import { useCallback, useEffect, useState } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit-react';
import { dAppKit } from '../dappKit';
import { readIdentity } from '@flurry/shared';
import { getMyEggs, getMyHeld, getMyProfile, getMyYetis } from './flurry';
import { getMyAdminCap, getMyGifts } from './admin';
import { progress, type Snapshot } from './progress';
import { pollUntil } from './poll';

export type GameState =
  | { status: 'signed-out' }
  | { status: 'loading'; address: string }
  | ({ status: 'ready' } & Snapshot);

/** The signed-in player's profile, eggs and yetis, re-read from chain on demand. */
export function useGame() {
  const account = useCurrentAccount();
  const [state, setState] = useState<GameState>({ status: 'signed-out' });

  const load = useCallback(async (): Promise<Snapshot | null> => {
    if (!account) return null;
    const client = dAppKit.getClient('testnet');
    const [profile, eggs, yetis, held, adminCapId, gifts] = await Promise.all([
      getMyProfile(client, account.address),
      getMyEggs(client, account.address),
      getMyYetis(client, account.address),
      getMyHeld(client, account.address).catch(() => []),
      getMyAdminCap(client, account.address),
      getMyGifts(client, account.address),
    ]);
    const identity = profile ? await readIdentity(client, profile.id) : null;
    return { address: account.address, profile, eggs, yetis, identity, held, adminCapId, gifts };
  }, [account]);

  /** After a transaction, keep re-reading until the chain shows the player's progress moved. */
  const refresh = useCallback(async (until?: (s: Snapshot) => boolean) => {
    const before = state.status === 'ready' ? progress(state) : -Infinity;
    const snap = await pollUntil(load, (s) => !s || (until ? until(s) : progress(s) > before));
    setState(snap ? { status: 'ready', ...snap } : { status: 'signed-out' });
  }, [load, state]);

  useEffect(() => {
    if (!account) return setState({ status: 'signed-out' });
    setState({ status: 'loading', address: account.address });
    load().then((snap) => setState(snap ? { status: 'ready', ...snap } : { status: 'signed-out' }));
  }, [account, load]);

  return { state, refresh };
}
