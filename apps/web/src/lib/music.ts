/**
 * Background music, generated live with Web Audio (no files): a slow, cosy lofi loop — warm
 * chord pad through a soft low-pass, a music-box melody with a gentle echo and a round bass note. On by default, remembered in localStorage, and only starts after the
 * player's first tap/click/key (browsers block audio before that).
 */
const KEY = 'flurry:music';
const BPM = 68;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
/** Fmaj9 – Em7 – Dm9 – Cmaj7 (MIDI notes), one bar each. */
export const PROGRESSION: number[][] = [
  [53, 60, 64, 67, 69],
  [52, 59, 62, 67, 71],
  [50, 57, 60, 64, 65],
  [48, 55, 59, 64, 67],
];
const MELODY_POOL = [72, 74, 76, 79, 81, 84]; // C major pentatonic, music-box register

type Ctx = AudioContext;

export function createMusic(makeContext: () => Ctx = () => new AudioContext()) {
  let enabled = true;
  try { enabled = localStorage.getItem(KEY) !== '0'; } catch { /* storage blocked: default on */ }
  let ctx: Ctx | null = null;
  let master: GainNode | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;
  let nextBar = 0, bar = 0, playing = false, unlocked = false;
  const listeners = new Set<(on: boolean) => void>();

  function graph(c: Ctx) {
    const out = c.createGain(); out.gain.value = 0;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1900; lp.Q.value = 0.4;
    // A soft echo for the music box.
    const delay = c.createDelay(1.5); delay.delayTime.value = BEAT * 0.75;
    const fb = c.createGain(); fb.gain.value = 0.32;
    const wet = c.createGain(); wet.gain.value = 0.35;
    delay.connect(fb).connect(delay); delay.connect(wet).connect(lp);
    lp.connect(out).connect(c.destination);
    return { out, lp, delay };
  }
  let nodes: ReturnType<typeof graph> | null = null;


  function tone(c: Ctx, dest: AudioNode, f: number, t: number, len: number, type: OscillatorType, peak: number, attack: number) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(dest); o.start(t); o.stop(t + len + 0.1);
  }

  function scheduleBar(c: Ctx, t: number) {
    const chord = PROGRESSION[bar % PROGRESSION.length];
    // Pad: each chord tone as a pair of slightly detuned soft triangles.
    for (const n of chord.slice(1)) {
      tone(c, nodes!.lp, hz(n), t, BAR + 1.2, 'triangle', 0.035, 1.2);
      tone(c, nodes!.lp, hz(n) * 1.004, t + 0.03, BAR + 1.2, 'sine', 0.025, 1.4);
    }
    // Bass: the root, round and low, on beats 1 and 3.
    tone(c, nodes!.lp, hz(chord[0] - 12), t, BEAT * 1.8, 'sine', 0.12, 0.04);
    tone(c, nodes!.lp, hz(chord[0] - 12), t + BEAT * 2, BEAT * 1.6, 'sine', 0.09, 0.04);
    // Music box: a sparse, swung pentatonic melody that leans on chord tones.
    for (let i = 0; i < 8; i++) {
      if (Math.random() < (i % 2 ? 0.28 : 0.5)) {
        const pool = Math.random() < 0.6 ? chord.slice(2).map((n) => n + 12) : MELODY_POOL;
        const n = pool[(Math.random() * pool.length) | 0];
        const at = t + i * (BEAT / 2) + (i % 2 ? BEAT * 0.08 : 0);
        tone(c, nodes!.lp, hz(n), at, 1.4, 'sine', 0.05, 0.005);
        tone(c, nodes!.delay, hz(n), at, 1.4, 'sine', 0.035, 0.005);
        tone(c, nodes!.lp, hz(n) * 2, at, 0.5, 'sine', 0.008, 0.005); // bell overtone
      }
    }
    bar++;
  }

  function start() {
    if (playing || !enabled || !unlocked) return;
    try {
      ctx ??= makeContext();
      if (!nodes) nodes = graph(ctx); // no vinyl crackle: it read as hiss on phone speakers
      void ctx.resume();
      const now = ctx.currentTime;
      nodes.out.gain.cancelScheduledValues(now);
      nodes.out.gain.setValueAtTime(nodes.out.gain.value, now);
      nodes.out.gain.linearRampToValueAtTime(0.55, now + 2.5); // fade in
      nextBar = Math.max(nextBar, now + 0.1);
      timer = setInterval(() => {
        while (ctx && nextBar < ctx.currentTime + BAR) { scheduleBar(ctx, nextBar); nextBar += BAR; }
      }, 250);
      playing = true;
      listeners.forEach((l) => l(true));
    } catch { /* audio unavailable: stay silent */ }
  }

  function stop() {
    if (!playing || !ctx || !nodes) return;
    const now = ctx.currentTime;
    nodes.out.gain.cancelScheduledValues(now);
    nodes.out.gain.setValueAtTime(nodes.out.gain.value, now);
    nodes.out.gain.linearRampToValueAtTime(0, now + 0.8); // fade out
    clearInterval(timer);
    const c = ctx;
    setTimeout(() => { if (!playing) void c.suspend(); nextBar = 0; }, 900);
    playing = false;
    listeners.forEach((l) => l(false));
  }

  return {
    get enabled() { return enabled; },
    get playing() { return playing; },
    setEnabled(on: boolean) {
      enabled = on;
      try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* memory only */ }
      if (on) { unlocked = true; start(); } else stop();
      listeners.forEach((l) => l(on));
    },
    /** Call from a user gesture. */
    unlock() { unlocked = true; start(); },
    /** Pause while the tab is hidden; resume when back. */
    visibility(hidden: boolean) { if (hidden) stop(); else start(); },
    subscribe(fn: (on: boolean) => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  };
}

export const music = createMusic();
if (typeof window !== 'undefined') {
  // Starting audio costs ~200 ms on some phones; do it just after the tap's own animation, still
  // inside the browser's user-activation window, so the first tap never stutters.
  const unlock = () => {
    removeEventListener('pointerdown', unlock); removeEventListener('keydown', unlock);
    const go = () => music.unlock();
    setTimeout(() => ('requestIdleCallback' in window ? requestIdleCallback(go, { timeout: 800 }) : go()), 700);
  };
  addEventListener('pointerdown', unlock); addEventListener('keydown', unlock);
  document.addEventListener('visibilitychange', () => music.visibility(document.hidden));
}
