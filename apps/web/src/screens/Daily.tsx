import { useEffect, useState } from 'react';
import { ELEMENT_COLORS } from '@flurry/art';
import { PURPOSE } from '@flurry/shared';
import { buildSubmitDaily } from '../lib/flurry';
import type { Snapshot } from '../lib/progress';
import { dailyState, type StepState } from '../lib/daily';
import { GAME_INFO, formatDuration } from '../lib/train';
import { RunFlow } from '../components/RunFlow';
import { music } from '../lib/music';
import { sound } from '../lib/sound';
import { useToast } from '../ui/Toast';

/** Today's run: one game a day; seven days in a row lays a free egg in your nest. */
export function Daily({ snap, refresh, onFocus }: { snap: Snapshot; refresh: (until?: (s: Snapshot) => boolean) => Promise<void>; onFocus?: (on: boolean) => void }) {
  const [now, setNow] = useState(Date.now());
  const [playing, setPlaying] = useState(false);
  const toast = useToast();
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);
  // While the run is up, the Egg tab shows only the game.
  useEffect(() => { onFocus?.(playing); }, [playing]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!snap.profile) return null;
  const d = dailyState(snap.profile, now);
  const info = GAME_INFO[d.game];
  const yeti = snap.yetis[0];

  if (playing) {
    const eggsBefore = snap.eggs.length;
    return (
      <RunFlow snap={snap} purpose={PURPOSE.Daily} game={d.game} yeti={yeti} title={`Today's run · ${info.name}`}
        build={(a) => buildSubmitDaily(snap.profile!.id, d.game, a)}
        until={(s) => s.profile?.lastDailyDay === d.day}
        refresh={async (until) => {
          await refresh(until);
        }}
        onExit={() => {
          setPlaying(false);
          if (snap.eggs.length > eggsBefore || dailyState(snap.profile!, Date.now()).eggToday) { sound.play('levelup'); toast('Seven days in a row! A streak egg is in your nest.'); }
        }} />
    );
  }

  return (
    <section className="daily" style={{ ['--el' as string]: ELEMENT_COLORS[info.element] }} aria-label="Today's run">
      <div className="daily-top">
        <div>
          <p className="keeper-label">Today's run</p>
          <h3 className="daily-game">{info.name}</h3>
          <p className="daily-blurb">{info.blurb}</p>
        </div>
        {d.doneToday
          ? <p className="daily-done">{d.eggToday ? 'Streak egg earned!' : 'Done for today'}<small>Next run in {formatDuration(d.msUntilNext)}</small></p>
          : <button className="btn warm daily-play" onClick={() => { music.unlock(); setPlaying(true); }}>Play today's run</button>}
      </div>
      <ol className="streak-path" aria-label={`Streak ${d.streak} of 7 days`}>
        {d.steps.map((s, i) => <li key={i} className={`step step-${s}`}><StepIcon s={s} i={i} /></li>)}
      </ol>
      <p className="daily-note">{d.broken ? 'Your streak melted. Start a new one today.' : d.doneToday && d.eggToday ? 'A new streak starts tomorrow.' : `${7 - d.streak - (d.doneToday ? 0 : 0)} more ${7 - d.streak === 1 ? 'day' : 'days'} to a free egg.`}</p>
    </section>
  );
}

/** A snowy footprint for each day; the seventh is the egg. */
export function StepIcon({ s, i }: { s: StepState; i: number }) {
  if (i === 6) {
    return (
      <svg viewBox="0 0 40 46" aria-hidden="true"><path d="M20 3c9 0 16 15 16 25 0 9-7 15-16 15S4 37 4 28C4 18 11 3 20 3z" fill={s === 'done' ? '#FFE3C7' : '#E6F2FB'} stroke="#14213D" strokeWidth="3" /><circle cx="26" cy="20" r="3" fill="#9CC3E6" /><circle cx="14" cy="30" r="4" fill="#9CC3E6" /></svg>
    );
  }
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <ellipse cx="20" cy="24" rx="10" ry="12" fill={s === 'done' ? 'var(--el)' : '#fff'} stroke="#14213D" strokeWidth="3" />
      {[[11, 9], [18, 6], [25, 7], [31, 11]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="3.4" fill={s === 'done' ? 'var(--el)' : '#fff'} stroke="#14213D" strokeWidth="2.5" />)}
    </svg>
  );
}
