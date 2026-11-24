import { useEffect, useMemo, useRef, useState } from 'react';
import type { Transaction } from '@mysten/sui/transactions';
import { composeYeti } from '@flurry/art';
import { post, run } from '../lib/api';
import type { Yeti } from '../lib/flurry';
import type { Snapshot } from '../lib/progress';
import { GAME_INFO } from '../lib/train';
import { LazyGameHost } from './LazyGameHost';
import { GameFinish } from '../screens/GameFinish';
import { SnowLoader } from '../ui/SnowLoader';

export type Attested = { score: number; snowflakes: bigint; expiresMs: bigint; signature: string };

type Phase =
  | { kind: 'starting' }
  | { kind: 'playing'; runId: string; seed: number; bonus: number }
  | { kind: 'saving' | 'done'; score: number; snowflakes: number; error: string | null };

/**
 * One refereed run end to end: start → play → the Worker replays and signs → the result goes on
 * chain (`build`) → the finish screen. Used by training runs and the daily run.
 */
export function RunFlow({ snap, purpose, game, yeti, title, build, until, refresh, onExit, onTrain }: {
  snap: Snapshot; purpose: number; game: number; yeti?: Yeti; title: string;
  build(a: Attested): Transaction;
  until(s: Snapshot): boolean;
  refresh: (until?: (s: Snapshot) => boolean) => Promise<void>;
  onExit(): void;
  onTrain?: () => void;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: 'starting' });
  const started = useRef(false);
  const yetiSvg = useMemo(() => (yeti ? composeYeti({ level: yeti.level, elements: yeti.elements, variants: yeti.variants }) : undefined), [yeti]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    post('/run/start', { profileId: snap.profile!.id, purpose, game, yetiId: yeti?.id })
      .then(({ runId, seed, bonus }) => setPhase({ kind: 'playing', runId, seed, bonus: bonus ?? 0 }))
      .catch((e: Error) => setPhase({ kind: 'done', score: 0, snowflakes: 0, error: e.message }));
  }, [snap.profile, purpose, game, yeti]);

  async function finished(runId: string, score: number, inputs: unknown[]) {
    setPhase({ kind: 'saving', score, snowflakes: 0, error: null });
    try {
      const a = await post('/run/finish', { runId, inputs }) as { score: number; snowflakes: string; expiresMs: string; signature: string };
      setPhase({ kind: 'saving', score: a.score, snowflakes: Number(a.snowflakes), error: null });
      const r = await run(build({ score: a.score, snowflakes: BigInt(a.snowflakes), expiresMs: BigInt(a.expiresMs), signature: a.signature }), snap.address);
      if (!r.ok) throw new Error('That run could not be saved. Try again.');
      await refresh(until);
      setPhase({ kind: 'done', score: a.score, snowflakes: Number(a.snowflakes), error: null });
    } catch (e) {
      setPhase((p) => ({ kind: 'done', score: 'score' in p ? p.score : score, snowflakes: 0, error: (e as Error).message }));
    }
  }

  if (phase.kind === 'starting') return <section className="play page-loader"><SnowLoader label={`Getting ${GAME_INFO[game].name} ready…`} /></section>;
  if (phase.kind === 'playing') {
    return (
      <section className="play">
        <p className="play-head">{title}</p>
        <div className="game-frame">
          <LazyGameHost game={game} seed={phase.seed} bonus={phase.bonus} yetiSvg={yetiSvg} onFinish={(r, inputs) => finished(phase.runId, r.score, inputs)} />
        </div>
      </section>
    );
  }
  return (
    <section className="play">
      <GameFinish score={phase.score} snowflakes={phase.snowflakes} saving={phase.kind === 'saving'} error={phase.error} onRetry={onExit} onContinue={onExit} continueLabel="Back to games" onTrain={onTrain} />
    </section>
  );
}
