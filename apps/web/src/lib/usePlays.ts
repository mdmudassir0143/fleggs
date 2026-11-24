import { useCallback, useEffect, useState } from 'react';
import { useDAppKit } from '@mysten/dapp-kit-react';
import { EXTRA_PLAY_PRICE, dayIndex, playsLeft, readExtraPlayPrice, readPlays } from '@flurry/shared';
import type { Snapshot } from './progress';

/** Plays left today for each of the four games, plus the live extra-play price. */
export function usePlays(snap: Snapshot) {
  const dAppKit = useDAppKit();
  const [left, setLeft] = useState(() => [0, 1, 2, 3].map(() => playsLeft(null, dayIndex(Date.now()))));
  const [price, setPrice] = useState<bigint>(EXTRA_PLAY_PRICE);
  const load = useCallback(async () => {
    if (!snap.profile) return;
    const client = dAppKit.getClient('testnet') as never;
    const day = dayIndex(Date.now());
    const [plays, p] = await Promise.all([
      Promise.all([0, 1, 2, 3].map((g) => readPlays(client, snap.profile!.id, g).catch(() => null))),
      readExtraPlayPrice(client).catch(() => EXTRA_PLAY_PRICE),
    ]);
    setLeft(plays.map((x) => playsLeft(x, day)));
    setPrice(p);
  }, [dAppKit, snap.profile]);
  useEffect(() => { void load(); }, [load]);
  return { left, price, reload: load };
}
