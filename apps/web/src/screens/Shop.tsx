import { useState, type ReactNode } from 'react';
import type { Transaction } from '@mysten/sui/transactions';
import { ELEMENT_COLORS, ELEMENT_NAMES } from '@flurry/art';
import { run } from '../lib/api';
import { buildBuyEgg, buildBuyElementEgg, buildBuyExtraPlay, buildBuySnowflakeEgg, buildClaimPartnerEgg } from '../lib/flurry';
import type { Snapshot } from '../lib/progress';
import { useShop } from '../lib/useShop';
import { usePlays } from '../lib/usePlays';
import { partnerCandidate } from '../lib/home';
import { FAUCET_URL, sui } from '../lib/merge';
import { snowflakeEggCopy } from '../lib/history';
import { GAME_INFO } from '../lib/train';
import { EggArt } from '../components/EggArt';
import { YetiArt } from '../components/YetiArt';
import { GameDiagram } from '../components/GameDiagram';
import { ConfirmPurchase } from '../ui/ConfirmPurchase';
import { PageHead } from '../ui/PageHead';
import { Tabs } from '../ui/Tabs';
import { SnowLoader } from '../ui/SnowLoader';
import { Icon } from '../ui/Icon';
import { useToast } from '../ui/Toast';
import { sound } from '../lib/sound';

type Pending = {
  item: string; detail?: string; art?: ReactNode; price: bigint; currency: 'SUI' | 'Snowflakes';
  build(): Transaction; until(s: Snapshot): boolean; done: string;
};
type Tab = 'eggs' | 'plays' | 'merch';
const TABS: { id: Tab; label: string }[] = [{ id: 'eggs', label: 'Eggs' }, { id: 'plays', label: 'Extra plays' }, { id: 'merch', label: 'Merch' }];

/** Real-world merch, not on sale yet: shown so keepers know it's on the way. */
export const MERCH: { kind: 'plush' | 'tee' | 'hoodie'; name: string; blurb: string; img: string; alt: string }[] = [
  { kind: 'plush', name: 'Lofi plushie', blurb: 'Soft, huggable Lofi in a knitted scarf.', img: '/merch/plush.webp', alt: 'Lofi plush toy: white fluffy yeti with a blue face and an orange knitted scarf' },
  { kind: 'tee', name: 'Sky tee', blurb: 'Soft cotton tee with a small Lofi on the chest.', img: '/merch/tee.webp', alt: 'Sky-blue T-shirt with a small Lofi and Flurry Eggs on the left chest' },
  { kind: 'hoodie', name: 'Cream hoodie', blurb: 'Cozy fleece hoodie for the coldest runs.', img: '/merch/hoodie.webp', alt: 'Cream hoodie with a small sleepy Lofi and Flurry Eggs on the chest' },
];


/** The Shop: eggs, extra training plays and merch. Every buy is confirmed first. Receipts live in the profile. */
export function ShopPage({ snap, refresh }: { snap: Snapshot; refresh: (until?: (s: Snapshot) => boolean) => Promise<void> }) {
  const toast = useToast();
  const { shop, balance, partnerClaimed, reload } = useShop(snap);
  const plays = usePlays(snap);
  const [tab, setTab] = useState<Tab>('eggs');
  const [el, setEl] = useState(snap.profile?.element ?? 0);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  if (!snap.profile) return null;
  const profileId = snap.profile.id;
  const flakes = Number(snap.profile.snowflakes);
  const home = snap.profile.element;
  const partner = partnerCandidate(snap.yetis, partnerClaimed);
  const eggsNow = snap.eggs.length;
  const eggArt = (e: number, big = false) => <span className={`shop-egg ${big ? 'is-big' : ''}`} style={{ ['--el' as string]: ELEMENT_COLORS[e] }}><EggArt stage={0} element={e} /></span>;
  const flakeCopy = snowflakeEggCopy(flakes, shop?.snowflakeEggPrice ?? 400);

  async function confirm() {
    if (!pending) return;
    setBusy(true);
    try {
      const r = await run(pending.build(), snap.address);
      if (!r.ok) throw new Error('The purchase did not go through. Nothing was charged; try again.');
      await refresh(pending.until);
      await Promise.all([reload(), plays.reload()]);
      sound.play('chime'); toast(pending.done);
      setPending(null);
    } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  }

  async function claimPartner() {
    if (!partner) return;
    setBusy(true);
    try {
      const r = await run(buildClaimPartnerEgg(profileId, partner.id), snap.address);
      if (!r.ok) throw new Error('That did not go through. Try again.');
      await refresh((s) => s.eggs.length > eggsNow);
      await reload();
      sound.play('chime'); toast('A partner egg is in your nest!');
    } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  }

  const copy = async () => { try { await navigator.clipboard.writeText(snap.address); toast('Address copied'); } catch { /* selectable */ } };
  return (
    <section className="shop-page">
      <PageHead title="Shop" count={balance === null ? '…' : sui(balance)} />

      <div className="wallet-card">
        <span className="wallet-coin" aria-hidden="true">S</span>
        <div className="wallet-main">
          <b className="wallet-label">Your wallet</b>
          <button className="wallet-addr" onClick={copy} aria-label="Copy wallet address">
            {snap.address.slice(0, 8)}…{snap.address.slice(-6)} <Icon name="copy" size={15} />
          </button>
        </div>
        <a className="btn wallet-faucet" href={FAUCET_URL} target="_blank" rel="noreferrer">Get test SUI <Icon name="external" size={16} /></a>
      </div>

      {partner && (
        <div className="partner-banner">
          <YetiArt yeti={partner} />
          <div><b>{partner.name} is ready to merge!</b><small>Claim a free egg so it can have a partner. One per keeper.</small></div>
          <button className="btn warm" disabled={busy} onClick={claimPartner}>Claim free egg</button>
        </div>
      )}

      <Tabs tabs={TABS} value={tab} onChange={setTab} label="Shop sections" idBase="shop" />

      <div className="shop-panel" role="tabpanel" id={`shop-panel-${tab}`} aria-labelledby={`shop-tab-${tab}`}>
        {tab === 'eggs' && (!shop ? <SnowLoader label="Opening the shop…" size="sm" /> : (
          <div className="product-grid">
            <article className="product">
              <div className="product-stage" style={{ ['--el' as string]: ELEMENT_COLORS[home] }}>{eggArt(home, true)}</div>
              <b>{ELEMENT_NAMES[home]} egg</b>
              <small>An egg of your home element, ready to warm.</small>
              <button className="btn warm product-buy" onClick={() => setPending({ item: `${ELEMENT_NAMES[home]} egg`, detail: 'An egg of your home element.', art: eggArt(home), price: shop.eggPrice, currency: 'SUI', build: () => buildBuyEgg(profileId, shop.eggPrice), until: (s) => s.eggs.length > eggsNow, done: 'A new egg is in your nest!' })}>Buy · {sui(shop.eggPrice)}</button>
            </article>
            <article className="product">
              <div className="product-stage" style={{ ['--el' as string]: ELEMENT_COLORS[el] }}>{eggArt(el, true)}</div>
              <b>Choose the element</b>
              <div className="shop-els" role="radiogroup" aria-label="Egg element">
                {ELEMENT_NAMES.map((n, i) => (
                  <button key={n} role="radio" aria-checked={el === i} className={`shop-el ${el === i ? 'is-on' : ''}`} style={{ ['--el' as string]: ELEMENT_COLORS[i] }} onClick={() => setEl(i)}>{n}</button>
                ))}
              </div>
              <button className="btn warm product-buy" onClick={() => setPending({ item: `${ELEMENT_NAMES[el]} egg`, detail: 'You chose its element.', art: eggArt(el), price: shop.elementEggPrice, currency: 'SUI', build: () => buildBuyElementEgg(profileId, el, shop.elementEggPrice), until: (s) => s.eggs.length > eggsNow, done: 'A new egg is in your nest!' })}>Buy · {sui(shop.elementEggPrice)}</button>
            </article>
            <article className="product">
              <div className="product-stage is-flake"><span className="flake-badge" aria-hidden="true"><Icon name="snowflake" size={40} /></span></div>
              <b>Snowflake egg</b>
              <small>Trade {shop.snowflakeEggPrice} Snowflakes for a home-element egg.</small>
              <div className="flake-meter">
                <div className="flake-bar" role="progressbar" aria-label="Snowflakes saved" aria-valuemin={0} aria-valuemax={shop.snowflakeEggPrice} aria-valuenow={Math.min(flakes, shop.snowflakeEggPrice)}>
                  <span style={{ width: `${flakeCopy.pct}%` }} />
                </div>
                <span className="flake-count">{flakes} / {shop.snowflakeEggPrice}</span>
              </div>
              <button className={`btn product-buy ${flakeCopy.ready ? 'warm' : ''}`} disabled={!flakeCopy.ready}
                onClick={() => setPending({ item: 'Snowflake egg', detail: 'An egg of your home element.', art: eggArt(home), price: BigInt(shop.snowflakeEggPrice), currency: 'Snowflakes', build: () => buildBuySnowflakeEgg(profileId), until: (s) => s.eggs.length > eggsNow, done: 'You traded Snowflakes for an egg!' })}>
                {flakeCopy.button}
              </button>
            </article>
          </div>
        ))}

        {tab === 'plays' && (
          <>
            <p className="shop-intro">Out of free plays for today? Buy extra ones. Bought plays are used after the free ones and never expire.</p>
            <div className="product-grid is-plays">
              {[0, 1, 2, 3].map((g) => {
                const l = plays.left[g];
                const info = GAME_INFO[g];
                return (
                  <article key={g} className="product is-play">
                    <div className="product-stage play-stage" style={{ ['--el' as string]: ELEMENT_COLORS[info.element] }}><GameDiagram game={g} /></div>
                    <b>{info.name}</b>
                    <small>{info.blurb}</small>
                    <span className="pr-chips">
                      <span className={`pr-chip ${l.free ? '' : 'is-out'}`}>{l.free} free today</span>
                      {l.credits > 0 && <span className="pr-chip is-bought">{l.credits} bought</span>}
                    </span>
                    <button className="btn warm product-buy" aria-label={`Buy 1 extra ${info.name} play for ${sui(plays.price)}`}
                      onClick={() => setPending({ item: `1 extra ${info.name} play`, detail: 'Used after your free plays. Never expires.', art: <span className="confirm-diagram"><GameDiagram game={g} /></span>, price: plays.price, currency: 'SUI', build: () => buildBuyExtraPlay(profileId, g, plays.price), until: () => true, done: `Extra ${info.name} play added` })}>
                      +1 · {sui(plays.price)}
                    </button>
                  </article>
                );
              })}
            </div>
          </>
        )}

        {tab === 'merch' && (
          <div className="product-grid">
            {MERCH.map((m) => (
              <article key={m.kind} className="product is-merch">
                <div className={`product-stage merch-stage is-${m.kind}`}><img src={m.img} alt={m.alt} width={720} height={720} loading="lazy" decoding="async" /><span className="merch-soon">Soon</span></div>
                <b>{m.name}</b>
                <small>{m.blurb}</small>
                <button className="btn product-buy" disabled aria-label={`${m.name}: coming soon`}>Coming soon</button>
              </article>
            ))}
          </div>
        )}
      </div>

      {pending && (
        <ConfirmPurchase open item={pending.item} detail={pending.detail} art={pending.art} price={pending.price} currency={pending.currency}
          balance={pending.currency === 'SUI' ? balance : BigInt(flakes)} busy={busy} onConfirm={confirm} onClose={() => !busy && setPending(null)} />
      )}
    </section>
  );
}
