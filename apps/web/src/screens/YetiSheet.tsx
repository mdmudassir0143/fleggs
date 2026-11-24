import { useState } from 'react';
import { ELEMENT_NAMES } from '@flurry/art';
import { Sheet } from '../ui/Sheet';
import { HoloCard } from '../ui/HoloCard';
import { YetiArt } from '../components/YetiArt';
import { foilFor } from '../lib/den';
import type { Snapshot } from '../lib/progress';
import { NameYeti } from '../components/NameYeti';
import type { Yeti } from '../lib/flurry';

const FOIL_LABEL = { common: 'Ice', fine: 'Frost', rare: 'Gold', mutant: 'Aurora' } as const;

/** One yeti up close: art on its foil card, traits with bands, the Walrus card, and actions. */
export function YetiSheet({ yeti, open, onClose, onSetAvatar, isAvatar, morph = false, address, refresh }: {
  yeti: Yeti; open: boolean; onClose: () => void; onSetAvatar: (yetiId: string) => Promise<void>; isAvatar: boolean; morph?: boolean;
  address?: string; refresh?: (until?: (s: Snapshot) => boolean) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const foil = foilFor(yeti.variants);
  const element = ELEMENT_NAMES[yeti.elements[0] ?? 0];
  const share = `Meet ${yeti.name}, my ${element} yeti in Flurry Eggs! ❄️`;

  async function setAvatar() {
    setBusy(true); setError(null);
    try { await onSetAvatar(yeti.id); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <Sheet open={open} onClose={onClose} title={yeti.name} enter={morph ? 'none' : 'slide'}>
      <div className="yeti-sheet">
        <HoloCard foil={foil} className={`yeti-sheet-holo ${morph ? 'vt-yeti' : ''}`}>
          {yeti.cardUrl ? <img className="yeti-sheet-cardimg" src={yeti.cardUrl} alt={`${yeti.name}'s card`} /> : <YetiArt yeti={yeti} />}
          <span className={`foil-chip foil-chip-${foil}`}>{FOIL_LABEL[foil]} foil</span>
        </HoloCard>
        <p className="yeti-sheet-meta">Level {yeti.level} · {element}</p>
        {address && refresh && <NameYeti yeti={yeti} address={address} refresh={refresh} />}
        <div className="yeti-sheet-actions">
          <button className="btn warm" onClick={setAvatar} disabled={busy || isAvatar}>
            {isAvatar ? 'This is your avatar' : busy ? 'Saving…' : 'Set as my avatar'}
          </button>
          {error && <p className="error" role="alert">{error}</p>}
          <a className="btn" target="_blank" rel="noreferrer" href={`https://x.com/intent/post?text=${encodeURIComponent(share)}${yeti.cardUrl ? `&url=${encodeURIComponent(yeti.cardUrl)}` : ''}`}>Share to X</a>
          <a className="btn ghost" target="_blank" rel="noreferrer" href={`https://suiscan.xyz/testnet/object/${yeti.id}`}>See it on Sui</a>
        </div>
      </div>
    </Sheet>
  );
}
