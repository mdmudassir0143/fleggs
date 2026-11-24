import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MOTION, motionContext, gsap } from '../motion/gsap';
import { Icon } from './Icon';
import { focusables, nextFocus } from './helpers';

/**
 * Modal sheet: slides up from the bottom on phones, in from the right on desktop.
 * `variant="dialog"` is a centred popup instead (confirmations).
 * Traps focus, closes on Escape or backdrop, and gives focus back to whatever opened it.
 */
export function Sheet({ open, onClose, title, children, enter = 'slide', variant = 'sheet' }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; enter?: 'slide' | 'none'; variant?: 'sheet' | 'dialog';
}) {
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  // Parents often pass a fresh onClose every render (e.g. a ticking timer); keep the latest
  // without re-running the open effect, which would replay the entrance and steal focus.
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!open || !panel.current) return;
    opener.current = document.activeElement;
    const root = panel.current;
    focusables(root)[0]?.focus();
    const ctx = motionContext(root, (reduce) => {
      if (reduce || enter === 'none') return;
      if (variant === 'dialog') gsap.from(root, { scale: 0.9, y: 16, autoAlpha: 0, ...MOTION.enter });
      else {
        const fromRight = matchMedia('(min-width: 1024px)').matches;
        gsap.from(root, { [fromRight ? 'xPercent' : 'yPercent']: 100, ...MOTION.enter });
      }
      gsap.from(root.previousElementSibling, { opacity: 0, ...MOTION.ui });
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current();
      if (e.key === 'Tab') {
        const to = nextFocus(root, document.activeElement!, e.shiftKey);
        if (to) { e.preventDefault(); to.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      ctx.revert();
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [open, enter, variant]);

  if (!open) return null;
  // Portal to <body> so no screen's stacking context (e.g. view-transition-name) can bury the sheet.
  return createPortal(
    <div className={`sheet-layer ${variant === 'dialog' ? 'is-dialog' : ''}`}>
      <div className="sheet-backdrop" onClick={() => close.current()} />
      <div ref={panel} className={`sheet ${variant === 'dialog' ? 'is-dialog' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" aria-label="Close" onClick={onClose}><Icon name="close" /></button>
        </header>
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
