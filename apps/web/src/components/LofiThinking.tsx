import { useEffect, useMemo, useState } from 'react';
import { elderLofi } from '@flurry/art';
import { stepAt, THINK_STEPS } from '../lib/thinking';

const reduced = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * While the AI names a yeti: Lofi ponders with a thought bubble of dots (no trial names, so the real
 * name is the reveal), and three steps (name, story, card) light up as the wait goes on.
 */
export function LofiThinking({ compact = false }: { compact?: boolean }) {
  const [ms, setMs] = useState(0);
  const still = useMemo(reduced, []);
  const lofi = useMemo(() => elderLofi({ pose: 'awake' }), []);
  useEffect(() => {
    const t0 = Date.now();
    const id = setInterval(() => setMs(Date.now() - t0), still ? 500 : 50);
    return () => clearInterval(id);
  }, [still]);
  const step = stepAt(ms);
  return (
    <div className={`lofi-thinking ${compact ? 'is-compact' : ''}`} role="status">
      <div className="lt-stage">
        <span className="lt-lofi" aria-hidden="true" dangerouslySetInnerHTML={{ __html: lofi }} />
        <span className="lt-puff lt-puff-1" aria-hidden="true" /><span className="lt-puff lt-puff-2" aria-hidden="true" />
        <span className="lt-bubble" aria-hidden="true">
          <span className={`lt-dots ${still ? 'is-still' : ''}`}><i /><i /><i /></span>
        </span>
      </div>
      <p className="lt-label">Lofi is thinking of a name…</p>
      {!compact && (
        <ol className="lt-steps">
          {THINK_STEPS.map((s, i) => (
            <li key={s} className={`lt-step ${i === step ? 'is-on' : ''} ${i < step ? 'is-done' : ''}`}>
              <span className="lt-step-dot" aria-hidden="true" />{s}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
