import { useEffect, useRef, type ReactNode } from 'react';
import { gsap, motionContext } from '../motion/gsap';
import { tiltFromPointer, type Foil } from '../lib/den';

/**
 * A collectible card that tilts toward the pointer (±12°) with a foil layer by rarity and a glare
 * that follows the pointer via --px/--py. Settles back when the pointer leaves. Still under reduced motion.
 */
export function HoloCard({ foil, children, className = '' }: { foil: Foil; children: ReactNode; className?: string }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const card = el.current!;
    let off = () => {};
    const ctx = motionContext(card, (reduce) => {
      if (reduce) return;
      const rx = gsap.quickTo(card, 'rotationX', { duration: 0.5, ease: 'power3.out' });
      const ry = gsap.quickTo(card, 'rotationY', { duration: 0.5, ease: 'power3.out' });
      const move = (e: PointerEvent) => {
        const t = tiltFromPointer(e.clientX, e.clientY, card.getBoundingClientRect());
        rx(t.rx); ry(t.ry);
        card.style.setProperty('--px', `${t.px}%`); card.style.setProperty('--py', `${t.py}%`);
        card.classList.add('is-lit');
      };
      const leave = () => { rx(0); ry(0); card.classList.remove('is-lit'); };
      card.addEventListener('pointermove', move);
      card.addEventListener('pointerleave', leave);
      off = () => { card.removeEventListener('pointermove', move); card.removeEventListener('pointerleave', leave); };
    });
    return () => { off(); ctx.revert(); };
  }, []);
  return (
    <div ref={el} className={`holo holo-${foil} ${className}`}>
      {children}
      <span className="holo-foil" aria-hidden="true" />
      <span className="holo-glare" aria-hidden="true" />
    </div>
  );
}
