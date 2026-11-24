import { useState } from 'react';
import { post, run } from '../lib/api';
import { buildAttachLore, type Yeti } from '../lib/flurry';
import type { LoreResult } from '../lib/reveal';
import type { Snapshot } from '../lib/progress';
import { LofiThinking } from './LofiThinking';

/** For a yeti whose naming never finished at hatch: Lofi names it now and saves its card. */
export function NameYeti({ yeti, address, refresh, compact = false }: {
  yeti: Yeti; address: string; refresh: (until?: (s: Snapshot) => boolean) => Promise<void>; compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (yeti.named) return null;
  async function name() {
    setBusy(true); setError(null);
    try {
      const lore = await post('/lore/yeti', { yetiId: yeti.id }) as LoreResult;
      const r = await run(buildAttachLore(yeti.id, lore), address);
      if (!r.ok) throw new Error('The name could not be saved. Try again.');
      await refresh((s) => !!s.yetis.find((y) => y.id === yeti.id)?.named);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className={`name-yeti ${compact ? 'is-compact' : ''}`}>
      {busy ? <LofiThinking compact={compact} /> : <button className="btn warm" onClick={name}>Give it a name</button>}
      {!compact && !busy && <p className="hint">This yeti hatched before Lofi could name it. Tap and Lofi will pick a name and draw its card.</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
