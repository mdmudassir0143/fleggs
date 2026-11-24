import { Suspense, lazy } from 'react';
import type { GameHostProps } from './GameHost';
import { SnowLoader } from '../ui/SnowLoader';

// Phaser is large; it loads only when a game actually starts.
const GameHost = lazy(() => import('./GameHost').then((m) => ({ default: m.GameHost })));

export function LazyGameHost(props: GameHostProps) {
  return (
    <Suspense fallback={<div className="game game-loading"><SnowLoader label="Warming up…" /></div>}>
      <GameHost {...props} />
    </Suspense>
  );
}
