import { useState } from 'react';
import { ELEMENT_COLORS } from '@flurry/art';
import type { Snapshot } from '../lib/progress';
import type { Route } from '../shell/nav';
import { Daily } from './Daily';
import { GamesBoard } from '../components/GamesBoard';
import { YetiArt } from '../components/YetiArt';
import { PageHead } from '../ui/PageHead';
import { InfoTip } from '../ui/InfoTip';
import { Icon } from '../ui/Icon';

/** The Play tab: today's run (the streak), then the four games that earn Snowflakes. */
export function Play({ snap, refresh, go }: {
  snap: Snapshot; refresh: (until?: (s: Snapshot) => boolean) => Promise<void>; go: (r: Route, param?: string | null) => void;
}) {
  const [focus, setFocus] = useState<'daily' | 'games' | null>(null);
  const [pick, setPick] = useState(snap.yetis[0]?.id ?? '');
  const yeti = snap.yetis.find((y) => y.id === pick) ?? snap.yetis[0];
  const flakes = Number(snap.profile?.snowflakes ?? 0n);

  if (!yeti) {
    return (
      <section className="play-tab">
        <PageHead title="Play" />
        <div className="history-empty"><p><b>Games unlock with your first yeti.</b> Warm your egg and hatch it to start playing.</p>
          <button className="btn warm" onClick={() => go('egg')}>Warm my egg</button></div>
      </section>
    );
  }

  return (
    <section className="play-tab">
      {!focus && <PageHead title="Play" count={<><Icon name="snowflake" size={15} /> {flakes}</>} />}
      {focus !== 'games' && <Daily snap={snap} refresh={refresh} onFocus={(on) => setFocus(on ? 'daily' : null)} />}

      {focus !== 'daily' && (
        <>
          {!focus && (
            <>
              <div className="label-row">
                <h3 className="keeper-label">Play to earn Snowflakes</h3>
                <InfoTip label="About free plays" align="end">2 free plays per game each day (resets 00:00 UTC). Extra plays are in the Shop.</InfoTip>
              </div>
              {snap.yetis.length > 1 && (
                <div className="play-with" role="radiogroup" aria-label="Play with which yeti (its traits give the bonus)">
                  <span className="play-with-label">Bonus from</span>
                  {snap.yetis.map((y) => (
                    <button key={y.id} role="radio" aria-checked={y.id === yeti.id} className={`pw-chip ${y.id === yeti.id ? 'is-on' : ''}`}
                      style={{ ['--el' as string]: ELEMENT_COLORS[y.elements[0] ?? 0] }} onClick={() => setPick(y.id)}>
                      <span className="pw-art" aria-hidden="true"><YetiArt yeti={y} /></span>{y.name}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          <GamesBoard snap={snap} yeti={yeti} refresh={refresh} onFocus={(on) => setFocus(on ? 'games' : null)} onTrain={() => go('yetis', yeti.id)} />
        </>
      )}
    </section>
  );
}
