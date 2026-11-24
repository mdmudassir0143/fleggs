import { useEffect, useState } from 'react';
import { useDAppKit } from '@mysten/dapp-kit-react';
import type { Transaction } from '@mysten/sui/transactions';
import { claimableFor, estimateShare, stakePending, treasuryPrice, type ListingInfo } from '@flurry/shared';
import { run } from '../lib/api';
import { buildBuyListing, buildClaimAll, buildDelist, buildList, buildRequestUnstake, buildSellToTreasury, buildSetPrice, buildStake, yetiFromContent, type Yeti } from '../lib/flurry';
import type { Snapshot } from '../lib/progress';
import { fetchEarnState, useEarn } from '../lib/useEarn';
import { useShop } from '../lib/useShop';
import { marketView, parseSui, repriceSummary, unstakeState } from '../lib/earn';
import { sui } from '../lib/merge';
import { formatDuration } from '../lib/train';
import { CashIn } from '../components/CashIn';
import { YetiArt } from '../components/YetiArt';
import { PageHead } from '../ui/PageHead';
import { Tabs } from '../ui/Tabs';
import { InfoTip } from '../ui/InfoTip';
import { SnowLoader } from '../ui/SnowLoader';
import { ConfirmAction } from '../ui/ConfirmAction';
import { ConfirmPurchase } from '../ui/ConfirmPurchase';
import { Icon } from '../ui/Icon';
import { useToast } from '../ui/Toast';
import { sound } from '../lib/sound';

type Tab = 'sell' | 'list' | 'stake';

/** Earn: your claim + the stakers' pool on top, then one tab per way to cash in a yeti:
 *  Sell now (treasury prices), List (your listings + the market), Stake (the Lodge). */
export function Earn({ snap, refresh }: { snap: Snapshot; refresh: (until?: (s: Snapshot) => boolean) => Promise<void> }) {
  const toast = useToast();
  const dAppKit = useDAppKit();
  const earn = useEarn(snap.address);
  const { balance, reload: reloadShop } = useShop(snap);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>('sell');
  const [now, setNow] = useState(Date.now());
  const [market, setMarket] = useState<(ListingInfo & { yeti: Yeti })[]>([]);
  const [level, setLevel] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [buying, setBuying] = useState<(ListingInfo & { yeti: Yeti }) | null>(null);
  const [unstaking, setUnstaking] = useState<Yeti | null>(null);
  const [repricing, setRepricing] = useState<{ id: string; text: string } | null>(null);
  const [repriceAsk, setRepriceAsk] = useState<{ yeti: Yeti; old: bigint; price: bigint } | null>(null);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(t); }, []);

  const me = snap.address.toLowerCase();
  const held = earn.mine;
  // Other players' listings, cheapest first (optionally one level); fetch yetis only for what's on screen.
  const view = marketView(earn.state?.listings ?? [], me, level);
  const shown = showAll ? view.items : view.items.slice(0, 12);
  const shownKey = shown.map((l) => `${l.id}:${l.price}`).join(',');
  useEffect(() => {
    if (!shown.length) { setMarket([]); return; }
    const client = dAppKit.getClient('testnet') as never as { core: { getObjects(a: unknown): Promise<{ objects: ({ content?: Uint8Array } | Error)[] }> } };
    (async () => {
      const out: (ListingInfo & { yeti: Yeti })[] = [];
      for (let i = 0; i < shown.length; i += 50) {
        const part = shown.slice(i, i + 50);
        const { objects } = await client.core.getObjects({ objectIds: part.map((l) => l.id), include: { content: true } });
        part.forEach((l, k) => { const o = objects[k]; if (o && !(o instanceof Error) && o.content) out.push({ ...l, yeti: yetiFromContent(l.id, o.content) }); });
      }
      setMarket(out);
    })().catch(() => setMarket([]));
  }, [shownKey, dAppKit]); // eslint-disable-line react-hooks/exhaustive-deps

  async function act(tx: Transaction, done: string, until?: (s: Snapshot) => boolean) {
    setBusy(true);
    try {
      const r = await run(tx, snap.address);
      if (!r.ok) throw new Error('That did not go through. Nothing changed; try again.');
      await fetchEarnState(true).catch(() => null); // refresh the shared snapshot for everyone
      await refresh(until);
      await Promise.all([earn.reload(true), reloadShop()]);
      sound.play('chime'); toast(done);
    } catch (e) { toast((e as Error).message); void earn.reload(true); } finally { setBusy(false); }
  }

  if (earn.loading) return <section className="earn"><PageHead title="Earn" /><SnowLoader label="Counting the treasury…" size="sm" className="earn-loading" /></section>;
  if (!earn.state) {
    return <section className="earn"><PageHead title="Earn" /><div className="history-empty"><p>{earn.error}</p><button className="btn" onClick={() => void earn.reload(true)}>Try again</button></div></section>;
  }
  const { treasury: t, lodge, weekPot, claimedWeek, listings, sales } = earn.state;
  const waiting = lodge.rewards + t.pot;
  const myWeight = earn.myStakes.reduce((a, x) => a + x.weight, 0);
  const incoming = estimateShare(myWeight, lodge.totalWeight, t.pot); // your share of the pot not shared out yet
  const pendingOf = (id: string) => { const st = earn.myStakes.find((x) => x.id === id); return st ? stakePending(st, lodge.acc) : 0n; };
  const c = claimableFor(earn.myStakes, lodge.acc, earn.account, now, lodge.unstakeMs);
  const staked = held.filter((h) => h.where !== 'listed');
  const listed = held.filter((h) => h.where === 'listed');
  const capBinds = [2, 3, 4, 5].some((l) => treasuryPrice(t, l) < (t.prices[l] ?? 0n));
  const inMs = (ms: number) => formatDuration(Math.max(0, ms - now));
  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'sell', label: 'Sell now' }, { id: 'list', label: 'List', badge: listed.length }, { id: 'stake', label: 'Stake', badge: staked.length },
  ];
  const intro: Record<Tab, string> = {
    sell: 'Instant SUI from the treasury. The yeti is burned.',
    list: 'Set your own price. You get 97% when another keeper buys it.',
    stake: 'Keep your yeti and earn a share of every shop sale.',
  };


  return (
    <section className="earn">
      <PageHead title="Earn" count={<><Icon name="snowflake" size={15} /> Reserve {sui(t.reserve)}</>} />

      <section className="earn-bar" aria-label="Your earnings and the stakers' pool">
        <div className="eb-mine">
          <span className="eb-label">You can claim</span>
          <b className="eb-value">{sui(c.now)}</b>
          <span className="eb-sub">{
            !earn.myStakes.length ? (lodge.totalWeight === 0 && waiting > 0n ? `Be the first staker and get the ${sui(waiting)} waiting` : 'Stake a yeti to earn from every shop sale')
              : c.locked > 0n ? `+${sui(c.locked)} unlocks in ${inMs(c.unlocksAt)}`
              : incoming > 0n ? `+${sui(incoming)} coming at the next share-out`
              : c.now > 0n && c.nextClaimAt > now ? `Next claim in ${inMs(c.nextClaimAt)}` : 'One claim a day'
          }</span>
          {c.canClaim && <button className="btn warm eb-btn" disabled={busy} onClick={() => act(buildClaimAll(earn.myStakes.filter((x) => x.weight > 0).map((x) => x.id)), `Claimed ${sui(c.now)}`, () => true)}>Claim</button>}
        </div>
        <div className="eb-pool">
          <div className="eb-pool-head"><span className="eb-label">Stakers' pool · 7 days</span>
            <InfoTip label="How the pool works" align="end">{Math.round(t.split[1] / 100)}% of every shop sale fills this pool. It's shared among staked yetis by level, every few minutes. Staked yetis lock for 24 h.</InfoTip>
          </div>
          <dl className="eb-stats">
            <div><dt>Paid in</dt><dd>{sui(weekPot)}</dd></div>
            <div><dt>Claimed</dt><dd>{sui(claimedWeek)}</dd></div>
            <div><dt>Not claimed yet</dt><dd>{sui(waiting)}</dd></div>
            <div><dt>Staked now</dt><dd>{lodge.count}</dd></div>
          </dl>
        </div>
      </section>

      <Tabs tabs={tabs} value={tab} onChange={setTab} label="Ways to cash in a yeti" idBase="earn" />

      <div className="earn-panel" role="tabpanel" id={`earn-panel-${tab}`} aria-labelledby={`earn-tab-${tab}`}>
        <p className="earn-intro">{intro[tab]}</p>
        <CashIn yetis={snap.yetis} treasury={t} lodge={lodge} pot={weekPot} listings={listings} sales={sales} busy={busy} mode={tab}
          onSell={(y, price) => act(buildSellToTreasury(y.id, price), `Sold ${y.name} for ${sui(price)}`, (s) => !s.yetis.some((x) => x.id === y.id))}
          onList={(y, price) => act(buildList(y.id, price), `${y.name} is listed for ${sui(price)}`, (s) => !!s.held?.some((h) => h.yeti.id === y.id))}
          onStake={(y) => act(buildStake(y.id), `${y.name} is staked in the Lodge`, (s) => !!s.held?.some((h) => h.yeti.id === y.id))} />

        {tab === 'sell' && (
          <>
            <h3 className="keeper-label earn-h">Treasury prices</h3>
            <div className="tp-strip">
              {[2, 3, 4, 5].map((l) => <div key={l}><small>L{l}</small><b>{sui(treasuryPrice(t, l))}</b></div>)}
              {capBinds && <p className="tp-note">Capped at {t.capBps / 100}% of the reserve ({sui(t.reserve)}) per sale until it grows.</p>}
            </div>
          </>
        )}

        {tab === 'list' && (
          <>
            <h3 className="keeper-label earn-h">Your listings</h3>
            {listed.length === 0 ? <p className="earn-empty">Nothing listed. Pick one above to sell it at your price.</p> : (
              <ul className="earn-rows">
                {listed.map((h) => (
                  <li key={h.yeti.id} className="er-row">
                    <span className="er-art"><YetiArt yeti={h.yeti} /></span>
                    <span className="er-text"><b>{h.yeti.name}</b><small>Level {h.yeti.level} · listed</small></span>
                    <span className="er-amt">{sui(h.price ?? 0n)}</span>
                    <div className="er-actions">
                      {repricing?.id === h.yeti.id ? (
                        <>
                          <label className="er-price"><span className="sr-only">New price in SUI</span>
                            <input inputMode="decimal" autoFocus value={repricing.text} onChange={(e) => setRepricing({ id: h.yeti.id, text: e.target.value })} aria-label="New price in SUI" /><span>SUI</span>
                          </label>
                          <button className="btn warm er-btn" disabled={busy || !parseSui(repricing.text)} onClick={() => setRepriceAsk({ yeti: h.yeti, old: h.price ?? 0n, price: parseSui(repricing.text)! })}>Save</button>
                          <button className="btn ghost er-btn" disabled={busy} onClick={() => setRepricing(null)}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <button className="btn er-btn" disabled={busy} onClick={() => setRepricing({ id: h.yeti.id, text: (Number(h.price ?? 0n) / 1e9).toString() })}><Icon name="pencil" size={16} /> Change price</button>
                          <button className="btn ghost er-btn" disabled={busy} onClick={() => act(buildDelist(h.yeti.id), `${h.yeti.name} is back in your yetis`, (s2) => s2.yetis.some((x) => x.id === h.yeti.id))}>Take back</button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}


            <h3 className="keeper-label earn-h">Market</h3>
            <div className="market-filter" role="radiogroup" aria-label="Filter the market by level">
              {[null, 2, 3, 4, 5].map((lv) => (
                <button key={String(lv)} role="radio" aria-checked={level === lv} className={`mf-chip ${level === lv ? 'is-on' : ''}`} onClick={() => { setLevel(lv); setShowAll(false); }}>
                  {lv === null ? `All · ${marketView(earn.state?.listings ?? [], me, null).items.length}` : `L${lv}${view.floors[lv] !== undefined ? ` · from ${sui(view.floors[lv])}` : ''}`}
                </button>
              ))}
            </div>
            {market.length === 0 ? <p className="earn-empty">{level === null ? 'No yetis for sale right now. Check back soon, or list one of yours.' : `No Level ${level} yetis for sale right now.`}</p> : (
              <div className="market-grid">
                {market.map((l) => (
                  <article key={l.id} className="market-card">
                    <span className="mc-art"><YetiArt yeti={l.yeti} /></span>
                    <b>{l.yeti.name}</b><small>Level {l.level}</small>
                    <button className="btn warm mc-buy" disabled={busy} onClick={() => setBuying(l)}>Buy · {sui(l.price)}</button>
                  </article>
                ))}
              </div>
            )}
            {!showAll && view.items.length > shown.length && <button className="btn history-more" onClick={() => setShowAll(true)}>Show all {view.items.length}</button>}
          </>
        )}

        {tab === 'stake' && (
          <>
            <h3 className="keeper-label earn-h">The Lodge</h3>
            {staked.length === 0 ? <p className="earn-empty">No yetis staked yet. Pick one above to earn from every shop sale.</p> : (
              <ul className="earn-rows">
                {staked.map((h) => {
                  const u = unstakeState(h.unlockMs ?? 0, now);
                  return (
                    <li key={h.yeti.id} className="er-row">
                      <span className="er-art"><YetiArt yeti={h.yeti} /></span>
                      <span className="er-text"><b>{h.yeti.name}</b><small>Level {h.yeti.level} · weight ×{h.weight}</small></span>
                      <span className="er-amt">{sui(pendingOf(h.yeti.id))}<small>earned</small></span>
                      <div className="er-actions"><button className={`btn er-btn ${u.locked ? 'is-locked' : ''}`} disabled={busy || u.locked} onClick={() => setUnstaking(h.yeti)}
                        aria-label={u.locked ? `${h.yeti.name} is locked. ${u.label.replace('Locked · ', '')} left before you can unstake` : `Unstake ${h.yeti.name}`}>{u.label}</button></div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>

      {buying && (
        <ConfirmPurchase open item={`${buying.yeti.name}, Level ${buying.level}`} detail="From another player. It joins your yetis right away."
          art={<span className="confirm-yeti"><YetiArt yeti={buying.yeti} /></span>} price={buying.price} currency="SUI" balance={balance} busy={busy}
          onConfirm={async () => { const b = buying; await act(buildBuyListing(b.id, b.price), `${b.yeti.name} joined your yetis`, (s) => s.yetis.some((x) => x.id === b.id)); setBuying(null); }}
          onClose={() => !busy && setBuying(null)} />
      )}
      {repriceAsk && (() => {
        const r = repriceSummary(repriceAsk.old, repriceAsk.price, 300, treasuryPrice(t, repriceAsk.yeti.level));
        return (
          <ConfirmAction open busy={busy} title={`New price for ${repriceAsk.yeti.name}?`} art={<span className="confirm-yeti"><YetiArt yeti={repriceAsk.yeti} /></span>}
            rows={r.rows} note={r.warning ?? 'Anyone can buy it at the new price right away.'} confirm={`Set ${sui(repriceAsk.price)}`}
            onConfirm={async () => { const a = repriceAsk; await act(buildSetPrice(a.yeti.id, a.price), `Price set to ${sui(a.price)}`, () => true); setRepriceAsk(null); setRepricing(null); }}
            onClose={() => !busy && setRepriceAsk(null)} />
        );
      })()}
      {unstaking && (
        <ConfirmAction open busy={busy} title={`Unstake ${unstaking.name}?`} art={<span className="confirm-yeti"><YetiArt yeti={unstaking} /></span>}
          rows={[['Rewards so far', sui(pendingOf(unstaking.id))], ['Kept for your next claim', sui(pendingOf(unstaking.id))]]}
          note={`${unstaking.name} comes back right away and stops earning. Its rewards wait for your next claim.`} confirm="Unstake"
          onConfirm={async () => { const y = unstaking; await act(buildRequestUnstake(y.id), `${y.name} is back in your yetis`, (s2) => s2.yetis.some((x) => x.id === y.id)); setUnstaking(null); }}
          onClose={() => !busy && setUnstaking(null)} />
      )}
    </section>
  );
}
