import { useEffect } from 'react';
import { gsap, motionContext } from './gsap';

export const MAX_SHIFT = 24;

/** Layer offsets for a pointer at (px, py) in −1..1. Layers move opposite the pointer, more when nearer. */
export function parallaxOffsets(px: number, py: number, depths: number[]): { x: number; y: number }[] {
  const cx = Math.max(-1, Math.min(1, px)), cy = Math.max(-1, Math.min(1, py));
  return depths.map((d) => ({ x: -cx * MAX_SHIFT * d + 0, y: -cy * MAX_SHIFT * d * 0.6 + 0 }));
}

/**
 * Moves layers with the pointer (desktop) or device tilt (where the browser allows it without
 * a permission prompt). Off with reduced motion.
 */
export function useParallax(root: React.RefObject<Element>, layers: { selector: string; depth: number }[]) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let off = () => {};
    const ctx = motionContext(el, (reduce) => {
      if (reduce) return;
      const targets = layers.map((l) => el.querySelector(l.selector)).filter(Boolean) as Element[];
      const movers = targets.map((t) => ({ x: gsap.quickTo(t, 'x', { duration: 0.9, ease: 'power3.out' }), y: gsap.quickTo(t, 'y', { duration: 0.9, ease: 'power3.out' }) }));
      const apply = (px: number, py: number) => parallaxOffsets(px, py, layers.map((l) => l.depth)).forEach((o, i) => { movers[i]?.x(o.x); movers[i]?.y(o.y); });
      const onMove = (e: PointerEvent) => apply((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
      const onTilt = (e: DeviceOrientationEvent) => apply((e.gamma ?? 0) / 30, ((e.beta ?? 45) - 45) / 30);
      const tiltNeedsPrompt = typeof (DeviceOrientationEvent as unknown as { requestPermission?: unknown })?.requestPermission === 'function';
      addEventListener('pointermove', onMove);
      if (!tiltNeedsPrompt) addEventListener('deviceorientation', onTilt);
      off = () => { removeEventListener('pointermove', onMove); removeEventListener('deviceorientation', onTilt); };
    });
    return () => { off(); ctx.revert(); };
  }, [root, layers]);
}
