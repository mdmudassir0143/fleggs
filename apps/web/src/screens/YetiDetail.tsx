import { useEffect, useState } from 'react';
import { ELEMENT_COLORS, ELEMENT_NAMES } from '@flurry/art';
import type { Yeti } from '../lib/flurry';
import type { Snapshot } from '../lib/progress';
import { mergeGroups } from '../lib/merge';
import { mergeProgress, mergeReadiness, yetiStatus } from '../lib/train';
import { LEVEL_NAMES } from '@flurry/shared';
import { clockOffset } from '../lib/clock';
import { foilFor } from '../lib/den';
import { HoloCard } from '../ui/HoloCard';
import { Icon } from '../ui/Icon';
import { YetiArt } from '../components/YetiArt';
import { NameYeti } from '../components/NameYeti';
import { TraitTraining } from '../components/TraitTraining';
import { YetiSheet } from './YetiSheet';

/** One yeti's page: who it is, its card, and its traits to train. Back returns to the grid. */
export function YetiDetail({ snap, yeti, refresh, onBack, onPick, onPlay, avatarYetiId, onSetAvatar }: {
  snap: Snapshot; yeti: Yeti; refresh: (until?: (s: Snapshot) => boolean) => Promise<void>;
  onBack: () => void; onPick: (id: string) => void; onPlay: () => void;
  avatarYetiId?: string; onSetAvatar: (yetiId: string) => Promise<void>;
}) {
  const [card, setCard] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [yeti.id]);
  const i = snap.yetis.findIndex((y) => y.id === yeti.id);
  const prev = snap.yetis[(i - 1 + snap.yetis.length) % snap.yetis.length];
  const next = snap.yetis[(i + 1) % snap.yetis.length];
  const st = yetiStatus(yeti, now, clockOffset);
  const canMerge = mergeReadiness(yeti).ready && mergeGroups(snap.yetis).some((g) => g.yetis.includes(yeti.id));
  const el = yeti.elements[0] ?? 0;
  const mp = mergeProgress(yeti);
  const ready = mergeReadiness(yeti).ready;

  return (
    <section className="yeti-detail" aria-label={`${yeti.name}'s page`}>
      <nav className="yd-nav" aria-label="Yetis">
        <button className="yd-back" onClick={onBack}><span aria-hidden="true">‹</span> All yetis</button>
        {snap.yetis.length > 1 && (
          <span className="yd-step">
            <button className="yd-arrow" onClick={() => onPick(prev.id)} aria-label={`Previous: ${prev.name}`}>‹</button>
            <span className="yd-count">{i + 1} / {snap.yetis.length}</span>
            <button className="yd-arrow" onClick={() => onPick(next.id)} aria-label={`Next: ${next.name}`}>›</button>
          </span>
        )}
      </nav>

      <div className="yd-hero" style={{ ['--el' as string]: ELEMENT_COLORS[el] }}>
        <button className="yd-card" onClick={() => setCard(true)} aria-label={`View ${yeti.name}'s card`}>
          <HoloCard foil={foilFor(yeti.variants)} className={`yeti-card el-${el}`}>
            <span className="yeti-card-level" aria-hidden="true">L{yeti.level}</span>
            <YetiArt yeti={yeti} />
          </HoloCard>
        </button>
        <div className="yd-info">
          <h2 className="yd-name">{yeti.name}</h2>
          <p className="yd-meta">Level {yeti.level} · {LEVEL_NAMES[yeti.level]} · {ELEMENT_NAMES[el]}</p>
          {st.tone === 'busy' || st.tone === 'ready' ? <span className={`yr-status is-${st.tone}`}>{st.text}</span> : null}
          <div className="yd-actions">
            <button className="btn yd-btn" onClick={() => setCard(true)}><Icon name="share" size={18} /> View card</button>
            {canMerge && <a className="btn warm yd-btn" href="#merge"><Icon name="merge" size={18} /> Merge</a>}
          </div>
          <NameYeti yeti={yeti} address={snap.address} refresh={refresh} compact />
        </div>
        <div className={`yd-progress ${ready ? 'is-ready' : ''}`} role="group" aria-label="Merge progress">
          <span className="yd-ring" style={{ ['--p' as string]: `${(mp.points / mp.total) * 100}%` }} aria-hidden="true"><b>{mp.points}</b><small>/{mp.total}</small></span>
          <span className="yd-progress-text">
            <b>{ready ? 'Ready to merge' : `${mp.left} ${mp.left === 1 ? 'training' : 'trainings'} to merge`}</b>
            <small>{ready ? `Pair it with another Level ${yeti.level} to reach Level ${yeti.level + 1}.` : `Max every trait to ${yeti.level * 2} to merge into Level ${yeti.level + 1}.`}</small>
          </span>
        </div>
      </div>

      <div className="label-row">
        <h3 className="keeper-label">Traits</h3>
        <span className="trait-cap">Level {yeti.level} · up to {yeti.level * 2}</span>
      </div>
      <TraitTraining snap={snap} yeti={yeti} refresh={refresh} />

      <button className="yd-earn" onClick={onPlay}>
        <span className="yd-earn-icon" aria-hidden="true"><Icon name="snowflake" size={22} /></span>
        <span><b>You have {Number(snap.profile?.snowflakes ?? 0n)} Snowflakes</b><small>Play games to earn more. {yeti.name}'s traits give bonuses.</small></span>
        <span className="yd-earn-go" aria-hidden="true">›</span>
      </button>

      {card && (
        <YetiSheet yeti={yeti} open onClose={() => setCard(false)} address={snap.address} refresh={refresh}
          isAvatar={avatarYetiId === yeti.id} onSetAvatar={onSetAvatar} />
      )}
    </section>
  );
}
