import { FusionStage } from '../components/FusionStage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ELEMENT_NAMES, band } from '@flurry/art';
import { useDAppKit } from '@mysten/dapp-kit-react';
import { run } from '../lib/api';
import { buildMerge, getShop, getSuiBalance, type Yeti } from '../lib/flurry';
import type { Snapshot } from '../lib/progress';
import { FAUCET_URL, canAfford, mergeGroups, previewChild, sui } from '../lib/merge';
import { SLOT_LABEL } from '../lib/train';
import { YetiArt } from '../components/YetiArt';
import { HoldButton } from '../ui/HoldButton';
import { SnowLoader } from '../ui/SnowLoader';
import { sound } from '../lib/sound';

const cap1 = (s: string) => s[0].toUpperCase() + s.slice(1);

/** Merge two maxed yetis of the same level: choose the pair, keep a trait per slot, hold to merge. */
export function Merge({ snap, onMerged, onCancel }: { snap: Snapshot; onMerged(digest: string, elements: number[]): void; onCancel(): void }) {
  const dAppKit = useDAppKit();
  const groups = mergeGroups(snap.yetis);
  const byId = (id: string) => snap.yetis.find((y) => y.id === id)!;
  const [pair, setPair] = useState<string[]>([]);
  const [picks, setPicks] = useState<number[]>([]);
  const [fee, setFee] = useState<bigint | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [fusing, setFusing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const client = dAppKit.getClient('testnet');
    getShop(client as never).then((s) => setFee(s.mergeFee)).catch(() => setFee(100_000_000n));
    getSuiBalance(client as never, snap.address).then(setBalance).catch(() => setBalance(0n));
  }, [dAppKit, snap.address]);

  const a = pair[0] ? byId(pair[0]) : null, b = pair[1] ? byId(pair[1]) : null;
  const preview = useMemo(() => (a && b ? previewChild(a, b, picks) : null), [a, b, picks]);

  function toggle(y: Yeti) {
    setError(null);
    if (pair.includes(y.id)) { setPair(pair.filter((p) => p !== y.id)); return; }
    if (pair.length === 1 && byId(pair[0]).level !== y.level) { setPair([y.id]); return; }
    const next = pair.length >= 2 ? [y.id] : [...pair, y.id];
    setPair(next);
    if (next.length === 2) setPicks(Array.from({ length: y.variants.length }, () => 0));
  }

  const [merged, setMerged] = useState<{ digest: string; elements: number[] } | null>(null);
  const handOver = useCallback(() => { if (merged) onMerged(merged.digest, merged.elements); }, [merged, onMerged]);

  async function merge() {
    if (!a || !b || fee === null) return;
    setFusing(true); setError(null);
    sound.play('crack');
    try {
      const r = await run(buildMerge(a.id, b.id, picks, fee), snap.address);
      if (!r.ok) throw new Error('The merge did not go through. Your yetis are safe; try again.');
      setMerged({ digest: r.digest, elements: preview!.elements });
    } catch (e) {
      setFusing(false);
      setError((e as Error).message);
    }
  }

  if (fusing && a && b) return <FusionStage a={a} b={b} done={!!merged} onFused={handOver} />;

  if (!groups.length) {
    return (
      <section className="merge-empty">
        <h2 className="merge-title">Merge</h2>
        <p className="hint">Max out every trait on two yetis of the same level, then come back here to merge them.</p>
        <button className="btn" onClick={onCancel}>Back to my den</button>
      </section>
    );
  }

  return (
    <section className="merge">
      <header className="merge-head"><h2 className="merge-title">Merge</h2><button className="btn ghost merge-cancel" onClick={onCancel}>Cancel</button></header>
      <p className="merge-step">1. Choose two ready yetis of the same level</p>
      {groups.map((g) => (
        <div key={g.level} className="merge-group">
          <span className="merge-group-label">Level {g.level}</span>
          <div className="merge-pick">
            {g.yetis.map((id) => {
              const y = byId(id), on = pair.indexOf(id);
              return (
                <button key={id} className={`merge-yeti ${on >= 0 ? 'is-on' : ''}`} aria-pressed={on >= 0} onClick={() => toggle(y)}>
                  {on >= 0 && <span className="merge-tag">{on === 0 ? 'A' : 'B'}</span>}
                  <YetiArt yeti={y} /><span>{y.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {a && b && preview && (
        <>
          <p className="merge-step">2. Keep one trait from each slot</p>
          <div className="merge-grid">
            <div className="merge-preview">
              <YetiArt yeti={{ level: preview.level, elements: preview.elements, variants: preview.traits.map((t, i) => t.variant ?? (a.variants[i] ?? 0)), name: 'Preview' }} />
              <b>Level {preview.level} · {preview.name}</b>
              <small>{preview.elements.map((e) => ELEMENT_NAMES[e]).join(' + ')} · traits up to {preview.cap}</small>
            </div>
            <ul className="merge-slots">
              {picks.map((p, i) => (
                <li key={i}>
                  <span className="ms-label">{SLOT_LABEL[i]}</span>
                  <div className="ms-choices" role="radiogroup" aria-label={`${SLOT_LABEL[i]}: keep from`}>
                    {[a, b].map((y, k) => (
                      <button key={y.id} role="radio" aria-checked={p === k} className={`ms-choice ${p === k ? 'is-on' : ''}`} onClick={() => setPicks(picks.map((v, j) => (j === i ? k : v)))}>
                        <em>{k === 0 ? 'A' : 'B'}</em> {cap1(band(y.variants[i] ?? 0))} · {y.points?.[i] ?? 0} pts
                      </button>
                    ))}
                  </div>
                  <span className="ms-result">→ {preview.traits[i].points}</span>
                </li>
              ))}
              {preview.traits.slice(picks.length).map((_, i) => (
                <li key={`new${i}`} className="ms-new"><span className="ms-label">{SLOT_LABEL[picks.length + i]}</span><span>New trait, rolled at merge</span><span className="ms-result">→ 0</span></li>
              ))}
            </ul>
          </div>

          <p className="merge-step">3. Merge</p>
          <div className="merge-pay">
            <span>Merge fee <b>{fee === null ? '…' : sui(fee)}</b></span>
            <span>You have <b>{balance === null ? '…' : sui(balance)}</b></span>
          </div>
          {fee !== null && balance !== null && !canAfford(balance, fee) && (
            <p className="merge-short">You need a little more SUI. <a href={FAUCET_URL} target="_blank" rel="noreferrer">Get free testnet SUI</a> for your wallet {snap.address.slice(0, 6)}…{snap.address.slice(-4)}.</p>
          )}
          {error && <p className="error" role="alert">{error}</p>}
          <HoldButton label="Hold to merge" onConfirm={merge} disabled={fee === null || balance === null || !canAfford(balance, fee)} />
          <p className="hint">Both yetis become one Level {preview.level} yeti. This can't be undone.</p>
        </>
      )}
    </section>
  );
}

/** The two yetis spin together into a glowing orb while the merge goes through. */
