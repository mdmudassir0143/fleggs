import { useEffect, useRef, useState } from 'react';
import { gsap, motionContext } from '../motion/gsap';
import { rating } from '../lib/rating';
import { sound } from '../lib/sound';
import { Icon } from '../ui/Icon';
import { icon } from '@flurry/art';
import { SnowLoader } from '../ui/SnowLoader';

const LINE: Record<ReturnType<typeof rating>, string> = {
  Chilly: 'A little chilly. Your egg still felt it.',
  Toasty: 'Toasty! Your egg is snug.',
  Perfect: 'Perfectly warm. Your egg is glowing.',
};

/**
 * The moment after a run: the score counts up, a rating stamp lands, and any Snowflakes
 * earned fly up to the top-bar counter. The final result is announced once for screen readers.
 */
export function GameFinish({ score, snowflakes, saving, error, onRetry, onContinue, continueLabel = 'Back to my egg', onTrain }: {
  score: number; snowflakes: number; saving: boolean; error: string | null; onRetry: () => void; onContinue?: () => void;
  continueLabel?: string; onTrain?: () => void;
}) {
  const r = rating(score);
  const root = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(0);

  const flown = useRef(false);
  const counted = useRef(0);
  const latest = useRef(score);
  latest.current = score;

  // Entrance: once, on mount. Later prop changes (the server's Snowflakes, the save finishing)
  // must not replay it — that made the scoreboard appear twice.
  useEffect(() => {
    const el = root.current!;
    const ctx = motionContext(el, (reduce) => {
      if (reduce) { setShown(latest.current); counted.current = latest.current; return; }
      const o = { v: 0 };
      const tl = gsap.timeline();
      tl.from(el.querySelector('.finish-card'), { y: 40, scale: 0.92, autoAlpha: 0, duration: 0.45, ease: 'back.out(1.6)' })
        .to(o, { v: latest.current, duration: 1.1, ease: 'power2.out', onUpdate: () => setShown(Math.round(o.v)), onComplete: () => { counted.current = latest.current; } }, '-=0.1')
        .fromTo(el.querySelector('.stamp'), { scale: 2.6, rotation: -24, autoAlpha: 0 }, { scale: 1, rotation: -8, autoAlpha: 1, duration: 0.35, ease: 'power4.in' })
        .to(el.querySelector('.finish-card'), { x: 4, duration: 0.05, repeat: 3, yoyo: true }, '<0.33')
        .call(() => sound.play(r === 'Perfect' ? 'chime' : 'ding'), [], '<');
    });
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If the referee's score differs from the local one, just glide the number — no re-entrance.
  useEffect(() => {
    if (counted.current === 0 || counted.current === score) return;
    const o = { v: counted.current };
    const t = gsap.to(o, { v: score, duration: 0.5, onUpdate: () => setShown(Math.round(o.v)), onComplete: () => { counted.current = score; } });
    return () => { t.kill(); };
  }, [score]);

  // Snowflakes fly to the counter once the run is saved (so the counter really goes up as they land).
  useEffect(() => {
    if (flown.current || saving || snowflakes <= 0 || !root.current) return;
    flown.current = true;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduce) { const el = root.current; const id = setTimeout(() => flySnowflakes(el, snowflakes), 900); return () => clearTimeout(id); }
  }, [saving, snowflakes]);

  return (
    <div ref={root} className={`finish finish-${r.toLowerCase()}`}>
      <div className="finish-card">
        <p className="finish-label">Warmth score</p>
        <p className="finish-score" aria-hidden="true">{shown}</p>
        <span className="stamp" aria-hidden="true">{r}</span>
        <p className="finish-line">{LINE[r]}</p>
        <p className="sr-only" aria-live="polite">Warmth score {score}. {r}. {saving ? 'Saving it to your egg.' : ''}</p>
        {saving && <SnowLoader size="sm" label="Saving…" className="finish-saving" />}
        {error && <><p className="error" role="alert">{error}</p><button className="btn warm" onClick={onRetry}>Play again</button></>}
        {!saving && !error && onContinue && <button className="btn warm big" onClick={onContinue}>{continueLabel}</button>}
        {!saving && !error && onTrain && snowflakes > 0 && <button className="btn finish-train" onClick={onTrain}>Spend them: train a trait</button>}
      </div>
      {snowflakes > 0 && <p className="finish-flakes"><Icon name="snowflake" /> +{snowflakes} Snowflakes</p>}
    </div>
  );
}

/** Little snowflakes arc from the card to the top-bar counter, which pops as each lands. */
export function snowflakeTarget(): Element | null {
  const all = Array.from(document.querySelectorAll('[data-counter^="snowflakes"]'));
  return all.find((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }) ?? null;
}

function flySnowflakes(from: Element, n: number) {
  const target = snowflakeTarget();
  if (!target) return;
  const pop = target.closest('.snow-chip, .side-stats > div') ?? target;
  const a = (from.querySelector('.finish-flakes') ?? from.querySelector('.finish-card'))!.getBoundingClientRect(), b = target.getBoundingClientRect();
  for (let i = 0; i < Math.min(8, n); i++) {
    const f = document.createElement('span');
    f.className = 'flying-flake';
    f.innerHTML = icon('snowflake', 22);
    document.body.appendChild(f);
    gsap.set(f, { x: a.left + a.width / 2, y: a.top + a.height / 2 });
    gsap.to(f, {
      motionPath: { path: [{ x: a.left + a.width / 2 + (i - 4) * 30, y: a.top - 60 }, { x: b.left + b.width / 2, y: b.top + b.height / 2 }], curviness: 1.4 },
      scale: 0.6, duration: 0.9, delay: i * 0.08, ease: 'power2.in',
      onComplete: () => { f.remove(); sound.play('ding'); gsap.fromTo(pop, { scale: 1.18 }, { scale: 1, duration: 0.3, ease: 'back.out(3)' }); },
    });
  }
}
