import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * A small "i" that explains a rule. Hover or focus shows it on desktop; a tap toggles it on
 * touch. Escape or a tap elsewhere closes it. The bubble is placed on the page itself (fixed, next
 * to the button), so cards with hidden overflow can't cut it off.
 */
export function InfoTip({ label, children, align = 'start' }: { label: string; children: ReactNode; align?: 'start' | 'end' }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const shown = open || hover;
  const bubble = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  // Below the button, kept inside the screen on both sides (phones).
  useLayoutEffect(() => {
    if (!shown || !bubble.current || !ref.current) { setPos(null); return; }
    const b = ref.current.getBoundingClientRect(), w = bubble.current.offsetWidth;
    const pad = 12, vw = document.documentElement.clientWidth;
    const want = align === 'end' ? b.right + 8 - w : b.left - 8;
    setPos({ top: b.bottom + 6, left: Math.max(pad, Math.min(want, vw - pad - w)) });
  }, [shown, align]);
  // It sits on the page, not in the card: close it when the page scrolls away.
  useEffect(() => {
    if (!shown) return;
    const close = () => { setOpen(false); setHover(false); };
    window.addEventListener('scroll', close, { passive: true, capture: true });
    return () => window.removeEventListener('scroll', close, { capture: true });
  }, [shown]);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { const t = e.target as Node; if (!ref.current?.contains(t) && !bubble.current?.contains(t)) setOpen(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);
  return (
    <span ref={ref} className={`info-tip is-${align}`} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button type="button" className="info-tip-btn" aria-label={label} aria-expanded={shown}
        aria-describedby={shown ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        onFocus={() => setHover(true)} onBlur={() => setHover(false)}
        onKeyDown={(e) => { if (e.key === 'Escape') { setOpen(false); setHover(false); } }}>
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
          <circle cx="10" cy="10" r="8.5" fill="#fff" stroke="currentColor" strokeWidth="2" />
          <circle cx="10" cy="6.2" r="1.3" fill="currentColor" />
          <path d="M10 9v5.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </button>
      {shown && createPortal(
        <span ref={bubble} role="tooltip" id={id} className="info-tip-bubble" style={pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden', top: 0, left: 0 }}>{children}</span>,
        document.body,
      )}
    </span>
  );
}
