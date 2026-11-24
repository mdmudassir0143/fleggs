import Lenis from 'lenis';
import { gsap, registerGsap, ScrollTrigger } from './gsap';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Buttery wheel scrolling (Lenis) kept in step with ScrollTrigger. Off under reduced motion and on
 * touch screens, which already have native momentum. Returns a stop function, or null when off.
 */
export function startSmoothScroll(): (() => void) | null {
  if (reduced() || matchMedia('(pointer: coarse)').matches) return null;
  registerGsap();
  const lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1 });
  lenis.on('scroll', ScrollTrigger.update);
  const tick = (t: number) => lenis.raf(t * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
  // In-page anchors (Skip story) glide instead of jumping.
  const onClick = (e: MouseEvent) => {
    const a = (e.target as Element).closest?.('a[href^="#"]');
    const to = a && document.querySelector(a.getAttribute('href')!);
    if (to) { e.preventDefault(); lenis.scrollTo(to as HTMLElement, { duration: 1.6 }); (to as HTMLElement).focus?.({ preventScroll: true }); }
  };
  document.addEventListener('click', onClick);
  return () => { document.removeEventListener('click', onClick); gsap.ticker.remove(tick); lenis.destroy(); };
}

/** Runs a screen change inside a View Transition when the browser has one (crossfade + shared elements). */
export function withViewTransition(update: () => void) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (typeof doc.startViewTransition !== 'function' || reduced()) { update(); return; }
  doc.startViewTransition(update);
}
