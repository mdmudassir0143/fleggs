import { CustomWiggle } from 'gsap/CustomWiggle';
import { registerGsap, settle, SplitText } from '../motion/gsap';
import { sound } from '../lib/sound';

export const REVEAL_LABELS = ['shake', 'crack', 'split', 'rise', 'name', 'story', 'confetti'] as const;

/**
 * The hatch, as one timeline: the egg wiggles, a crack draws across it, the halves fly apart in a
 * burst of light, the yeti springs up (onRise → CRACK_DONE), then — once the name is known — its
 * letters drop in, the story fades up and snow-confetti falls. Without reduced motion the timeline
 * waits at `name` until the caller resumes it.
 */
export function buildRevealTimeline(root: Element, reduce: boolean, hooks: { onRise: () => void }) {
  const gsap = registerGsap();
  const q = (s: string) => root.querySelector(s);
  if (!gsap.parseEase('reveal-wiggle')) CustomWiggle.create('reveal-wiggle', { wiggles: 7, type: 'easeOut' });
  const tl = gsap.timeline({ paused: true });

  gsap.set([q('.reveal-yeti'), q('.reveal-burst')], { autoAlpha: 0 });

  tl.addLabel('shake')
    .to(q('.reveal-egg'), { rotation: 9, transformOrigin: '50% 92%', duration: 1, ease: 'reveal-wiggle' }, 'shake')
    .to(q('.reveal-egg'), { scaleY: 0.94, scaleX: 1.05, transformOrigin: '50% 100%', duration: 0.25, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 'shake+=0.75');

  tl.addLabel('crack', '+=0.05')
    .call(() => sound.play('crack'), [], 'crack')
    .fromTo(q('.reveal-crack'), { drawSVG: '0%', autoAlpha: 1 }, { drawSVG: '100%', duration: 0.45, ease: 'power2.in' }, 'crack')
    .to(q('.reveal-egg'), { x: 5, duration: 0.05, repeat: 5, yoyo: true }, 'crack+=0.3');

  tl.addLabel('split', '+=0.35')
    .to(q('.reveal-crack'), { autoAlpha: 0, duration: 0.1 }, 'split')
    .fromTo(q('.reveal-burst'), { scale: 0.2, rotation: 0 }, { autoAlpha: 1, scale: 1.25, rotation: 25, duration: 0.6, ease: 'expo.out' }, 'split')
    .to(q('.egg-top'), { x: -70, y: -120, rotation: -40, autoAlpha: 0, transformOrigin: '50% 50%', duration: 0.7, ease: 'power2.out' }, 'split')
    .to(q('.egg-bottom'), { x: 40, y: 70, rotation: 18, autoAlpha: 0, transformOrigin: '50% 50%', duration: 0.7, ease: 'power2.out' }, 'split');

  tl.addLabel('rise', 'split+=0.15')
    .call(hooks.onRise, [], 'rise')
    .call(() => sound.play('chime'), [], 'rise')
    .fromTo(q('.reveal-yeti'), { autoAlpha: 0, y: 70, scale: 0.55 }, { autoAlpha: 1, y: 0, scale: 1, transformOrigin: '50% 100%', duration: 0.9, ease: 'elastic.out(1, 0.45)' }, 'rise')
    .to(q('.reveal-burst'), { rotation: 70, duration: 3, ease: 'none' }, 'rise');

  tl.addLabel('name', 'rise+=0.6');
  if (!reduce) tl.addPause('name');
  tl.call(() => {
    const name = q('.reveal-name');
    if (!name || reduce) return;
    const split = SplitText.create(name, { type: 'chars' });
    gsap.from(split.chars, { yPercent: -120, autoAlpha: 0, rotation: () => gsap.utils.random(-25, 25), stagger: 0.035, duration: 0.6, ease: 'bounce.out', onComplete: () => split.revert() });
  }, [], 'name');

  tl.addLabel('story', 'name+=0.5')
    .call(() => {
      if (reduce) return;
      const els = [q('.reveal-meta'), q('.reveal-story')].filter(Boolean);
      if (els.length) gsap.from(els, { y: 14, autoAlpha: 0, stagger: 0.12, duration: 0.5, ease: 'power2.out' });
    }, [], 'story');

  tl.addLabel('confetti', 'story+=0.3')
    .call(() => { sound.play('levelup'); if (!reduce) snowConfetti(q('.reveal-confetti') as HTMLCanvasElement | null); }, [], 'confetti')
    .to({}, { duration: 0.01 });

  if (reduce) return settle(tl);
  return tl.play();
}

/** A one-shot burst of up to 80 snowflake and element-coloured confetti, then it clears itself. */
export function snowConfetti(canvas: HTMLCanvasElement | null, count = 80) {
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return;
  const w = (canvas.width = canvas.offsetWidth * devicePixelRatio), h = (canvas.height = canvas.offsetHeight * devicePixelRatio);
  const colors = ['#FFFFFF', '#CFE6FF', '#5E8FD3', '#7A5BD6', '#2BB393', '#F07A3A'];
  const ps = Array.from({ length: Math.min(80, count) }, () => ({
    x: w / 2, y: h * 0.42, vx: (Math.random() - 0.5) * 14 * devicePixelRatio, vy: (-6 - Math.random() * 10) * devicePixelRatio,
    r: (3 + Math.random() * 4) * devicePixelRatio, c: colors[(Math.random() * colors.length) | 0], a: Math.random() * 6, round: Math.random() < 0.5,
  }));
  const start = performance.now();
  const frame = (t: number) => {
    const life = (t - start) / 2600;
    ctx.clearRect(0, 0, w, h);
    if (life >= 1) return;
    ctx.globalAlpha = 1 - life * life;
    for (const p of ps) {
      p.vy += 0.32 * devicePixelRatio; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.a += 0.15;
      ctx.fillStyle = p.c; ctx.strokeStyle = '#14213D'; ctx.lineWidth = devicePixelRatio;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
      ctx.beginPath();
      if (p.round) ctx.arc(0, 0, p.r, 0, Math.PI * 2); else ctx.rect(-p.r, -p.r / 2, p.r * 2, p.r);
      ctx.fill(); ctx.stroke(); ctx.restore();
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
