import { useEffect, useState } from 'react';
import { run } from '../lib/api';
import { buildFinishTraining, buildSkipTraining, buildStartTraining, type Yeti } from '../lib/flurry';
import { useShop } from '../lib/useShop';
import { skipPrice } from '../lib/home';
import { sui } from '../lib/merge';
import type { Snapshot } from '../lib/progress';
import { bandName, shortDuration, traitAction, traitRows, trainingStatus, SLOT_LABEL } from '../lib/train';
import { TraitGlyph } from './TraitGlyph';
import { clockOffset, syncClock } from '../lib/clock';
import { ConfirmPurchase } from '../ui/ConfirmPurchase';
import { Icon } from '../ui/Icon';
import { useToast } from '../ui/Toast';
import { sound } from '../lib/sound';

/** One yeti's traits: points, train +1 (Snowflakes + a timer), the countdown, Skip (SUI) and Finish. */
export function TraitTraining({ snap, yeti, refresh }: { snap: Snapshot; yeti: Yeti; refresh: (until?: (s: Snapshot) => boolean) => Promise<void> }) {
  const toast = useToast();
  const { shop, balance, reload } = useShop(snap);
  const [busy, setBusy] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [skipAt, setSkipAt] = useState<bigint | null>(null);
  useEffect(() => { void syncClock(); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (!snap.profile) return null;
  const profileId = snap.profile.id;
  const snowflakes = Number(snap.profile.snowflakes);

  async function train(slot: number) {
    setBusy(`train-${slot}`);
    try {
      const r = await run(buildStartTraining(yeti.id, profileId, slot), snap.address);
      if (!r.ok) throw new Error('Training could not start. Try again.');
      await refresh((s) => !!s.yetis.find((y) => y.id === yeti.id)?.training);
      sound.play('tap');
    } catch (e) { toast((e as Error).message); } finally { setBusy(null); }
  }
  async function skip(price: bigint) {
    setBusy('skip');
    try {
      const r = await run(buildSkipTraining(yeti.id, price + (shop?.skipPerMin ?? 0n)), snap.address);
      if (!r.ok) throw new Error('The skip did not go through. Try again.');
      await refresh((s) => !s.yetis.find((y) => y.id === yeti.id)?.training);
      await reload();
      setSkipAt(null);
      sound.play('levelup'); toast('Trait raised +1');
    } catch (e) { toast((e as Error).message); } finally { setBusy(null); }
  }
  async function collect() {
    setBusy('finish');
    try {
      const r = await run(buildFinishTraining(yeti.id), snap.address);
      if (!r.ok) throw new Error('Not quite ready yet. Give it a few seconds.');
      await refresh((s) => !s.yetis.find((y) => y.id === yeti.id)?.training);
      sound.play('levelup'); toast('Trait raised +1');
    } catch (e) { toast((e as Error).message); } finally { setBusy(null); }
  }

  const status = trainingStatus(yeti, now, clockOffset);
  const rows = traitRows(yeti, snowflakes, now + clockOffset);
  return (
    <>
      <ul className="trait-cards">
        {rows.map((r) => {
          const act = traitAction(r, status, status ? SLOT_LABEL[status.slot] : null, snowflakes);
          return (
            <li key={r.slot} className={`trait-card is-${act.kind}`}>
              <div className="tc-head">
                <span className="tc-icon"><TraitGlyph slot={r.slot} /></span>
                <span className="tc-title">
                  <b>{r.label}<span className={`band band-${r.band} tt-band`}>{bandName(r.band)}</span></b>
                  <small>{r.stat}</small>
                </span>
                <span className="tc-count" aria-label={`${r.points} of ${r.cap} points`}><b>{r.points}</b>/{r.cap}</span>
              </div>
              <span className="tc-bar" aria-hidden="true" style={{ ['--n' as string]: r.cap }}>
                {Array.from({ length: r.cap }, (_, i) => <i key={i} className={i < r.points ? 'on' : i === r.points && (act.kind === 'training' || act.kind === 'ready') ? 'next' : ''} />)}
              </span>
              <div className="tc-action">
                {(act.kind === 'train' || act.kind === 'need') && (
                  <button className={`tc-train ${act.kind === 'need' ? 'is-short' : ''}`} disabled={act.kind === 'need' || !!busy} onClick={() => train(r.slot)}
                    aria-label={act.kind === 'need' ? `${act.label}. Training costs ${r.cost} Snowflakes and takes ${shortDuration(r.ms)}.` : `Train ${r.label} +1 for ${r.cost} Snowflakes. Takes ${shortDuration(r.ms)}.`}>
                    <span className="tc-train-label">{busy === `train-${r.slot}` ? 'Starting…' : act.kind === 'need' ? act.label.replace(' Snowflakes', '') : act.label}</span>
                    <span className="tc-cost" aria-hidden="true">
                      <span className="tc-chip"><Icon name="snowflake" size={14} />{r.cost}</span>
                      <span className="tc-chip"><Icon name="clock" size={14} />{shortDuration(r.ms)}</span>
                    </span>
                  </button>
                )}
                {act.kind === 'training' && <>
                  <span className="tc-timer"><span className="tc-time-bar"><span style={{ width: `${act.frac * 100}%` }} /></span>{act.label}</span>
                  {shop && status && <button className="btn tc-skip" disabled={busy === 'skip'} onClick={() => setSkipAt(skipPrice(status.remainingMs, shop.skipPerMin))}>
                    {busy === 'skip' ? 'Skipping…' : `Skip · ${sui(skipPrice(status.remainingMs, shop.skipPerMin))}`}
                  </button>}
                </>}
                {act.kind === 'ready' && <button className="btn warm tc-btn" disabled={busy === 'finish'} onClick={collect}>{busy === 'finish' ? 'Saving…' : act.label}</button>}
                {act.kind === 'maxed' && <span className="tc-note is-maxed"><svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>{act.label}</span>}
                {act.kind === 'waiting' && <span className="tc-note">{act.label}</span>}
              </div>
            </li>
          );
        })}
      </ul>
      {skipAt !== null && (
        <ConfirmPurchase open item={`Finish ${yeti.name}'s training now`} detail="The trait goes up +1 straight away."
          price={skipAt} currency="SUI" balance={balance} busy={busy === 'skip'}
          onConfirm={() => skip(skipAt)} onClose={() => !busy && setSkipAt(null)} />
      )}
    </>
  );
}
