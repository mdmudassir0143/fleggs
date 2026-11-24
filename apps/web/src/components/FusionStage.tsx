import { useEffect, useLayoutEffect, useRef } from 'react';
import { ELEMENT_COLORS } from '@flurry/art';
import { gsap, motionContext } from '../motion/gsap';
import { YetiArt } from './YetiArt';
import type { Yeti } from '../lib/flurry';

const SPARKS = 16;

/**
 * The merge, as one GSAP sequence in three acts:
 *  1. gather: both yetis hop in and start circling a glowing core;
 *  2. charge: they orbit faster and closer while snow streams into the core (loops until the
 *     transaction lands);
 *  3. fuse: they collapse into the core, which flares to a white flash, then `onFused` hands over
 *     to the orb reveal. With reduced motion (or no animation), `onFused` fires as soon as `done`.
 */
export function FusionStage({ a, b, done, onFused }: { a: Yeti; b: Yeti; done: boolean; onFused: () => void }) {
  const root = useRef<HTMLElement>(null);
  const intro = useRef<gsap.core.Timeline | null>(null);
  const loops = useRef<gsap.core.Animation[]>([]);
  const fused = useRef(false);
  const ca = ELEMENT_COLORS[a.elements[0] ?? 0], cb = ELEMENT_COLORS[b.elements[0] ?? 0];

  useLayoutEffect(() => {
    const ctx = motionContext(root.current, (reduce) => {
      if (reduce) return;
      const q = gsap.utils.selector(root.current);
      gsap.set(q('.fs-spark'), { opacity: 0 });
      const spin = gsap.to(q('.fs-orbit'), { rotation: 360, duration: 2.4, ease: 'none', repeat: -1, paused: true });
      const counter = gsap.to(q('.fs-yeti'), { rotation: -360, duration: 2.4, ease: 'none', repeat: -1, paused: true });
      const pulse = gsap.to(q('.fs-core'), { scale: 1.12, duration: 0.5, ease: 'sine.inOut', yoyo: true, repeat: -1, paused: true });
      const rings = gsap.fromTo(q('.fs-ring'), { scale: 0.4, opacity: 0.9 }, { scale: 2.2, opacity: 0, duration: 1.6, ease: 'power1.out', stagger: 0.8, repeat: -1, paused: true });
      const sparks = q('.fs-spark').map((el: Element, i: number) => {
        const ang = (i / SPARKS) * Math.PI * 2, r = 130 + (i % 3) * 24;
        return gsap.fromTo(el, { x: Math.cos(ang) * r, y: Math.sin(ang) * r, opacity: 0, scale: 1 },
          { x: 0, y: 0, opacity: 1, scale: 0.3, duration: 1.1, ease: 'power2.in', repeat: -1, delay: (i % 8) * 0.14, paused: true });
      });
      loops.current = [spin, counter, pulse, rings, ...sparks];

      intro.current = gsap.timeline()
        .from(q('.fs-a'), { x: -170, opacity: 0, duration: 0.55, ease: 'back.out(1.7)' }, 0)
        .from(q('.fs-b'), { x: 170, opacity: 0, duration: 0.55, ease: 'back.out(1.7)' }, 0.08)
        .from(q('.fs-core'), { scale: 0, duration: 0.6, ease: 'back.out(2)' }, 0.2)
        .to(q('.fs-yeti'), { y: -26, duration: 0.22, ease: 'power2.out', yoyo: true, repeat: 1, stagger: 0.08 }, 0.55)
        .add(() => loops.current.forEach((l) => l.play()), 1.0)
        .to(q('.fs-a'), { x: -70, duration: 2.2, ease: 'power1.inOut' }, 1.0)
        .to(q('.fs-b'), { x: 70, duration: 2.2, ease: 'power1.inOut' }, 1.0)
        .to(loops.current.slice(0, 2), { timeScale: 2.2, duration: 2.2, ease: 'power1.in' }, 1.0)
        .to(q('.fs-core'), { '--fs-glow': 1, duration: 2.2 }, 1.0);
    });
    return () => { ctx.revert(); loops.current = []; intro.current = null; };
  }, []);

  useEffect(() => {
    if (!done || fused.current) return;
    fused.current = true;
    const tl = intro.current;
    if (!tl) { onFused(); return; }
    const q = gsap.utils.selector(root.current);
    const fuse = () => gsap.timeline({ onComplete: onFused })
      .to(loops.current.slice(0, 2), { timeScale: 6, duration: 0.5, ease: 'power2.in' }, 0)
      .to(q('.fs-yeti'), { x: 0, scale: 0.15, opacity: 0, duration: 0.6, ease: 'power3.in' }, 0)
      .to(q('.fs-core'), { scale: 2.6, duration: 0.6, ease: 'power3.in' }, 0.05)
      .to(q('.fs-stage'), { x: 4, duration: 0.05, repeat: 7, yoyo: true, ease: 'none' }, 0.35)
      .to(q('.fs-flash'), { opacity: 1, duration: 0.22, ease: 'power2.in' }, 0.55)
      .to(q('.fs-status'), { opacity: 0, duration: 0.2 }, 0.4);
    // Let act 1 finish so even a fast merge reads as a fusion.
    if (tl.progress() < 0.45) tl.eventCallback('onUpdate', () => { if (tl.progress() >= 0.45) { tl.eventCallback('onUpdate', null); fuse(); } });
    else fuse();
  }, [done, onFused]);

  return (
    <section ref={root} className="fusion" aria-live="polite" style={{ ['--ca' as string]: ca, ['--cb' as string]: cb }}>
      <div className="fs-stage">
        <span className="fs-ring" aria-hidden="true" /><span className="fs-ring" aria-hidden="true" />
        <span className="fs-core" aria-hidden="true" />
        {Array.from({ length: SPARKS }, (_, i) => <span key={i} className={`fs-spark ${i % 2 ? 'is-b' : ''}`} aria-hidden="true" />)}
        <div className="fs-orbit">
          <div className="fs-yeti fs-a"><YetiArt yeti={a} /></div>
          <div className="fs-yeti fs-b"><YetiArt yeti={b} /></div>
        </div>
      </div>
      <p className="fs-status">{done ? 'Fused!' : 'Fusing your yetis…'}</p>
      <span className="fs-flash" aria-hidden="true" />
    </section>
  );
}
