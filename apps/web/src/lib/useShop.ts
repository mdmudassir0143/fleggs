import { useCallback, useEffect, useState } from 'react';
import { useDAppKit } from '@mysten/dapp-kit-react';
import { getPartnerClaimed, getShop, getSuiBalance, type Shop } from './flurry';
import type { Snapshot } from './progress';

/** Live shop prices, the player's SUI balance and whether the partner egg was claimed. */
export function useShop(snap: Snapshot) {
  const dAppKit = useDAppKit();
  const [shop, setShop] = useState<Shop | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [partnerClaimed, setPartnerClaimed] = useState(true);
  const load = useCallback(async () => {
    const client = dAppKit.getClient('testnet') as never;
    const [s, b, c] = await Promise.all([
      getShop(client).catch(() => null),
      getSuiBalance(client, snap.address).catch(() => 0n),
      snap.profile ? getPartnerClaimed(client, snap.profile.id).catch(() => true) : Promise.resolve(true),
    ]);
    setShop(s); setBalance(b); setPartnerClaimed(c);
  }, [dAppKit, snap.address, snap.profile]);
  useEffect(() => { void load(); }, [load]);
  return { shop, balance, partnerClaimed, reload: load };
}
