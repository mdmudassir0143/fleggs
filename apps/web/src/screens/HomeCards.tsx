import { useEffect, useState } from 'react';
import type { Snapshot } from '../lib/progress';
import { nextEggPaths, partnerCandidate, snowflakeEggReady } from '../lib/home';
import { run } from '../lib/api';
import { buildBuySnowflakeEgg, buildClaimPartnerEgg } from '../lib/flurry';
import { useShop } from '../lib/useShop';
import { ConfirmPurchase } from '../ui/ConfirmPurchase';
import { sound } from '../lib/sound';
import { useToast } from '../ui/Toast';
import { YetiArt } from '../components/YetiArt';
import type { Route } from '../shell/nav';
import { Icon } from '../ui/Icon';

/** "Your next egg": every way to the next egg, with progress and the action for each. */
export function NextEggCard({ snap, refresh, onGo }: { snap: Snapshot; refresh: (until?: (s: Snapshot) => boolean) => Promise<void>; onGo?: (r: Route) => void }) {
  const { shop, partnerClaimed, reload } = useShop(snap);
  const toast = useToast();
  const [confirmTrade, setConfirmTrade] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const paths = nextEggPaths(snap, Date.now(), shop?.snowflakeEggPrice);
  const flakes = Number(snap.profile?.snowflakes ?? 0n);
  const partner = partnerCandidate(snap.yetis, partnerClaimed);

  async function act(kind: 'snowflakes' | 'partner') {
    if (!snap.profile) return;
    setBusy(kind);
    const before = snap.eggs.length;
    try {
      const tx = kind === 'snowflakes' ? buildBuySnowflakeEgg(snap.profile.id) : buildClaimPartnerEgg(snap.profile.id, partner!.id);
      const r = await run(tx, snap.address);
      if (!r.ok) throw new Error('That did not go through. Try again.');
      await refresh((s) => s.eggs.length > before);
      await reload();
      sound.play('chime'); toast(kind === 'partner' ? 'A partner egg is in your nest!' : 'You traded Snowflakes for an egg!');
    } catch (e) { toast((e as Error).message); } finally { setBusy(null); }
  }

  return (
    <section className="home-card next-egg-card" aria-label="Your next egg">
      {partner && (
        <div className="partner-banner">
          <YetiArt yeti={partner} />
          <div><b>{partner.name} is ready to merge!</b><small>Here's a free egg so it can have a partner. One per keeper.</small></div>
          <button className="btn warm" disabled={!!busy} onClick={() => act('partner')}>{busy === 'partner' ? 'Claiming…' : 'Claim egg'}</button>
        </div>
      )}
      <h3 className="home-card-title">Your next egg</h3>
      <ul className="egg-paths">
        {paths.map((p) => (
          <li key={p.id} className={p.soon ? 'is-soon' : ''}>
            <span className={`ep-icon ep-${p.id}`} aria-hidden="true"><Icon name={p.id === 'streak' ? 'flame' : p.id === 'snowflakes' ? 'snowflake' : 'egg'} size={20} /></span>
            <span className="ep-text">
              <b>{p.title}</b>
              <small>{p.detail}</small>
              {p.id !== 'shop' && (
                <span className="ep-bar" role="progressbar" aria-valuemin={0} aria-valuemax={p.max} aria-valuenow={p.value} aria-label={`${p.title} progress`}>
                  <i style={{ width: `${(100 * p.value) / p.max}%` }} />
                </span>
              )}
            </span>
            {p.id === 'streak' && <span className="ep-count">{p.value}/{p.max}</span>}
            {p.id === 'snowflakes' && (
              <button className="btn ep-act" disabled={!snowflakeEggReady(flakes, p.max) || !!busy} onClick={() => setConfirmTrade(true)}>
                {busy === 'snowflakes' ? 'Trading…' : snowflakeEggReady(flakes, p.max) ? `Trade ${p.max}` : `${p.value}/${p.max}`}
              </button>
            )}
            {p.id === 'shop' && <button className="btn warm ep-act" onClick={() => onGo?.('shop')}>Open shop</button>}
          </li>
        ))}
      </ul>
      <ConfirmPurchase open={confirmTrade} item="Snowflake egg" detail="An egg of your home element." price={BigInt(shop?.snowflakeEggPrice ?? 400)} currency="Snowflakes"
        balance={BigInt(flakes)} busy={busy === 'snowflakes'} onConfirm={async () => { await act('snowflakes'); setConfirmTrade(false); }} onClose={() => setConfirmTrade(false)} />
    </section>
  );
}

