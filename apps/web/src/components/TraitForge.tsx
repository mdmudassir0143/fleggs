import { useEffect, useRef } from 'react';
import type { KIWLive } from '@flurry/games';
import { gsap, motionContext } from '../motion/gsap';
import { stageReward } from '../lib/journey';
import { sound } from '../lib/sound';

const C = 60;
/** Ten fur tufts around the face, each drawn in turn as the score grows. */
const FUR = Array.from({ length: 10 }, (_, i) => {
  const a = (i / 10) * Math.PI * 2 - Math.PI / 2, r0 = 24, r1 = 44;
  const x0 = C + Math.cos(a) * r0, y0 = C + Math.sin(a) * r0, x1 = C + Math.cos(a) * r1, y1 = C + Math.sin(a) * r1;
  const cx = C + Math.cos(a + 0.45) * 38, cy = C + Math.sin(a + 0.45) * 38;
  return `M${x0.toFixed(1)},${y0.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
});
const HORNS = ['M46,64 C38,52 30,40 24,16 C38,32 50,42 58,58 Z', 'M74,64 C82,52 90,40 96,16 C82,32 70,42 62,58 Z'];
/** A tiny yeti face, so every trait reads as part of the yeti it's growing on. */
const Face = ({ cy, r }: { cy: number; r: number }) => (
  <g className="tf-face"><circle cx={C} cy={cy} r={r} /><circle className="tf-eye" cx={C - r * 0.35} cy={cy - r * 0.05} r={2.4} /><circle className="tf-eye" cx={C + r * 0.35} cy={cy - r * 0.05} r={2.4} /><path className="tf-smile" d={`M${C - 4},${cy + r * 0.32} Q${C},${cy + r * 0.5} ${C + 4},${cy + r * 0.32}`} /></g>
);
const STAR = 'M60,22 C64,48 72,56 98,60 C72,64 64,72 60,98 C56,72 48,64 22,60 C48,56 56,48 60,22 Z';

/**
 * Beside the game: the trait this stage sets, forming as the score banks.
 * Fur grows tuft by tuft, horns draw upward (and shake in a gust), power's star brightens with
 * sparks orbiting faster as the blizzard combo climbs. The tier track pops at Fine and Rare.
 */
export function TraitForge({ stage, live }: { stage: 0 | 1 | 2; live: KIWLive | null }) {
  const root = useRef<HTMLDivElement>(null);
  const score = live?.score ?? 0;
  const p = Math.min(1, score / 1000);
  const { trait, tier } = stageReward(stage, score);
  const lastTier = useRef(tier);
  const gustOn = live?.gust === 'on';

  // The tier chip pops (with a ding) each time a better tier is reached.
  useEffect(() => {
    if (tier === lastTier.current) return;
    lastTier.current = tier;
    sound.play('ding');
    const ctx = motionContext(root.current, (reduce) => {
      if (!reduce) gsap.fromTo(root.current!.querySelector('.tf-tier'), { scale: 1.7 }, { scale: 1, duration: 0.45, ease: 'back.out(3)' });
    });
    return () => ctx.revert();
  }, [tier]);

  // Horns brace against each gust.
  useEffect(() => {
    if (!gustOn || stage !== 1) return;
    const ctx = motionContext(root.current, (reduce) => {
      if (!reduce) gsap.fromTo(root.current!.querySelector('.tf-art svg'), { x: 0 }, { x: 3, duration: 0.06, repeat: 9, yoyo: true, ease: 'none' });
    });
    return () => ctx.revert();
  }, [gustOn, stage]);

  const kind = (['fur', 'horns', 'power'] as const)[stage];
  const seg = (i: number, n: number) => Math.max(0, Math.min(1, 1 - (p * n - i)));
  return (
    <div ref={root} className={`trait-forge is-${tier.toLowerCase()}`} aria-hidden="true">
      <div className={`tf-art is-${kind} ${live?.inZone ? 'is-warm' : ''}`} style={{ ['--p' as string]: String(p), ['--spin' as string]: `${(3 / (live?.combo ?? 1)).toFixed(2)}s` }}>
        <svg viewBox="0 0 120 120">
          {kind === 'fur' && <>
            {FUR.map((d, i) => <path key={i} className="tf-line" d={d} pathLength={1} style={{ strokeDashoffset: seg(i, FUR.length) }} />)}
            <Face cy={C} r={22} />
          </>}
          {kind === 'horns' && <>
            {HORNS.map((d, i) => <path key={i} className="tf-horn" d={d} style={{ transform: `scale(${(0.15 + 0.85 * p).toFixed(3)})` }} />)}
            <Face cy={78} r={24} />
          </>}
          {kind === 'power' && <>
            <path className="tf-star" d={STAR} style={{ opacity: 0.25 + 0.75 * p, transform: `scale(${0.6 + 0.4 * p})` }} />
            <g className="tf-orbit">{[0, 120, 240].map((r) => <circle key={r} className="tf-spark" cx={C + Math.cos((r * Math.PI) / 180) * 46} cy={C + Math.sin((r * Math.PI) / 180) * 46} r={4} />)}</g>
          </>}
        </svg>
      </div>
      <div className="tf-info">
        <p className="tf-title">Forming its {trait.toLowerCase()}</p>
        <p className="tf-score"><b>{score}</b><span className="tf-tier">{tier}</span>{stage === 2 && (live?.combo ?? 1) > 1.001 && <span className="tf-combo">×{live!.combo.toFixed(1)}</span>}</p>
        <div className="tf-track" style={{ ['--p' as string]: String(p) }}><span className="tf-fill" /><i style={{ left: '40%' }} /><i style={{ left: '70%' }} /></div>
        <p className="tf-marks"><span>Common</span><span>Fine 400</span><span>Rare 700</span></p>
      </div>
    </div>
  );
}
