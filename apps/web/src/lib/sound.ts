/**
 * Tiny synthesized sound effects (Web Audio, no files): soft, bell-like and quiet.
 * Off by default, remembered in localStorage, and silent until the player's first tap or key.
 */
export type SoundName = 'tap' | 'warm' | 'crack' | 'chime' | 'ding' | 'levelup' | 'heartbeat';
type Ctx = Pick<AudioContext, 'currentTime' | 'destination' | 'createOscillator' | 'createGain' | 'resume' | 'state'>;

const KEY = 'flurry:sound';
// [frequency Hz, start s, length s, wave]
const NOTES: Record<SoundName, [number, number, number, OscillatorType][]> = {
  tap: [[660, 0, 0.06, 'sine']],
  warm: [[220, 0, 0.25, 'triangle'], [330, 0.02, 0.25, 'sine']],
  crack: [[180, 0, 0.05, 'square'], [140, 0.06, 0.05, 'square'], [120, 0.12, 0.08, 'square']],
  chime: [[784, 0, 0.5, 'sine'], [988, 0.09, 0.5, 'sine'], [1319, 0.18, 0.8, 'sine']],
  ding: [[1568, 0, 0.25, 'sine']],
  heartbeat: [[70, 0, 0.12, 'sine'], [62, 0.18, 0.16, 'sine']],
  levelup: [[523, 0, 0.18, 'triangle'], [659, 0.12, 0.18, 'triangle'], [784, 0.24, 0.18, 'triangle'], [1047, 0.36, 0.5, 'sine']],
};

export function createSound(makeContext: () => Ctx = () => new AudioContext()) {
  let enabled = false;
  try { enabled = localStorage.getItem(KEY) === '1'; } catch { /* storage blocked: stay off */ }
  let unlocked = false;
  let ctx: Ctx | null = null;

  return {
    get enabled() { return enabled; },
    setEnabled(on: boolean) {
      enabled = on;
      try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* keep in memory only */ }
    },
    /** Call from a user gesture; browsers block audio before one. */
    unlock() { unlocked = true; },
    play(name: SoundName) {
      if (!enabled || !unlocked) return;
      try {
        ctx ??= makeContext();
        if (ctx.state === 'suspended') void ctx.resume();
        const t0 = ctx.currentTime;
        for (const [f, at, len, type] of NOTES[name]) {
          const osc = ctx.createOscillator(), gain = ctx.createGain();
          osc.type = type;
          osc.frequency.setValueAtTime(f, t0 + at);
          gain.gain.setValueAtTime(0.0001, t0 + at);
          gain.gain.linearRampToValueAtTime(name === 'crack' ? 0.05 : name === 'heartbeat' ? 0.2 : 0.09, t0 + at + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + len);
          osc.connect(gain).connect(ctx.destination);
          osc.start(t0 + at); osc.stop(t0 + at + len + 0.05);
        }
      } catch { /* audio unavailable: stay silent */ }
    },
  };
}

export const sound = createSound();
if (typeof window !== 'undefined') {
  const unlock = () => { sound.unlock(); removeEventListener('pointerdown', unlock); removeEventListener('keydown', unlock); };
  addEventListener('pointerdown', unlock); addEventListener('keydown', unlock);
  // A soft tap on every button press.
  addEventListener('click', (e) => { if ((e.target as Element).closest?.('.btn, .den-card-btn, .tab')) sound.play('tap'); }, true);
}
