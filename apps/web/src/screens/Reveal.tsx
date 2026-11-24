import { LofiThinking } from '../components/LofiThinking';
import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import { gsap, motionContext } from '../motion/gsap';
import { buildRevealTimeline } from './reveal.timeline';
import { ELEMENT_NAMES } from '@flurry/art';
import { EggArt } from '../components/EggArt';
import { MergeOrb } from '../components/MergeOrb';
import { YetiArt } from '../components/YetiArt';
import { post, run } from '../lib/api';
import { buildAttachLore, type Yeti } from '../lib/flurry';
import { initialReveal, revealReducer, type LoreResult } from '../lib/reveal';


type RevealIO = {
  loadLore: (digest: string) => Promise<LoreResult>;
  saveLore: (lore: LoreResult, address: string) => Promise<{ ok: boolean }>;
};
const liveIO: RevealIO = {
  loadLore: async (digest) => (await post('/lore', { digest })) as LoreResult,
  saveLore: (lore, address) => run(buildAttachLore(lore.yetiId, lore), address),
};

export function RevealScreen({ digest, address, yetis, refresh, onDone, io = liveIO, orb }: {
  digest: string; address: string; yetis: Yeti[]; refresh: () => void; onDone: () => void; io?: RevealIO;
  /** A merge: crack open a glowing orb (these elements) instead of an egg. */
  orb?: number[];
}) {
  const [s, dispatch] = useReducer(revealReducer, digest, initialReveal);
  const saving = useRef(false);
  const root = useRef<HTMLElement>(null);
  const tl = useRef<gsap.core.Timeline | null>(null);
  const [flipped, setFlipped] = useState(false);

  // One orchestrated moment; CRACK_DONE fires when the yeti starts to rise.
  useLayoutEffect(() => {
    const ctx = motionContext(root.current, (reduce) => {
      tl.current = buildRevealTimeline(root.current!, reduce, { onRise: () => dispatch({ type: 'CRACK_DONE' }) });
    });
    return () => ctx.revert();
  }, []);

  const fetchLore = useCallback(async () => {
    try {
      dispatch({ type: 'LORE_OK', lore: await io.loadLore(digest) });
    } catch (e) {
      dispatch({ type: 'LORE_FAIL', error: (e as Error).message, retryable: true });
    }
  }, [digest, io]);

  useEffect(() => { fetchLore(); }, [fetchLore]);

  useEffect(() => {
    if (s.step !== 'saving' || !s.lore || saving.current) return;
    saving.current = true;
    io.saveLore(s.lore, address)
      .then((r) => {
        if (r.ok) { dispatch({ type: 'SAVED' }); refresh(); }
        else dispatch({ type: 'SAVE_FAIL', error: 'Your yeti’s name could not be saved. Try again.' });
      })
      .catch((e: Error) => dispatch({ type: 'SAVE_FAIL', error: e.message }))
      .finally(() => { saving.current = false; });
  }, [s.step, s.lore, address, refresh, io]);

  const yeti = yetis.find((y) => y.id === s.lore?.yetiId) ?? yetis.find((y) => !y.named) ?? yetis[0];
  const named = s.lore && (s.step === 'saving' || s.step === 'revealed');
  const cardUrl = s.lore?.cardUrl || yeti?.cardUrl || '';

  // The timeline waits at `name` until there is a name (or an error) to show.
  useEffect(() => {
    if ((named || s.step === 'failed') && tl.current?.paused()) tl.current.play();
  }, [named, s.step]);

  function flip() {
    const next = !flipped;
    setFlipped(next);
    motionContext(root.current, (reduce) => {
      gsap.to(root.current!.querySelector('.reveal-flip'), { rotationY: next ? 180 : 0, duration: reduce ? 0 : 0.8, ease: 'back.inOut(1.4)' });
    });
  }
  const shareText = s.lore ? `I hatched ${s.lore.name}, a ${ELEMENT_NAMES[yeti?.elements[0] ?? 0]} yeti, in Flurry Eggs! ❄️🥚` : '';

  function retry() {
    dispatch({ type: 'RETRY' });
    if (!s.lore) fetchLore();
  }

  return (
    <section ref={root} className={`reveal step-${s.step}${orb ? ' is-merge' : ''}`} aria-live="polite">
      <div className="reveal-stage">
        <div className="reveal-burst" aria-hidden="true" />
        <div className="reveal-egg">
          {orb ? <MergeOrb elements={orb} /> : <EggArt stage={3} />}
          <svg className="reveal-crack-layer" viewBox="0 0 280 290" aria-hidden="true">
            <path className="reveal-crack" d="M56,146 L80,136 L120,158 L160,134 L200,156 L226,142" fill="none" stroke="#14213D" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="reveal-yeti">
          <div className="reveal-flip">
            <div className="flip-face flip-front">{yeti && <YetiArt yeti={yeti} />}</div>
            <div className="flip-face flip-back">{cardUrl && <img src={cardUrl} alt={`${s.lore?.name ?? 'Yeti'} card`} loading="lazy" />}</div>
          </div>
        </div>
        <canvas className="reveal-confetti" aria-hidden="true" />
      </div>

      <div className="reveal-text">
        {!s.crackDone && <p className="reveal-status">Something is moving inside…</p>}
        {s.crackDone && s.step === 'naming' && <LofiThinking />}
        {named && (
          <>
            <h2 className="reveal-name">{s.lore!.name}</h2>
            <p className="reveal-meta">Level {yeti?.level ?? 1} · {ELEMENT_NAMES[yeti?.elements[0] ?? 0]}</p>
            <p className="reveal-story">{s.lore!.story}</p>
          </>
        )}
        {s.step === 'saving' && <p className="hint">Saving the name to your yeti…</p>}
        {s.step === 'failed' && (
          <>
            <h2 className="reveal-name">{s.lore?.name ?? 'Unnamed Yeti'}</h2>
            <p className="error" role="alert">{s.error}</p>
            {s.retryable && <button className="btn warm" onClick={retry}>Save to my yeti</button>}
          </>
        )}
      </div>

      {(s.step === 'revealed' || s.step === 'failed') && (
        <div className="reveal-actions">
          {s.step === 'revealed' && cardUrl && <button className="btn warm" onClick={flip}>{flipped ? 'See my yeti' : 'See card'}</button>}
          {s.step === 'revealed' && s.lore && (
            <a className="btn" target="_blank" rel="noreferrer"
              href={`https://x.com/intent/post?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(s.lore.cardUrl)}`}>
              Share to X
            </a>
          )}
          {yeti && <a className="btn ghost" target="_blank" rel="noreferrer" href={`https://suiscan.xyz/testnet/object/${yeti.id}`}>See it on Sui</a>}
          <button className="btn ghost" onClick={onDone}>Back to my den</button>
        </div>
      )}
    </section>
  );
}
