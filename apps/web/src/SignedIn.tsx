import { BootLoader } from './components/BootLoader';
import { activeEgg, waitsFor } from './lib/journey';
import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { withViewTransition } from './motion/smooth';
import type { useGame } from './lib/useGame';
import { AppShell } from './components/AppShell';
import { BaseCamp } from './shell/BaseCamp';
import { useRoute } from './shell/nav';
import { ProfileSheet } from './screens/ProfileSheet';
import { KeeperSetup } from './screens/KeeperSetup';
import { EggScreen } from './screens/Egg';
import { EggNest } from './screens/EggNest';
import { GiftBanner } from './components/GiftBanner';
import { RevealScreen } from './screens/Reveal';
import { Yetis } from './screens/Yetis';
import { Play } from './screens/Play';
import { Earn } from './screens/Earn';
import { NextEggCard } from './screens/HomeCards';
import { HowToPlay, takeAutoHow } from './screens/HowToPlay';
import { Merge } from './screens/Merge';
import { ShopPage } from './screens/Shop';
import { run } from './lib/api';
import { buildSetIdentity } from './lib/flurry';
import { useToast } from './ui/Toast';
import { SnowLoader } from './ui/SnowLoader';

type Game = ReturnType<typeof useGame>;

/** Everything after sign-in (base camp, egg, reveal, den, sheets). Loaded on demand. */
export default function SignedIn({ state, refresh }: Game) {
  const [reveal, setRevealState] = useState<{ digest: string; orb?: number[] } | null>(null);
  const setReveal = (d: string | null, orb?: number[]) => setRevealState(d ? { digest: d, orb } : null);
  const [profileOpen, setProfileOpen] = useState(false);
  // A game on the Egg tab (a warming stage or today's run) takes the whole page while it runs.
  const [focus, setFocus] = useState<'egg' | null>(null);
  const [eggId, setEggId] = useState<string | null>(null);
  const [route, go, param] = useRoute();
  const setUp = state.status === 'ready' && !!state.profile && !!state.identity?.nickname;
  // First time in base camp (right after keeper setup): show the guide once.
  useEffect(() => { if (setUp && route !== 'how' && takeAutoHow()) go('how'); }, [setUp]); // eslint-disable-line react-hooks/exhaustive-deps
  const ready = state.status === 'ready' ? state : null;
  const toast = useToast();

  if (!ready || !ready.profile || !ready.identity?.nickname) {
    return (
      <AppShell>
        {state.status === 'loading' && <BootLoader label="Finding your eggs…" />}
        {ready && <KeeperSetup address={ready.address} profileId={ready.profile?.id ?? null} refresh={refresh} />}
      </AppShell>
    );
  }

  // Open on the egg being warmed (one egg at a time), else the first.
  const egg = ready.eggs.find((e) => e.id === eggId) ?? activeEgg(ready.eggs) ?? ready.eggs[0];
  return (
    <BaseCamp snap={ready} route={reveal ? 'egg' : route} onGo={(r) => withViewTransition(() => flushSync(() => { setReveal(null); go(r); }))} onProfile={() => setProfileOpen(true)}>
      {reveal && (
        <RevealScreen digest={reveal.digest} orb={reveal.orb} address={ready.address} yetis={ready.yetis} refresh={refresh} onDone={() => { setReveal(null); go('yetis'); }} />
      )}
      {!reveal && route === 'egg' && !focus && <GiftBanner snap={ready} refresh={refresh} />}
      {!reveal && route === 'egg' && !focus && <EggNest eggs={ready.eggs} selected={egg?.id ?? ''} onPick={setEggId} />}
      {!reveal && route === 'egg' && egg && (
        <EggScreen key={egg.id} address={ready.address} profile={ready.profile} egg={egg} onChanged={refresh} waiting={waitsFor(ready.eggs, egg)} onPick={setEggId}
          onFocus={(on) => setFocus(on ? 'egg' : null)} onHatched={(d) => { setFocus(null); setEggId(null); setReveal(d); }} />
      )}
      {!reveal && route === 'egg' && !focus && (
        <div className="home-cards">
          <NextEggCard snap={ready} refresh={refresh} onGo={(r) => withViewTransition(() => flushSync(() => go(r)))} />
        </div>
      )}
      {!reveal && route === 'play' && <Play snap={ready} refresh={refresh} go={(r, p) => withViewTransition(() => flushSync(() => go(r, p)))} />}
      {!reveal && route === 'earn' && <Earn snap={ready} refresh={refresh} />}
      {!reveal && route === 'shop' && <ShopPage snap={ready} refresh={refresh} />}
      {!reveal && route === 'how' && <HowToPlay onDone={() => go('egg')} />}
      {!reveal && route === 'merge' && <Merge snap={ready} onMerged={(d, els) => { void refresh(); setReveal(d, els); }} onCancel={() => go('yetis')} />}
      {!reveal && route === 'yetis' && (
        <Yetis snap={ready} refresh={refresh} yetiId={param} go={(r, p) => withViewTransition(() => flushSync(() => go(r, p)))}
          avatarYetiId={ready.identity.avatar?.kind === 'yeti' ? ready.identity.avatar.yetiId : undefined}
          onSetAvatar={async (yetiId) => {
            const r = await run(buildSetIdentity(ready.profile!.id, { avatar: { kind: 'yeti', yetiId } }), ready.address);
            if (!r.ok) throw new Error('Your avatar could not be saved. Try again.');
            await refresh((s) => s.identity?.avatar?.kind === 'yeti' && s.identity.avatar.yetiId === yetiId);
            toast('Avatar updated');
          }} />
      )}
      <ProfileSheet open={profileOpen} onClose={() => setProfileOpen(false)} snap={ready} refresh={refresh} />
    </BaseCamp>
  );
}
