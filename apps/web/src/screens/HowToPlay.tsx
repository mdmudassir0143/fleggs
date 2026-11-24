import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { ELEMENT_COLORS } from '@flurry/art';
import { EggArt } from '../components/EggArt';
import { YetiArt } from '../components/YetiArt';
import { StepIcon } from './Daily';
import { GameDiagram } from '../components/GameDiagram';
import { GAME_INFO } from '../lib/train';
import { gsap, motionContext } from '../motion/gsap';

const KEY = 'flurry:how-seen';
/** True once the player has seen the guide (or storage is blocked — never nag on every visit). */
export function howSeen(): boolean {
  try { return localStorage.getItem(KEY) === '1'; } catch { return true; }
}
/** True the first time only: the guide opens by itself once, then is remembered as seen. */
export function takeAutoHow(): boolean {
  if (howSeen()) return false;
  markHowSeen();
  return true;
}

export function markHowSeen() {
  try { localStorage.setItem(KEY, '1'); } catch { /* fine */ }
}

const sample = (level: number, el: number, v: number[]) => ({ id: `s${level}${el}`, level, elements: [el], variants: v, name: 'Yeti', cardUrl: '', named: true });

export const HOW_STEPS: { title: string; body: string; art: () => ReactNode }[] = [
  {
    title: 'Warm your egg',
    body: 'Three 30-second stages: calm, wind, blizzard. Hold to warm, let go to cool. 700+ makes a trait Rare.',
    art: () => <div className="how-art-egg"><EggArt stage={2} /><span className="how-temp">−10°C</span></div>,
  },
  {
    title: 'Hatch your yeti',
    body: 'Your egg hatches into a Level 1 yeti on Sui, with its own name and story.',
    art: () => <div className="how-art-yeti"><YetiArt yeti={sample(1, 2, [9, 6, 3])} /></div>,
  },
  {
    title: 'Play and train',
    body: 'Four mini-games earn Snowflakes (2 free plays each a day). Spend them in Yetis to train traits.',
    art: () => (
      <div className="how-art-games">
        {[0, 1, 2, 3].map((g) => <span key={g} style={{ ['--el' as string]: ELEMENT_COLORS[GAME_INFO[g].element] }}><GameDiagram game={g} />{GAME_INFO[g].name}</span>)}
      </div>
    ),
  },
  {
    title: 'Daily streak',
    body: "Play today's run once a day. Seven days in a row earns a free egg.",
    art: () => <ol className="how-art-streak">{[0, 1, 2, 3, 4, 5, 6].map((i) => <li key={i}><StepIcon s={i < 4 ? 'done' : i === 6 ? 'egg' : 'todo'} i={i} /></li>)}</ol>,
  },
  {
    title: 'Ways to get eggs',
    body: 'First egg is free. Then: a 7-day streak, 400 Snowflakes, or the Shop.',
    art: () => <div className="how-art-eggs">{[0, 1, 2, 3].map((i) => <span key={i} style={{ ['--el' as string]: ELEMENT_COLORS[i] }}><EggArt stage={0} element={i} /></span>)}</div>,
  },
  {
    title: 'Merge and level up',
    body: 'Max two yetis of the same level, then merge them into one of the next level, up to Level 5.',
    art: () => (
      <div className="how-art-merge">
        <YetiArt yeti={sample(1, 0, [1, 2, 3])} /><span className="how-plus">+</span><YetiArt yeti={sample(1, 1, [5, 6, 2])} /><span className="how-plus">→</span><YetiArt yeti={sample(2, 1, [9, 10, 6])} />
      </div>
    ),
  },
  {
    title: 'Earn real SUI',
    body: 'In Earn, sell a yeti to the treasury, list it on the market, or stake it for a share of shop sales.',
    art: () => (
      <div className="how-art-earn">
        {['Sell now', 'List', 'Stake'].map((t) => <span key={t}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 6c2.6 3.2 4 5.2 4 7a4 4 0 0 1-8 0c0-1.8 1.4-3.8 4-7z" /></svg>{t}</span>)}
      </div>
    ),
  },
];

/** A link to the guide (profile sheet, desktop rail). */
export function HowLink({ className = '' }: { className?: string }) {
  return <a className={`how-link ${className}`} href="#how">How to play</a>;
}

/**
 * The guide: swipe through the steps on phones; a numbered trail on desktop. Arrow keys move
 * between steps; "Let's play" returns to base camp.
 */
export function HowToPlay({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const root = useRef<HTMLElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  // A touch in progress: where it started, and whether it became a horizontal drag (vs. a scroll).
  const drag = useRef<{ x: number; y: number; t: number; id: number; on: boolean } | null>(null);
  const [dx, setDx] = useState(0);
  const last = HOW_STEPS.length - 1;
  const go = (n: number) => setI(Math.max(0, Math.min(last, n)));

  const onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId, on: false };
  };
  const onMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const mx = e.clientX - d.x, my = e.clientY - d.y;
    if (!d.on) {
      if (Math.abs(mx) < 8 || Math.abs(mx) < Math.abs(my)) return;
      d.on = true;
      viewport.current?.setPointerCapture?.(e.pointerId);
    }
    // Rubber-band past the first and last card.
    const edge = (i === 0 && mx > 0) || (i === last && mx < 0);
    setDx(edge ? mx / 3 : mx);
  };
  const onUp = (e: PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || !d.on) return;
    const mx = e.clientX - d.x;
    const w = viewport.current?.clientWidth || 320;
    const fast = Math.abs(mx) / Math.max(1, e.timeStamp - d.t) > 0.4; // a quick flick counts too
    if (Math.abs(mx) > w * 0.2 || (fast && Math.abs(mx) > 24)) go(i + (mx < 0 ? 1 : -1));
    setDx(0);
  };
  const onCancel = () => { drag.current = null; setDx(0); };

  useEffect(() => {
    const el = root.current!;
    const ctx = motionContext(el, (reduce) => {
      if (reduce) return;
      gsap.from(el.querySelectorAll('.how-step'), { y: 24, autoAlpha: 0, stagger: 0.07, duration: 0.5, ease: 'power3.out' });
    });
    return () => ctx.revert();
  }, []);

  return (
    <section ref={root} className="how" aria-label="How to play" tabIndex={-1}
      onKeyDown={(e) => { if (e.key === 'ArrowRight') go(i + 1); if (e.key === 'ArrowLeft') go(i - 1); }}>
      <header className="how-head">
        <h2>How to play</h2>
        <p className="hint">Six things to know before you warm your first egg.</p>
      </header>
      <div ref={viewport} className="how-viewport" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onCancel}>
        <ol className={`how-track ${dx ? 'is-dragging' : ''}`} style={{ ['--i' as string]: i, ['--dx' as string]: `${dx}px` }}>
          {HOW_STEPS.map((s, n) => (
            <li key={s.title} className={`how-step ${n === i ? 'is-on' : ''}`} aria-hidden={undefined}>
              <span className="how-num">{n + 1}</span>
              <div className="how-art">{s.art()}</div>
              <div className="how-text"><h3>{s.title}</h3><p>{s.body}</p></div>
            </li>
          ))}
        </ol>
      </div>
      <div className="how-dots" role="group" aria-label="Steps">
        {HOW_STEPS.map((s, n) => <button key={s.title} data-i={n} aria-current={n === i ? 'step' : undefined} aria-label={`Step ${n + 1}: ${s.title}`} onClick={() => go(n)} />)}
      </div>
      <div className="how-actions">
        {i > 0 && <button className="btn ghost how-back" onClick={() => go(i - 1)}>Back</button>}
        {i < last ? <button className="btn how-next" onClick={() => go(i + 1)}>Next</button> : null}
        <button className={`btn warm how-done ${i < last ? 'is-secondary' : ''}`} onClick={() => { markHowSeen(); onDone(); }}>Let's play</button>
      </div>
    </section>
  );
}
