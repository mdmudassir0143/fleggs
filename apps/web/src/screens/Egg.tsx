import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Flip, gsap, motionContext } from '../motion/gsap';
import { GameFinish } from './GameFinish';
import { PURPOSE, GAME } from '@flurry/shared';
import type { KIWInput } from '@flurry/games';
import { LazyGameHost as GameHost } from '../components/LazyGameHost';
import { EggArt } from '../components/EggArt';
import { post, run } from '../lib/api';
import type { Egg as EggT, Profile } from '../lib/flurry';
import { buildHatch, submitStageWithRetry, type Attested } from '../lib/stages';
import { eggHint, journey, shownStage, stageCopy, stageIntro, stageReward } from '../lib/journey';
import { StageReward } from '../components/StageReward';
import { TraitForge } from '../components/TraitForge';
import type { KIWLive } from '@flurry/games';
import { sound } from '../lib/sound';
import { TraitGlyph } from '../components/TraitGlyph';



type Phase =
  | { kind: 'ready' }
  | { kind: 'playing'; runId: string; seed: number; stage: 0 | 1 | 2 }
  | { kind: 'saving'; score: number; stage: 0 | 1 | 2 }
  | { kind: 'done'; score: number; stage: 0 | 1 | 2; error: string | null }
  | { kind: 'hatching' };

export function EggScreen({ address, profile, egg, onChanged, onHatched, onFocus, waiting = null, onPick }: {
  address: string; profile: Profile; egg: EggT; onChanged: () => void; onHatched: (digest: string) => void; onFocus?: (on: boolean) => void;
  /** Another egg is in progress: this one waits its turn (one egg at a time). */
  waiting?: { id: string; name: string } | null; onPick?: (id: string) => void;
}) {
  const [justDone, setJustDone] = useState<{ egg: string; stage: number } | null>(null);
  const stage = shownStage(egg.stageScores.length, justDone?.egg === egg.id ? justDone.stage : null);
  const [phase, setPhase] = useState<Phase>({ kind: 'ready' });
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<KIWLive | null>(null);
  const flip = useRef<Flip.FlipState | null>(null);
  const focused = phase.kind === 'playing' || phase.kind === 'saving' || phase.kind === 'done';
  useEffect(() => { onFocus?.(focused); }, [focused]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onFocus?.(false), []); // eslint-disable-line react-hooks/exhaustive-deps

  // The egg grows into the game frame (shared element: data-flip-id="egg-stage").
  useLayoutEffect(() => {
    if (phase.kind !== 'playing' || !flip.current) return;
    const state = flip.current;
    flip.current = null;
    const ctx = motionContext(document.body, (reduce) => {
      if (!reduce) Flip.from(state, { targets: '[data-flip-id="egg-stage"]', duration: 0.6, ease: 'power3.inOut', scale: true, fade: true, absolute: true });
    });
    return () => ctx.revert();
  }, [phase.kind]);

  async function play() {
    setError(null);
    try {
      // The Worker picks the stage (calm, wind, blizzard) from this egg's progress on chain.
      const { runId, seed, stage: st } = await post('/run/start', { profileId: profile.id, purpose: PURPOSE.EggStage, game: GAME.KeepItWarm, eggId: egg.id });
      flip.current = Flip.getState('[data-flip-id="egg-stage"]');
      setLive(null);
      setPhase({ kind: 'playing', runId, seed, stage: (st ?? 0) as 0 | 1 | 2 });
    } catch (e) { setError((e as Error).message); }
  }

  async function finished(runId: string, score: number, inputs: KIWInput[], st: 0 | 1 | 2) {
    setPhase({ kind: 'saving', score, stage: st });
    try {
      const a: Attested = { runId, ...(await post('/run/finish', { runId, inputs })) };
      await submitStageWithRetry(a, { eggId: egg.id, profileId: profile.id }, {
        execute: (tx) => run(tx, address),
        reattest: async (id) => ({ runId: id, ...(await post('/run/reattest', { runId: id })) }),
      });
      setPhase({ kind: 'done', score, stage: st, error: null });
      onChanged();
    } catch (e) {
      setPhase({ kind: 'done', score, stage: st, error: (e as Error).message });
    }
  }

  async function hatch() {
    setPhase({ kind: 'hatching' });
    setError(null);
    try {
      const res = await run(buildHatch(egg.id), address);
      if (!res.ok) throw new Error('The egg would not hatch. Try again.');
      onHatched(res.digest);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
      setPhase({ kind: 'ready' });
    }
  }

  if (phase.kind === 'playing') {
    return (
      <section className="play play-egg">
        <p className="play-head pe-head">Stage {phase.stage + 1} of 3 · {stageIntro(phase.stage).name}</p>
        <div className="pe-body">
          <div className="pe-col">
            <div className="pe-forge"><TraitForge stage={phase.stage} live={live} /></div>
            <div className="game-frame pe-game" data-flip-id="egg-stage">
              <GameHost seed={phase.seed} stage={phase.stage} onFrame={setLive} onFinish={(r, inputs) => finished(phase.runId, r.score, inputs as KIWInput[], phase.stage)} />
            </div>
          </div>
        </div>
        <p className="hint pe-rule">{stageIntro(phase.stage).rule}</p>
      </section>
    );
  }

  if (phase.kind === 'done' && !phase.error) {
    return <section className="play"><StageReward stage={phase.stage} element={egg.element} score={phase.score} onNext={() => { setJustDone({ egg: egg.id, stage: phase.stage }); setPhase({ kind: 'ready' }); }} /></section>;
  }

  if (phase.kind === 'saving' || phase.kind === 'done') {
    return (
      <section className="play">
        <GameFinish
          score={phase.score} snowflakes={0}
          saving={phase.kind === 'saving'} error={phase.kind === 'done' ? phase.error : null}
          onRetry={() => { setPhase({ kind: 'ready' }); void play(); }}
          onContinue={() => setPhase({ kind: 'ready' })}
        />
      </section>
    );
  }

  const eggStage = (stage === 'hatch' ? 3 : stage) as 0 | 1 | 2 | 3;
  const copy = stageCopy(stage);
  const steps = journey(egg.stageScores);
  const hint = eggHint(egg.stageScores.length);
  const intro = stage === 'hatch' ? null : stageIntro(stage);
  // Between stages the egg is alive: tap it and it wobbles with a heartbeat.
  function pet(e: React.MouseEvent<HTMLButtonElement>) {
    sound.play('heartbeat');
    const btn = e.currentTarget, hero = btn.parentElement!;
    const el = btn.querySelector('.egg-big');
    if (!el || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    gsap.killTweensOf(el);
    // A happy hop…
    gsap.timeline().to(el, { y: -18, scaleY: 1.04, duration: 0.18, ease: 'power2.out' })
      .to(el, { y: 0, scaleY: 0.94, scaleX: 1.05, duration: 0.16, ease: 'power2.in' })
      .to(el, { scaleY: 1, scaleX: 1, duration: 0.4, ease: 'elastic.out(1, 0.45)' });
    // …a warm ripple…
    const ring = document.createElement('span');
    ring.className = 'egg-ripple';
    hero.appendChild(ring);
    gsap.fromTo(ring, { scale: 0.5, opacity: 0.8 }, { scale: 1.5, opacity: 0, duration: 0.7, ease: 'power2.out', onComplete: () => ring.remove() });
    // …and a few hearts and snowflakes drifting up.
    for (let i = 0; i < 6; i++) {
      const p = document.createElement('span');
      p.className = `egg-pop ${i % 2 ? 'is-flake' : 'is-heart'}`;
      p.textContent = i % 2 ? '❄' : '♥';
      hero.appendChild(p);
      const x = (i - 2.5) * 40 + gsap.utils.random(-10, 10);
      gsap.fromTo(p, { x: x * 0.25, y: -40, scale: 0.4, opacity: 0 },
        { keyframes: [{ opacity: 1, scale: 1, duration: 0.18 }, { x, y: gsap.utils.random(-190, -140), rotation: gsap.utils.random(-30, 30), opacity: 0, duration: 1.1, ease: 'power1.out' }],
          delay: i * 0.04, onComplete: () => p.remove() });
    }
  }
  const label = waiting ? 'Waiting its turn' : stage === 'hatch' ? 'All three traits set' : `Stage ${stage + 1} of 3 · 30 seconds`;
  const title = waiting ? 'Next in line' : copy.title;
  return (
    <section className="egg-screen ev">
      <div className="ev-hero">
        <span className={`temp-badge ${stage === 'hatch' ? 'is-warm' : ''}`} aria-label={`Egg temperature ${copy.temp}`}>{copy.temp}</span>
        <span className={`egg-aura is-${eggStage}`} aria-hidden="true" />
        <button className="egg-stage egg-pet" data-flip-id="egg-stage" onClick={pet} aria-label={`Pet your egg (${copy.temp}, ${egg.stageScores.length} of 3 stages warm)`}>
          <EggArt stage={eggStage} element={egg.element} className={`egg-big ${stage === 'hatch' ? 'ready' : ''}`} />
        </button>
        {hint && !waiting && <p className="egg-hint">{hint}</p>}
      </div>

      <div className="ev-panel">
        <div className="ev-head"><small>{label}</small><h2>{title}</h2></div>
        {waiting ? (
          <p className="ev-line">Finish and hatch your {waiting.name} first. One egg warms at a time, so each one gets your full attention.</p>
        ) : intro ? (
          <div className={`ev-rule is-s${stage}`}><b>{intro.name}</b><span>{intro.rule}</span></div>
        ) : (
          <p className="ev-line">{copy.line}</p>
        )}
        <div className="ev-meter" style={{ ['--fill' as string]: `${copy.fill}%` }} aria-hidden="true"><span /><small>−40°C</small><small>0°C</small></div>
        <ol className="ev-steps" aria-label="Warming stages">
          {steps.map((st, i) => {
            const tier = st.state === 'done' ? stageReward(i as 0 | 1 | 2, st.score).tier : null;
            return (
              <li key={st.trait} className={`ev-step is-${waiting && st.state === 'next' ? 'locked' : st.state}`}>
                <span className="ev-badge" aria-hidden="true"><TraitGlyph slot={i} /></span>
                <span className="ev-trait"><b>{st.trait}</b><small>{stageIntro(i as 0 | 1 | 2).name}</small></span>
                {st.state === 'done' ? (
                  <span className="ev-result"><b className={`tier-chip is-${tier!.toLowerCase()}`}>{tier}</b><small>{st.score}</small></span>
                ) : <span className="ev-wait">{st.state === 'next' && !waiting ? 'Up next' : 'Waiting'}</span>}
              </li>
            );
          })}
        </ol>
        {waiting ? (
          onPick && <button className="btn big" onClick={() => onPick(waiting.id)}>Go to your {waiting.name}</button>
        ) : stage === 'hatch' ? (
          <button className="btn warm big" onClick={hatch} disabled={phase.kind !== 'ready'}>{phase.kind === 'hatching' ? 'Hatching…' : 'Hatch my yeti'}</button>
        ) : (
          <button className="btn warm big" onClick={play} disabled={phase.kind !== 'ready'}>Warm its {steps[stage].trait.toLowerCase()}</button>
        )}
        {error && <p className="error" role="alert">{error}</p>}
      </div>
    </section>
  );
}
