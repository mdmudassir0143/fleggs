import { gsap, registerGsap, motionContext } from './gsap';

/** Seconds until the next blink: natural-looking, between 2 and 5 s. */
export function nextBlinkDelay(rand: () => number): number {
  return 2 + Math.min(0.999, rand()) * 3;
}

/**
 * Idle life for every character with rig hooks: breathing, random blinks, scarf sway, and
 * (desktop) pupils that follow the pointer. Returns a cleanup. Does nothing with reduced motion.
 */
export function bringToLife(root: Element, opts: { track?: boolean }): () => void {
  registerGsap();
  const timers: ReturnType<typeof setTimeout>[] = [];
  const later = (fn: () => void, ms: number) => { timers.push(setTimeout(fn, ms)); };
  let onMove: ((e: PointerEvent) => void) | undefined;
  const ctx = motionContext(root, (reduce) => {
    if (reduce) return;
    const eyes = Array.from(root.querySelectorAll('[data-rig="pupil"]'));
    // GSAP ignores CSS transform-origin on SVG; set it here so blinks close on the eye's centre.
    gsap.set(eyes, { transformOrigin: '50% 50%' });
    root.querySelectorAll('[data-rig="char"]').forEach((c, i) => {
      gsap.set(c, { transformOrigin: '50% 100%' });
      gsap.to(c, { scaleY: 1.02, scaleX: 0.994, duration: 2.6, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: i * 0.3 });
    });
    root.querySelectorAll('[data-rig="scarf-tail"]').forEach((s) => {
      gsap.set(s, { transformOrigin: '50% 0%' });
      gsap.fromTo(s, { rotation: -5 }, { rotation: 5, duration: 2, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    });

    // Blink: lids drop fast, open a touch slower; now and then a double blink.
    const blink = () => {
      const tl = gsap.timeline();
      tl.to(eyes, { scaleY: 0.1, duration: 0.075, ease: 'power2.in' }).to(eyes, { scaleY: 1, duration: 0.16, ease: 'power2.out' });
      if (Math.random() < 0.2) tl.to(eyes, { scaleY: 0.1, duration: 0.07, ease: 'power2.in' }, '+=0.09').to(eyes, { scaleY: 1, duration: 0.15, ease: 'power2.out' });
      later(blink, nextBlinkDelay(Math.random) * 1000);
    };
    later(blink, nextBlinkDelay(Math.random) * 1000);

    // Where the eyes look: the pointer when it moves (desktop), otherwise idle glances.
    const mx = eyes.map((e) => gsap.quickTo(e, 'x', { duration: 0.55, ease: 'power3.out' }));
    const my = eyes.map((e) => gsap.quickTo(e, 'y', { duration: 0.55, ease: 'power3.out' }));
    const look = (x: number, y: number) => { mx.forEach((f) => f(x)); my.forEach((f) => f(y)); };
    let lastPointer = 0;
    const glance = () => {
      if (performance.now() - lastPointer > 2500) {
        const away = Math.random() < 0.65;
        look(away ? gsap.utils.random(-3, 3) : 0, away ? gsap.utils.random(-1.5, 1.5) : 0);
      }
      later(glance, gsap.utils.random(1800, 4200));
    };
    later(glance, gsap.utils.random(800, 2500));
    if (opts.track && matchMedia('(pointer: fine)').matches) {
      onMove = (e) => {
        lastPointer = performance.now();
        const r = root.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height * 0.4);
        const d = Math.max(1, Math.hypot(dx, dy)), k = Math.min(1, d / 400);
        look((dx / d) * 3 * k, (dy / d) * 2 * k);
      };
      addEventListener('pointermove', onMove);
    }
  });
  return () => {
    timers.forEach(clearTimeout);
    if (onMove) removeEventListener('pointermove', onMove);
    ctx.revert();
  };
}
