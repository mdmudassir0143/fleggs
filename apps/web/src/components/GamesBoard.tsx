import { useEffect, useState } from 'react';
import { ELEMENT_COLORS } from '@flurry/art';
import { PURPOSE } from '@flurry/shared';
import { run } from '../lib/api';
import { buildBuyExtraPlay, buildEarn, type Yeti } from '../lib/flurry';
import { usePlays } from '../lib/usePlays';
import { useShop } from '../lib/useShop';
import { sui } from '../lib/merge';
import type { Snapshot } from '../lib/progress';
import { gameTiles, playLabel } from '../lib/train';
import { RunFlow } from './RunFlow';
import { GameDiagram } from './GameDiagram';
import { ConfirmPurchase } from '../ui/ConfirmPurchase';
import { useToast } from '../ui/Toast';
import { sound } from '../lib/sound';

/**
 * The four training games: plays left, the bonus from the chosen yeti's traits, and a play button.
 * A run takes over the page (onFocus) until the player exits.
 */
export function GamesBoard({ snap, yeti, refresh, onFocus, onTrain }: {
  snap: Snapshot; yeti: Yeti; refresh: (until?: (s: Snapshot) => boolean) => Promise<void>;
  onFocus?: (on: boolean) => void; onTrain?: () => void;
}) {
  const toast = useToast();
  const plays = usePlays(snap);
  const { balance, reload } = useShop(snap);
  const [playing, setPlaying] = useState<number | null>(null);
  const [buying, setBuying] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { onFocus?.(playing !== null); }, [playing]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!snap.profile) return null;
  const profileId = snap.profile.id;

  async function buyPlay(game: number) {
    setBusy(true);
    try {
      const r = await run(buildBuyExtraPlay(profileId, game, plays.price), snap.address);
      if (!r.ok) throw new Error('The purchase did not go through. Nothing was charged; try again.');
      await Promise.all([plays.reload(), reload()]);
      setBuying(null);
      sound.play('chime');
      setPlaying(game);
    } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  }

  if (playing !== null) {
    const before = snap.profile.snowflakes;
    return (
      <RunFlow snap={snap} purpose={PURPOSE.Training} game={playing} yeti={yeti}
        title={`Training run · ${gameTiles(yeti).find((t) => t.game === playing)!.name}`}
        build={(a) => buildEarn(profileId, playing, a)} until={(s) => (s.profile?.snowflakes ?? 0n) > before}
        refresh={refresh} onTrain={onTrain ? () => { setPlaying(null); onTrain(); } : undefined}
        onExit={() => { setPlaying(null); void plays.reload(); }} />
    );
  }

  return (
    <>
      <div className="game-tiles">
        {gameTiles(yeti).map((t) => {
          const pl = playLabel(plays.left[t.game], plays.price);
          const left = plays.left[t.game];
          const bonus = t.note ?? (t.bonus ? `+${t.bonus} bonus` : 'No bonus yet');
          return (
            <div key={t.game} className={`game-tile ${pl.paid ? 'is-paid' : ''}`} style={{ ['--el' as string]: ELEMENT_COLORS[t.element] }}>
              <span className={`gt-bonus ${t.bonus ? '' : 'is-zero'} ${t.note ? 'is-locked' : ''}`} aria-hidden="true">{t.note ? 'Level 2+' : bonus}</span>
              <span className="gt-plays" aria-hidden="true">
                {pl.paid ? <span className="gt-pill is-paid">{sui(plays.price)}</span> : (
                  <>
                    {left.free > 0 && <span className="gt-pill">{left.free} free{left.credits > 0 && <span className="gt-extra">+{left.credits}</span>}</span>}
                    {left.free === 0 && left.credits > 0 && <span className="gt-pill is-bought">{left.credits} bought</span>}
                  </>
                )}
              </span>
              <span className="gt-art" aria-hidden="true"><GameDiagram game={t.game} /></span>
              <span className="gt-text" aria-hidden="true">
                <span className="game-tile-name">{t.name}</span>
                <span className="game-tile-stat">{t.stat}</span>
              </span>
              <button className="gt-go" aria-label={pl.paid ? `Buy a ${t.name} play for ${sui(plays.price)} and play` : `Play ${t.name}. ${t.stat}. ${bonus}. ${pl.text}.`}
                onClick={() => (pl.paid ? setBuying(t.game) : setPlaying(t.game))}>
                <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M7 4.5v11l9-5.5z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
              </button>
            </div>
          );
        })}
      </div>
      {buying !== null && (
        <ConfirmPurchase open item={`1 extra ${gameTiles(yeti).find((t) => t.game === buying)!.name} play`}
          detail="You've used today's 2 free plays of this game. The game starts right after."
          price={plays.price} currency="SUI" balance={balance} busy={busy}
          onConfirm={() => buyPlay(buying)} onClose={() => !busy && setBuying(null)} />
      )}
    </>
  );
}
