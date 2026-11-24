import { useEffect, useRef, useState } from 'react';
import { HOLD_MS } from '../lib/merge';

/** Press and hold (pointer, Space or Enter) for a full second to confirm; letting go early cancels. */
export function HoldButton({ label, onConfirm, disabled }: { label: string; onConfirm(): void; disabled?: boolean }) {
  const [p, setP] = useState(0);
  const start = useRef<number | null>(null);
  const raf = useRef(0);
  const stop = () => { start.current = null; cancelAnimationFrame(raf.current); setP(0); };
  const begin = () => {
    if (disabled || start.current !== null) return;
    start.current = performance.now();
    const tick = (t: number) => {
      if (start.current === null) return;
      const k = Math.min(1, (t - start.current) / HOLD_MS);
      setP(k);
      if (k >= 1) { start.current = null; onConfirm(); return; }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  return (
    <button className="btn warm big hold-btn" disabled={disabled} style={{ ['--p' as string]: p }}
      onPointerDown={begin} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}
      onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); begin(); } }}
      onKeyUp={(e) => { if (e.key === ' ' || e.key === 'Enter') stop(); }}
      aria-label={`${label}. Press and hold for one second.`}>
      <span className="hold-fill" aria-hidden="true" />
      <span className="hold-label">{p > 0 && p < 1 ? 'Keep holding…' : label}</span>
    </button>
  );
}
