import { useLayoutEffect, useRef } from 'react';
import { gsap, motionContext } from '../motion/gsap';
import { stageReward } from '../lib/journey';
import { sound } from '../lib/sound';
import { EggArt } from './EggArt';
import { TraitGlyph } from './TraitGlyph';

/**
 * Right after a warming stage: the egg reacts (bigger for a better score) and the trait it set is
 * revealed with the tier the chain will roll at hatch.
 */
export function StageReward({ stage, score, element, onNext }: { stage: 0 | 1 | 2; score: number; element?: number; onNext: () => void }) {
  const root = useRef<HTMLElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const { trait, tier } = stageReward(stage, score);
  const power = tier === 'Rare' ? 1 : tier === 'Fine' ? 0.6 : 0.3;

  useLayoutEffect(() => {
    next.current?.focus(); // the button that started the stage is gone; keep keyboard users in place
    sound.play(tier === 'Rare' ? 'levelup' : 'chime');
    const ctx = motionContext(root.current, (reduce) => {
      if (reduce) return;
      const q = gsap.utils.selector(root.current);
      gsap.timeline()
        .from(q('.sr-egg'), { scale: 0.85, duration: 0.3, ease: 'power2.out' })
        .to(q('.sr-egg'), { rotation: 6 * power, duration: 0.07, yoyo: true, repeat: 5 + Math.round(power * 4), ease: 'sine.inOut' })
        .fromTo(q('.sr-glow'), { scale: 0.4, opacity: 0 }, { scale: 1 + power * 0.5, opacity: 0.55 + power * 0.4, duration: 0.5, ease: 'power2.out' }, '<')
        .from(q('.sr-card'), { y: 24, opacity: 0, duration: 0.45, ease: 'back.out(1.8)' }, '-=0.2')
        .from(q('.sr-tier'), { scale: 1.8, opacity: 0, duration: 0.4, ease: 'back.out(2.4)' }, '-=0.15')
        .from(q('.sr-next'), { opacity: 0, y: 8, duration: 0.3 }, '-=0.1');
    });
    return () => ctx.revert();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section ref={root} className={`stage-reward tier-${tier.toLowerCase()}`}>
      <div className="sr-hero">
        <span className="sr-glow" aria-hidden="true" />
        <div className="sr-egg"><EggArt stage={(stage + 1) as 1 | 2 | 3} element={element} className="egg-big" /></div>
      </div>
      <div className="sr-card" aria-live="polite">
        <p className="sr-label">Trait unlocked</p>
        <p className="sr-trait"><span className="sr-glyph" aria-hidden="true"><TraitGlyph slot={stage} /></span>{trait}<span className="sr-tier">{tier}</span></p>
        <p className="sr-score">You scored {score}. {tier === 'Rare' ? 'The rarest look for its ' + trait.toLowerCase() + '!' : tier === 'Fine' ? `700+ would have made it Rare.` : `400+ makes it Fine, 700+ Rare.`}</p>
      </div>
      <button ref={next} className="btn warm big sr-next" onClick={onNext}>{stage === 2 ? 'Get ready to hatch' : 'Warm the next stage'}</button>
    </section>
  );
}
