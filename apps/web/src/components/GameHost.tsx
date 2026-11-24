import type { KIWLive } from '@flurry/games';
import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { GAME } from '@flurry/shared';
import { KeepItWarmScene, keepItWarmConfig, IcicleDashScene, icicleDashConfig, LofiBeatsScene, lofiBeatsConfig, IglooStackScene, iglooStackConfig } from '@flurry/games/phaser';
import { music } from '../lib/music';

export type GameResult = { score: number; endTick: number };
export type GameHostProps = {
  game?: number;
  seed: number;
  /** Stat bonus (trait points) the Worker will also use when replaying. */
  bonus?: number;
  /** The player's yeti, drawn inside games that show a runner. */
  yetiSvg?: string;
  /** @deprecated Keep It Warm's old prop name for `bonus`. */
  warmth?: number;
  /** Keep It Warm egg stage (0–2), as returned by /run/start. */
  stage?: 0 | 1 | 2;
  /** Keep It Warm live progress (score so far, gusts, combo). */
  onFrame?(f: KIWLive): void;
  onFinish(result: GameResult, inputs: unknown[]): void;
};

type Entry = { key: string; scene: typeof Phaser.Scene; config(parent: HTMLElement): Phaser.Types.Core.GameConfig; label: string };
const GAMES: Record<number, Entry> = {
  [GAME.KeepItWarm]: { key: 'keep-it-warm', scene: KeepItWarmScene, config: keepItWarmConfig, label: 'Keep It Warm. Hold to warm the egg, release to cool it.' },
  [GAME.LofiBeats]: { key: 'lofi-beats', scene: LofiBeatsScene, config: lofiBeatsConfig, label: 'Lofi Beats. Tap each lane as its snowflake reaches the line.' },
  [GAME.IglooStack]: { key: 'igloo-stack', scene: IglooStackScene, config: iglooStackConfig, label: 'Igloo Stack. Tap or press Space to drop each swinging ice block.' },
  [GAME.IcicleDash]: { key: 'icicle-dash', scene: IcicleDashScene, config: icicleDashConfig, label: 'Icicle Dash. Swipe or tap a side to change lanes and dodge the icicles.' },
};

/** Mounts one run of a game; unmounting destroys the Phaser game. */
export function GameHost(props: GameHostProps) {
  const ref = useRef<HTMLDivElement>(null);
  const onFinish = useRef(props.onFinish);
  onFinish.current = props.onFinish;
  const onFrame = useRef(props.onFrame);
  onFrame.current = props.onFrame;
  const game = props.game ?? GAME.KeepItWarm;
  const entry = GAMES[game] ?? GAMES[GAME.KeepItWarm];
  const bonus = props.bonus ?? props.warmth ?? 0;

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    // Lofi Beats brings its own beat: pause the background music while it plays.
    const quiet = game === GAME.LofiBeats && music.playing;
    if (quiet) music.visibility(true);
    host.querySelectorAll('canvas').forEach((c) => c.remove()); // never stack on a stale canvas
    const g = new Phaser.Game(entry.config(host));
    if (import.meta.env.DEV) (window as unknown as { __game?: Phaser.Game }).__game = g;
    g.scene.add(entry.key, entry.scene, true, {
      seed: props.seed, bonus, warmth: bonus, stage: props.stage ?? 0, yetiSvg: props.yetiSvg,
      onFrame: (f: KIWLive) => onFrame.current?.(f),
      onFinish: (r: GameResult, inputs: unknown[]) => onFinish.current(r, inputs),
    });
    return () => {
      // A game destroyed before it finishes booting keeps its canvas; remove it ourselves.
      g.destroy(true);
      host.querySelectorAll('canvas').forEach((c) => c.remove());
      if (quiet) music.visibility(false);
    };
  }, [props.seed, bonus, game, props.yetiSvg, entry, props.stage]);

  return <div ref={ref} className="game" role="application" aria-label={entry.label} />;
}
