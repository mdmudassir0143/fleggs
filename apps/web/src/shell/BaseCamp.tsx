import { useEffect, useRef, type ReactNode } from 'react';
import { Avatar } from '../ui/Avatar';
import { Counter } from '../ui/Counter';
import { MusicToggle } from '../ui/MusicToggle';
import { SnowCount } from '../ui/SnowCount';
import { dailyState } from '../lib/daily';
import { HowLink } from '../screens/HowToPlay';
import { Icon } from '../ui/Icon';
import { resolveAvatar } from '../lib/keeper';
import type { Snapshot } from '../lib/progress';
import { MOTION, motionContext, gsap } from '../motion/gsap';
import { SkyBackdrop } from './SkyBackdrop';
import { visibleTabs, type Route } from './nav';

function Tabs({ route, onGo, vertical = false }: { route: Route; onGo: (r: Route) => void; vertical?: boolean }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const ctx = motionContext(ref.current, (reduce) => {
      if (reduce) return;
      gsap.fromTo(`.tab[aria-current="page"] .icon`, { y: 0 }, { y: -6, yoyo: true, repeat: 1, ...MOTION.tap });
    });
    return () => ctx.revert();
  }, [route]);
  return (
    <nav ref={ref} className={vertical ? 'rail-tabs' : 'tabbar'} aria-label="Main">
      {visibleTabs().map((t) => (
        <a key={t.route} href={`#${t.route}`} className="tab" aria-current={route === t.route ? 'page' : undefined}
          onClick={(e) => { e.preventDefault(); onGo(t.route); }}>
          <Icon name={t.icon} size={vertical ? 24 : 26} />
          <span>{t.label}</span>
        </a>
      ))}
    </nav>
  );
}

/**
 * Base camp: phone = top bar + stage + bottom tabs; desktop (≥1024px) = left rail + stage + side panel.
 * Everything lives in Lofi's world under a sky that follows the player's local time.
 */
export function BaseCamp({ snap, route, onGo, onProfile, children }: {
  snap: Snapshot; route: Route; onGo: (r: Route) => void; onProfile: () => void; children: ReactNode;
}) {
  const shown = resolveAvatar(snap.identity?.avatar ?? null, snap.yetis);
  const snowflakes = Number(snap.profile?.snowflakes ?? 0n);
  const nickname = snap.identity?.nickname ?? 'Keeper';
  const chip = (
    <button className="profile-chip" onClick={onProfile} aria-haspopup="dialog" aria-label={`${nickname}: open your keeper profile`}>
      <Avatar avatar={shown} size={32} />
      <span className="profile-chip-name" title={nickname}>{nickname.split(" ")[0]}</span>
    </button>
  );
  return (
    <div className={`camp ${route === 'admin' ? 'is-wide' : ''}`}>
      <SkyBackdrop />
      <header className="camp-top">
        <a className="wordmark" href="#egg" onClick={(e) => { e.preventDefault(); onGo('egg'); }}>Flurry Eggs</a>
        <MusicToggle />
        <SnowCount value={snowflakes} animated id="snowflakes" />
        {chip}
      </header>
      <aside className="camp-rail">
        <a className="wordmark" href="#egg" onClick={(e) => { e.preventDefault(); onGo('egg'); }}>Flurry Eggs</a>
        <div className="rail-body">
          <Tabs route={route} onGo={onGo} vertical />
          <div className="rail-extras"><MusicToggle className="rail-music" /><HowLink className="rail-how" /></div>
        </div>
      </aside>
      <main className="camp-stage" id="main">{children}</main>
      <aside className="camp-side" aria-label="Your keeper">
        <button className="side-keeper" onClick={onProfile} aria-haspopup="dialog">
          <Avatar avatar={shown} size={72} />
          <span className="side-name">{nickname}</span>
          <span className="hint">Edit keeper</span>
        </button>
        <div className="side-stats">
          <div><Icon name="snowflake" size={18} /><Counter value={snowflakes} label="Snowflakes" id="snowflakes-side" /><span className="hint">Snowflakes</span></div>
          <div><Icon name="flame" size={18} /><b>{dailyState(snap.profile ?? {}, Date.now()).streak}/7</b><span className="hint">Day streak</span></div>
        </div>
      </aside>
      <Tabs route={route} onGo={onGo} />
    </div>
  );
}
