import { useState } from 'react';
import { ELEMENT_COLORS } from '@flurry/art';
import type { ListingInfo, LodgeState, Treasury } from '@flurry/shared';
import type { Yeti } from '../lib/flurry';
import { cashInOptions, listSuggestions, parseSui, type Sale } from '../lib/earn';
import { sui } from '../lib/merge';
import { YetiArt } from './YetiArt';
import { ConfirmAction } from '../ui/ConfirmAction';
import { Icon } from '../ui/Icon';

const ROYALTY_BPS = 300n;
type Pending = { kind: 'sell' | 'list' | 'stake'; yeti: Yeti; price?: bigint };

/** Pick one of your yetis, then sell it now, list it at your price, or stake it in the Lodge. With `mode`, only that one way is shown. */
export function CashIn({ yetis, treasury, lodge, pot, listings, sales, busy, mode, onSell, onList, onStake }: {
  yetis: Yeti[]; mode?: 'sell' | 'list' | 'stake'; treasury: Treasury; lodge: LodgeState; pot: bigint; listings: ListingInfo[]; sales: Sale[]; busy?: boolean;
  onSell(y: Yeti, price: bigint): void | Promise<void>; onList(y: Yeti, price: bigint): void | Promise<void>; onStake(y: Yeti): void | Promise<void>;
}) {
  const [pickId, setPickId] = useState<string | null>(() => (mode ? yetis.find((x) => x.level >= 2 && !x.training)?.id ?? null : null));
  const [priceText, setPriceText] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const y = yetis.find((x) => x.id === pickId) ?? null;
  const opts = y ? cashInOptions(y, treasury, lodge, pot) : null;
  const sug = y && opts ? listSuggestions(y.level, opts.sellNow, listings, sales) : null;
  const listPrice = parseSui(priceText);
  const youGet = (p: bigint) => p - (p * ROYALTY_BPS) / 10_000n;
  const trainingNow = !!y?.training;
  const verb = mode === 'sell' ? 'sell' : mode === 'list' ? 'list' : mode === 'stake' ? 'stake' : 'cash in';
  const fill = (v: bigint | null) => { if (v) setPriceText((Number(v) / 1e9).toString()); };

  async function confirm() {
    if (!pending) return;
    if (pending.kind === 'sell') await onSell(pending.yeti, pending.price!);
    if (pending.kind === 'list') await onList(pending.yeti, pending.price!);
    if (pending.kind === 'stake') await onStake(pending.yeti);
    setPending(null); setPickId(null); setPriceText('');
  }

  if (!yetis.length) {
    return <div className="cash-empty"><p><b>No yetis in your wallet.</b> Hatch or buy an egg to get one.</p></div>;
  }

  return (
    <div className="cash-in">
      <div className="cash-pick" role="radiogroup" aria-label={`Choose a yeti to ${verb}`}>
        {yetis.map((x) => {
          const p = cashInOptions(x, treasury, lodge, pot).sellNow;
          return (
            <button key={x.id} role="radio" aria-checked={x.id === pickId} className={`cash-yeti ${x.id === pickId ? 'is-on' : ''}`}
              style={{ ['--el' as string]: ELEMENT_COLORS[x.elements[0] ?? 0] }} onClick={() => { setPickId(x.id); setPriceText(''); }}>
              <span className="cy-art" aria-hidden="true"><YetiArt yeti={x} /></span>
              <span className="cy-text"><b>{x.name}</b><small>L{x.level}{x.level >= 2 ? ` · ${sui(p)}` : ''}</small></span>
            </button>
          );
        })}
      </div>

      {!y && <p className="cash-note is-soft">{yetis.some((x) => x.level >= 2 && !x.training)
        ? "Pick a yeti above to see what you'd get."
        : <>None of your yetis can be cashed in yet. Merge one up to <b>Level 2+</b> first.</>}</p>}

      {y && opts && sug && (y.level < 2 ? (
        <p className="cash-note">{y.name} is Level {y.level}. Merge it up to <b>Level 2+</b> to sell, list or stake it.</p>
      ) : trainingNow ? (
        <p className="cash-note">{y.name} is training. Finish its training first.</p>
      ) : (
        <div className={`cash-options ${mode ? 'is-single' : ''}`}>
          {(!mode || mode === 'sell') && <article className="cash-card is-sell">
            <h4><Icon name="snowflake" size={18} /> Sell now</h4>
            <p className="cash-big">{sui(opts.sellNow)}</p>
            <p className="cash-sub">Paid instantly by the treasury. {y.name} is burned.</p>
            <button className="btn warm cash-btn" disabled={busy || opts.sellNow === 0n} onClick={() => setPending({ kind: 'sell', yeti: y, price: opts.sellNow })}>
              Sell for {sui(opts.sellNow)}
            </button>
          </article>}

          {(!mode || mode === 'list') && <article className="cash-card is-list">
            <h4><Icon name="shop" size={18} /> List</h4>
            <label className="cash-price">
              <span className="sr-only">Your price in SUI</span>
              <input inputMode="decimal" placeholder="0.00" value={priceText} onChange={(e) => setPriceText(e.target.value)} aria-label="Your price in SUI" />
              <span>SUI</span>
            </label>
            <div className="cash-hints">
              <button type="button" className="cash-hint" onClick={() => fill(sug.treasury)}>Treasury {sui(sug.treasury)}</button>
              {sug.floor !== null && <button type="button" className="cash-hint" onClick={() => fill(sug.floor)}>Floor {sui(sug.floor)}</button>}
              {sug.last !== null && <button type="button" className="cash-hint" onClick={() => fill(sug.last)}>Last {sui(sug.last)}</button>}
            </div>
            <p className="cash-sub">{listPrice ? `You get ${sui(youGet(listPrice))} when it sells (3% fee).` : 'Set your price. You get 97% when it sells.'}</p>
            <button className="btn cash-btn" disabled={busy || !listPrice} onClick={() => listPrice && setPending({ kind: 'list', yeti: y, price: listPrice })}>
              {listPrice ? `List for ${sui(listPrice)}` : 'Enter a price'}
            </button>
          </article>}

          {(!mode || mode === 'stake') && <article className="cash-card is-stake">
            <h4><Icon name="den" size={18} /> Stake</h4>
            <p className="cash-big">×{opts.stakeWeight}</p>
            <p className="cash-sub">{opts.firstStaker ? `Nobody is staked yet: you'd get the waiting ${sui(opts.weeklyEstimate)}.` : `≈ ${sui(opts.weeklyEstimate)} a week at this week's rate.`} Locked for 24 h, then unstake any time.</p>
            <button className="btn cash-btn" disabled={busy} onClick={() => setPending({ kind: 'stake', yeti: y })}>Stake in the Lodge</button>
          </article>}
        </div>
      ))}

      {pending && (
        <ConfirmAction open busy={busy}
          title={pending.kind === 'sell' ? `Sell ${pending.yeti.name}?` : pending.kind === 'list' ? `List ${pending.yeti.name}?` : `Stake ${pending.yeti.name}?`}
          art={<span className="confirm-yeti"><YetiArt yeti={pending.yeti} /></span>}
          rows={pending.kind === 'sell'
            ? [['Level', `${pending.yeti.level}`], ['Treasury pays', sui(pending.price!)], ['You get', sui(pending.price!)]]
            : pending.kind === 'list'
              ? [['Price', sui(pending.price!)], ['Fee (3%)', sui(pending.price! - youGet(pending.price!))], ['You get when it sells', sui(youGet(pending.price!))]]
              : [['Weight', `×${opts?.stakeWeight ?? 0}`], [opts?.firstStaker ? 'Waiting pot you get' : 'About, per week', sui(opts?.weeklyEstimate ?? 0n)], ['Locked for', '24 hours']]}
          note={pending.kind === 'sell' ? `${pending.yeti.name} is burned and gone for good.` : pending.kind === 'list' ? 'You can change the price or take it back any time before it sells.' : 'It stays yours, but it can’t be unstaked, merged or trained for the first 24 hours.'}
          confirm={pending.kind === 'sell' ? `Sell for ${sui(pending.price!)}` : pending.kind === 'list' ? 'List it' : 'Stake it'}
          onConfirm={confirm} onClose={() => !busy && setPending(null)} />
      )}
    </div>
  );
}
