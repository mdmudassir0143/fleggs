import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin';
import { Flip } from 'gsap/Flip';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { CustomEase } from 'gsap/CustomEase';
import { CustomBounce } from 'gsap/CustomBounce';
import { CustomWiggle } from 'gsap/CustomWiggle';

/** Motion tokens from the UX spec §3. */
export const MOTION = {
  tap: { duration: 0.12, ease: 'power2.out' },
  ui: { duration: 0.22, ease: 'power2.out' },
  enter: { duration: 0.45, ease: 'back.out(1.6)' },
  hero: { duration: 0.9, ease: 'expo.out' },
  stagger: 0.06,
} as const;

let registered = false;

/** Registers every plugin we use once, plus our named eases. */
export function registerGsap() {
  if (!registered) {
    gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin, MorphSVGPlugin, Flip, MotionPathPlugin, CustomEase, CustomBounce, CustomWiggle);
    CustomEase.create('snowfall', 'M0,0 C0.2,0.6 0.3,1 1,1');
    registered = true;
  }
  return gsap;
}

/**
 * Builds animations once for the current motion preference. `build(true)` must show the
 * end state with no movement (WCAG 2.3.3). Revert the returned context on unmount.
 */
export function motionContext(scope: Element | null, build: (reduce: boolean) => void) {
  const g = registerGsap();
  const mm = g.matchMedia(scope ?? undefined);
  mm.add({ reduce: '(prefers-reduced-motion: reduce)', full: '(prefers-reduced-motion: no-preference)' }, (ctx) => {
    build(Boolean(ctx.conditions?.reduce));
  });
  return mm;
}

/** Jump a timeline to its final frame (the reduced-motion presentation). */
export function settle(tl: gsap.core.Timeline) {
  tl.progress(1).pause();
  return tl;
}

export { gsap, ScrollTrigger, SplitText, Flip };
