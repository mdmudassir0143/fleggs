import { registerGsap, settle } from '../motion/gsap';

export const STORY_COPY = [
  'Long ago, a yeti froze in time.',
  'The Sui legends woke him up.',
  'He found a nest of frozen eggs.',
  'One of them is yours.',
];

/** Where each chapter starts on the 0–4 scroll timeline (5 full-height sections = 4 screens of scroll). */
const CHAPTER_START = { ch1: 0, ch2: 0.4, ch3: 1.4, ch4: 2.4, ch5: 3.4 } as const;
/** Each chapter's action fills the 0.6 screen of scroll while its text card slides up into view. */
const CHAPTER_SPAN = 0.6;

/**
 * The whole story as one timeline, 4 units long (one per screen of scroll), with a label per
 * chapter. Each chapter is built as its own sub-timeline and fitted into the scroll window where
 * its text card arrives, so what you read and what you see happen together. Story.tsx scrubs it
 * with ScrollTrigger; with reduced motion it is settled on the final frame instead.
 */
export function buildStoryTimeline(root: Element, reduce: boolean) {
  const gsap = registerGsap();
  const q = (sel: string) => root.querySelector(sel);
  const qa = (sel: string) => Array.from(root.querySelectorAll(sel));
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
  const chapter = (label: keyof typeof CHAPTER_START, build: (c: gsap.core.Timeline) => void, span = CHAPTER_SPAN) => {
    const c = gsap.timeline({ defaults: { ease: 'none' } });
    build(c);
    tl.addLabel(label, CHAPTER_START[label]).add(c.duration(span), label);
  };

  // A slow camera push-in across the first three chapters (title drifts up with it).
  tl.fromTo(q('.story-title'), { yPercent: 0 }, { yPercent: -12, duration: 1.4 }, 0)
    .fromTo(q('.scene-front svg'), { scale: 1 }, { scale: 1.06, transformOrigin: '50% 72%', duration: 2.4, ease: 'sine.inOut' }, 0)
    .fromTo(q('.scene-back svg'), { scale: 1 }, { scale: 1.025, transformOrigin: '50% 72%', duration: 2.4, ease: 'sine.inOut' }, 0);

  // 01 — frozen in time: the ice catches the moonlight.
  chapter('ch1', (c) => {
    c.fromTo(q('#ice-shine'), { opacity: 0.5 }, { opacity: 1, duration: 1 });
  }, 0.4);

  // 02 — the Sui legends wake him: aurora, cracks, the ice shakes and bursts, Lofi opens his eyes.
  chapter('ch2', (c) => {
    c.to([q('#aurora'), q('.story-aurora')].filter(Boolean), { opacity: 1, duration: 0.5 }, 0)
      .fromTo(qa('#cracks path'), { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.5, stagger: 0.08 }, 0.15)
      .to(q('#iceblock'), { x: 6, duration: 0.04, repeat: 7, yoyo: true }, 0.75)
      .to(q('#shards'), { opacity: 1, duration: 0.02 }, 1.05)
      .fromTo(q('#burst'), { opacity: 0, scale: 0.4, transformOrigin: '50% 50%' }, { opacity: 0.95, scale: 1.1, duration: 0.12, ease: 'power2.out' }, 1.03)
      .to(q('#burst'), { opacity: 0, scale: 1.4, duration: 0.35, ease: 'power2.in' }, 1.15)
      .to(qa('#shards path'), {
        x: (_i: number, el: Element) => Number(el.getAttribute('data-dx')) * 220,
        y: (_i: number, el: Element) => Number(el.getAttribute('data-dy')) * 200,
        rotation: (i: number) => (i % 2 ? 90 : -120), opacity: 0, duration: 0.5, ease: 'power2.out',
      }, 1.05)
      .to(q('#iceblock'), { opacity: 0, duration: 0.2 }, 1.05)
      // squash as the ice bursts, then spring up awake
      .to(q('#lofi'), { scaleX: 1.1, scaleY: 0.86, transformOrigin: '50% 100%', duration: 0.12, ease: 'power2.in' }, 1.05)
      .to(q('#lofi'), { scaleX: 1, scaleY: 1, duration: 0.45, ease: 'elastic.out(1.1, 0.35)' }, 1.17)
      .to(q('#lofi-sleep'), { opacity: 0, duration: 0.15 }, 1.2)
      .to(q('#lofi-awake'), { opacity: 1, duration: 0.15 }, 1.2);
  });

  // 03 — a nest of frozen eggs glows into view.
  chapter('ch3', (c) => {
    c.fromTo(q('#nest'), { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, 0)
      .fromTo(q('#nest-glow'), { opacity: 0.15 }, { opacity: 0.55, duration: 0.3, yoyo: true, repeat: 1 }, 0.3);
  });

  // 04 — one egg rolls to you, squashes as it lands and wobbles to rest.
  chapter('ch4', (c) => {
    c.to(q('#egg-hero'), { opacity: 1, duration: 0.05 }, 0)
      .to(q('#egg-hero'), {
        // Browsers roll the egg along the curve; environments without SVG geometry (tests) slide it.
        ...(typeof (q('#egg-path') as SVGGraphicsElement | null)?.getCTM === 'function'
          ? { motionPath: { path: q('#egg-path') as SVGPathElement, align: q('#egg-path') as SVGPathElement, alignOrigin: [0.5, 0.5] } }
          : { x: 180, y: 100 }),
        rotation: 360, duration: 0.8, ease: 'power1.inOut',
      }, 0)
      .to(q('#egg-hero'), { scaleX: 1.14, scaleY: 0.84, transformOrigin: '50% 100%', duration: 0.08 }, 0.8)
      .to(q('#egg-hero'), { scaleX: 1, scaleY: 1, duration: 0.35, ease: 'elastic.out(1.2, 0.4)' }, 0.88);
  });

  // 05 — dawn in brand colours: the sky lifts to ice blue, the aurora fades, Lofi raises his arm and waves.
  chapter('ch5', (c) => {
    c.to(q('#sky-stop-top'), { attr: { 'stop-color': '#5E8FD3' }, duration: 1 }, 0)
      .to(q('#sky-stop-bottom'), { attr: { 'stop-color': '#D6E8F8' }, duration: 1 }, 0)
      .to([q('#aurora'), q('.story-aurora')].filter(Boolean), { opacity: 0, duration: 0.6 }, 0)
      .to(q('#stars'), { opacity: 0, duration: 0.7 }, 0)
      .to(q('#moon'), { opacity: 0.35, y: 60, duration: 1 }, 0)
      .to(q('#rays'), { opacity: 1, rotation: 8, duration: 1, ease: 'sine.out' }, 0.1)
      .to(q('#dawn-glow'), { opacity: 1, duration: 1, ease: 'sine.out' }, 0.1)
      .to(q('#landscape-dawn'), { opacity: 1, duration: 1, ease: 'sine.inOut' }, 0)
      // The waving pose is the awake pose with its right arm on a shoulder pivot: swap instantly
      // (they look identical with the arm down), then swing the arm up from his side.
      .set(q('#lofi-awake'), { opacity: 0 }, 0.45)
      .set(q('#lofi-wave'), { opacity: 1 }, 0.45)
      .fromTo(q('#lofi-wave [data-rig="wave-arm"]'), { rotation: 150, svgOrigin: '300 262' }, { rotation: 0, svgOrigin: '300 262', duration: 0.4, ease: 'back.out(1.6)' }, 0.45)
      .fromTo(q('#lofi-wave [data-rig="wave-lines"]'), { opacity: 0 }, { opacity: 1, duration: 0.15 }, 0.8)
      .to(q('#egg-hero'), { scale: 1.45, transformOrigin: '50% 50%', filter: 'drop-shadow(0 0 18px rgba(255,190,120,.95))', duration: 0.6, ease: 'back.out(2)' }, 0.3);
  });

  tl.to({}, { duration: 4 - tl.duration() > 0 ? 4 - tl.duration() : 0.001 });
  return reduce ? settle(tl) : tl;
}

/** Once Lofi's arm is up he keeps waving on his own (inner hand group, so it never fights the scroll). */
export function createWaveLoop(root: Element) {
  const gsap = registerGsap();
  const hand = root.querySelector('#lofi-wave [data-rig="wave-hand"]');
  if (!hand) return null;
  return gsap.fromTo(hand, { rotation: 0 }, { rotation: -14, svgOrigin: '300 262', duration: 0.42, ease: 'sine.inOut', yoyo: true, repeat: -1, paused: true });
}
