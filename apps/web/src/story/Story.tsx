import { Footer } from '../components/Footer';
import { useEffect, useMemo, useRef } from 'react';
import { storySceneBack, storySceneFront } from '@flurry/art';
import { motionContext, ScrollTrigger, SplitText, gsap } from '../motion/gsap';
import { SignIn } from '../screens/Start';
import { EggArt } from '../components/EggArt';
import { STORY_COPY, buildStoryTimeline, createWaveLoop } from './story.timeline';
import { startSnow } from './snow';
import { MusicToggle } from '../ui/MusicToggle';
import { bringToLife } from '../motion/life';
import { useParallax } from '../motion/parallax';
import { startSmoothScroll } from '../motion/smooth';
import { canUseWebGL } from '../gl/support';
import { startAurora } from '../gl/aurora';

const DEPTH = [
  { selector: '.scene-back', depth: 0.15 },
  { selector: '.story-title', depth: 0.35 },
  { selector: '.scene-front', depth: 0.7 },
];

/**
 * The landing: a pinned two-layer scene (title between the layers) scrubbed by scroll through
 * five chapters. "Skip story" and the CTA are always reachable; reduced motion shows the final frame.
 */
export default function Story() {
  const root = useRef<HTMLElement>(null);
  const snow = useRef<HTMLCanvasElement>(null);
  const aurora = useRef<HTMLCanvasElement>(null);
  const back = useMemo(() => ({ __html: storySceneBack() }), []);
  const front = useMemo(() => ({ __html: storySceneFront() }), []);
  useParallax(root, DEPTH);

  useEffect(() => {
    const el = root.current!;
    let stopSnow = () => {};
    let stopAurora = () => {};
    // Shader aurora where the device can afford it; otherwise the SVG ribbons stay.
    if (aurora.current && canUseWebGL()) { el.classList.add('has-gl'); stopAurora = startAurora(aurora.current); }
    const stopLife = bringToLife(el.querySelector('.story-scene')!, { track: true });
    const ctx = motionContext(el, (reduce) => {
      const tl = buildStoryTimeline(el, reduce);
      if (reduce) return;
      const wave = createWaveLoop(el);
      ScrollTrigger.create({
        trigger: el, start: 'top top', end: 'bottom bottom', scrub: 0.8, animation: tl,
        // Wave while the finale is on screen; settle the hand back when scrolling up.
        onUpdate: (st) => { if (!wave) return; if (st.progress > 0.97) { if (wave.paused()) wave.play(); } else if (!wave.paused()) { wave.pause(); wave.progress(0); } },
      });
      el.querySelectorAll<HTMLElement>('.ch-line').forEach((line) => {
        const split = SplitText.create(line, { type: 'words', mask: 'words', aria: 'none' });
        gsap.from(split.words, { yPercent: 110, stagger: 0.05, duration: 0.6, ease: 'power3.out', scrollTrigger: { trigger: line.closest('.chapter'), start: 'top 70%' } });
      });
      if (snow.current) stopSnow = startSnow(snow.current);
    });
    const stopSmooth = startSmoothScroll();
    return () => { stopSnow(); stopAurora(); stopLife(); stopSmooth?.(); el.classList.remove('has-gl'); ctx.revert(); };
  }, []);

  return (
    <section ref={root} className="story" aria-label="The story of Flurry Eggs">
      <header className="story-top">
        <span className="wordmark">Flurry Eggs</span>
        <span className="story-top-actions"><MusicToggle /><a className="skip-story" href="#start">Skip story</a></span>
      </header>
      <div className="story-scene" aria-hidden="true">
        <div className="scene-layer scene-back" dangerouslySetInnerHTML={back} />
        <canvas ref={aurora} className="story-aurora" />
        <div className="story-title"><span>FLURRY</span></div>
        <div className="scene-layer scene-front" dangerouslySetInnerHTML={front} />
        <canvas ref={snow} className="story-snow" />
      </div>
      <div className="story-chapters">
        {STORY_COPY.map((line, i) => (
          <article key={line} className="chapter">
            <div className="chapter-card">
              <span className="ch-num">0{i + 1}</span>
              <p className="ch-line">{line}</p>
            </div>
          </article>
        ))}
        <article id="start" className="chapter chapter-cta" tabIndex={-1}>
          <div className="chapter-card">
            <span className="ch-num">05</span>
            <div className="egg-ticket">
              <span className="egg-ticket-egg" aria-hidden="true"><EggArt stage={0} /></span>
              <div>
                <h1 className="cta-title">Your egg is waiting</h1>
                <p className="cta-line">Keep it warm and meet your Yeti.</p>
              </div>
            </div>
            <SignIn />
          </div>
        </article>
      </div>
      <Footer className="story-footer" />
    </section>
  );
}
