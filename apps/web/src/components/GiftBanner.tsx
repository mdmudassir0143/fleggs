import { useState } from 'react';
import { run } from '../lib/api';
import { buildRedeemGift } from '../lib/admin';
import type { Snapshot } from '../lib/progress';
import { Icon } from '../ui/Icon';
import { useToast } from '../ui/Toast';
import { sound } from '../lib/sound';

/** A gift from the team waiting in the player's wallet: claim it into their Snowflakes. */
export function GiftBanner({ snap, refresh }: { snap: Snapshot; refresh: (until?: (s: Snapshot) => boolean) => Promise<void> }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const g = snap.gifts?.[0];
  if (!g || !snap.profile) return null;
  const before = snap.gifts!.length;
  async function claim() {
    setBusy(true);
    try {
      const r = await run(buildRedeemGift(g!.id, snap.profile!.id), snap.address);
      if (!r.ok) throw new Error('The gift could not be claimed. Try again.');
      await refresh((s) => (s.gifts?.length ?? 0) < before);
      sound.play('chime'); toast(`+${g!.amount} Snowflakes`);
    } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className="gift-banner" role="status">
      <span className="gift-icon" aria-hidden="true"><Icon name="snowflake" size={22} /></span>
      <span className="gift-text"><b>You got {g.amount.toString()} Snowflakes from the team</b>{g.note && <small>“{g.note}”</small>}</span>
      <button className="btn warm gift-btn" disabled={busy} onClick={claim}>{busy ? 'Claiming…' : 'Claim'}</button>
    </div>
  );
}
