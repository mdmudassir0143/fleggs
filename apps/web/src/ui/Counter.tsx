import { useEffect, useRef, useState } from 'react';
import { motionContext, gsap } from '../motion/gsap';

/** A number that counts to its new value (600 ms) and announces only the final value. */
export function Counter({ value, label, id }: { value: number; label: string; id?: string }) {
  const [shown, setShown] = useState(value);
  const prev = useRef(value);
  const el = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    if (from === value) return;
    const ctx = motionContext(el.current, (reduce) => {
      if (reduce) return setShown(value);
      const o = { v: from };
      gsap.to(o, { v: value, duration: 0.6, ease: 'power2.out', onUpdate: () => setShown(Math.round(o.v)), onComplete: () => setShown(value) });
      gsap.fromTo(el.current, { scale: 1.25 }, { scale: 1, duration: 0.45, ease: 'back.out(2)' });
    });
    return () => ctx.revert();
  }, [value]);

  return (
    <span className="counter" data-counter={id}>
      <span ref={el} className="counter-value" aria-hidden="true">{shown}</span>
      <span className="sr-only">{value} {label}</span>
    </span>
  );
}
