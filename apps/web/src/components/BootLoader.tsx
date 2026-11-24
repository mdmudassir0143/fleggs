import { EggArt } from './EggArt';

/**
 * The first thing a player sees while the game wakes up: a big egg wobbling and hopping in a warm
 * glow, with snow drifting past. Pure CSS, so it moves even while the app is still loading.
 */
export function BootLoader({ label = 'Warming up…' }: { label?: string }) {
  return (
    <div className="boot" role="status">
      <div className="boot-scene" aria-hidden="true">
        {Array.from({ length: 14 }, (_, i) => <i key={i} className="boot-flake" style={{ left: `${(i * 71) % 100}%`, animationDelay: `${-(i * 0.9) % 7}s`, animationDuration: `${6 + (i % 4)}s` }} />)}
        <span className="boot-glow" />
        <span className="boot-egg"><EggArt stage={1} /></span>
      </div>
      <p className="boot-label">{label}</p>
    </div>
  );
}
