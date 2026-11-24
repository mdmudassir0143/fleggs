import { useState } from 'react';
import { flushSync } from 'react-dom';
import { withViewTransition } from '../motion/smooth';
import { ELEMENT_NAMES } from '@flurry/art';
import { YetiArt } from '../components/YetiArt';
import { HoloCard } from '../ui/HoloCard';
import { foilFor, sortYetis } from '../lib/den';
import { mergeReadiness } from '../lib/train';
import { mergeGroups } from '../lib/merge';
import type { Held, Yeti } from '../lib/flurry';
import { sui } from '../lib/merge';
import type { Snapshot } from '../lib/progress';
import { YetiSheet } from './YetiSheet';
import { YetiStatus } from '../components/YetiStatus';

/** The player's yetis as collectible foil cards, newest first; tap one to open its sheet. */
export function Den({ yetis, compact = false, avatarYetiId, onSetAvatar, address, refresh, onOpen, title = 'Your den', held = [], onOpenHeld }: {
  yetis: Yeti[]; compact?: boolean; avatarYetiId?: string; onSetAvatar?: (yetiId: string) => Promise<void>;
  address?: string; refresh?: (until?: (s: Snapshot) => boolean) => Promise<void>;
  /** When given, tapping a card opens that yeti's page instead of the card sheet. */
  onOpen?: (yetiId: string) => void; title?: string;
  /** Your listed / staked yetis, shown with a badge; tapping one opens Earn. */
  held?: Held[]; onOpenHeld?: (yetiId: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [morph, setMorph] = useState(false);
  const open = yetis.find((y) => y.id === openId);

  // The tapped card morphs into the sheet's card (shared element via View Transitions).
  // The shared-element morph is a desktop flourish; phones get the light, GPU-only sheet slide.
  const canMorph = () => 'startViewTransition' in document && matchMedia('(min-width: 768px) and (hover: hover)').matches;
  function show(id: string | null, from?: HTMLElement) {
    if (!canMorph()) { setMorph(false); setOpenId(id); return; }
    const vt = true;
    from?.classList.add('vt-yeti');
    withViewTransition(() => {
      from?.classList.remove('vt-yeti');
      flushSync(() => { setMorph(vt); setOpenId(id); });
    });
  }
  function hide() {
    if (!morph) { setOpenId(null); return; }
    const card = document.querySelector<HTMLElement>(`[data-yeti="${openId}"] .holo`);
    withViewTransition(() => {
      flushSync(() => setOpenId(null));
      card?.classList.add('vt-yeti');
      setTimeout(() => card?.classList.remove('vt-yeti'), 600);
    });
  }

  if (yetis.length === 0 && held.length === 0) {
    return (
      <section className="den-empty">
        <EmptyCave />
        <h2>Your first yeti will live here.</h2>
        <p className="hint">Warm your egg to hatch one.</p>
      </section>
    );
  }
  return (
    <section className={`den ${compact ? 'den-compact' : ''}`} aria-label="Your yetis">
      <header className="den-head">
        <h2>{title}</h2>
        <span className="den-head-right">
          {mergeGroups(yetis).length > 0 && <a className="btn warm den-merge" href="#merge">Merge</a>}
          <span className="den-count">{yetis.length + held.length} {yetis.length + held.length === 1 ? 'yeti' : 'yetis'}</span>
        </span>
      </header>
      <ul className="den-list">
        {sortYetis(yetis).map((y) => (
          <li key={y.id} data-yeti={y.id}>
            <button className="den-card-btn" onClick={(e) => (onOpen ? onOpen(y.id) : show(y.id, e.currentTarget.querySelector<HTMLElement>('.holo') ?? undefined))} aria-label={`${y.name}, level ${y.level} ${ELEMENT_NAMES[y.elements[0]]} yeti. ${onOpen ? 'Open its traits' : 'Open details'}`}>
              <HoloCard foil={foilFor(y.variants)} className={`yeti-card el-${y.elements[0] ?? 0} ${mergeReadiness(y).ready ? 'is-ready' : ''}`}>
                <span className="yeti-card-level" aria-hidden="true">L{y.level}</span>
                <YetiStatus yeti={y} />
                <YetiArt yeti={y} />
                <span className="yeti-card-name">{y.name}</span>
                <span className="yeti-card-meta">{ELEMENT_NAMES[y.elements[0]]}</span>
              </HoloCard>
            </button>
          </li>
        ))}
        {held.map((h) => (
          <li key={h.yeti.id} data-yeti={h.yeti.id} className="is-held">
            <button className="den-card-btn" onClick={() => onOpenHeld?.(h.yeti.id)} aria-label={`${h.yeti.name}, level ${h.yeti.level}. ${h.where === 'listed' ? `Listed for ${sui(h.price ?? 0n)}` : h.where === 'staked' ? 'Staked in the Lodge' : 'Unstaking'}. Open Earn`}>
              <HoloCard foil={foilFor(h.yeti.variants)} className={`yeti-card el-${h.yeti.elements[0] ?? 0} is-held`}>
                <span className="yeti-card-level" aria-hidden="true">L{h.yeti.level}</span>
                <span className={`held-badge is-${h.where}`}>{h.where === 'listed' ? `Listed · ${sui(h.price ?? 0n)}` : h.where === 'staked' ? 'Staked' : 'Unstaking'}</span>
                <YetiArt yeti={h.yeti} />
                <span className="yeti-card-name">{h.yeti.name}</span>
                <span className="yeti-card-meta">{ELEMENT_NAMES[h.yeti.elements[0]]}</span>
              </HoloCard>
            </button>
          </li>
        ))}
      </ul>
      {open && (
        <YetiSheet yeti={open} open morph={morph} onClose={hide} address={address} refresh={refresh} isAvatar={avatarYetiId === open.id}
          onSetAvatar={onSetAvatar ?? (async () => {})} />
      )}
    </section>
  );
}

/** A cosy, empty cave mouth in the snow. */
function EmptyCave() {
  return (
    <svg className="den-cave" viewBox="0 0 320 200" aria-hidden="true">
      <ellipse cx="160" cy="186" rx="150" ry="14" fill="#14213D" opacity="0.1" />
      <path d="M20,184 C30,90 90,30 160,30 C230,30 290,90 300,184 Z" fill="#E3F0F9" stroke="#14213D" strokeWidth="6" strokeLinejoin="round" />
      <path d="M92,184 C96,124 124,92 160,92 C196,92 224,124 228,184 Z" fill="#2B3A5E" stroke="#14213D" strokeWidth="6" strokeLinejoin="round" />
      <path d="M40,104 C70,62 112,44 160,42 C208,44 250,62 280,104 C262,96 250,108 236,98 C220,88 208,104 190,94 C172,84 160,100 142,92 C124,84 112,100 96,92 C80,84 64,102 40,104 Z" fill="#FFFFFF" stroke="#14213D" strokeWidth="5" strokeLinejoin="round" />
      <circle cx="136" cy="150" r="5" fill="#FFD9A8" /><circle cx="184" cy="150" r="5" fill="#FFD9A8" />
      <path d="M150,170 h20" stroke="#FFD9A8" strokeWidth="4" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}
