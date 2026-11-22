/// The egg shop and other ways to get eggs: buy with SUI (any or a chosen element), trade
/// Snowflakes, or claim a one-time partner egg once a yeti is ready to merge. Also paid training
/// skips. Prices live here (admin-settable); paid SUI collects in the shop's treasury.
#[allow(deprecated_usage)]
module flurry::shop;

use sui::balance::{Self, Balance};
use sui::clock::Clock;
use sui::coin::{Self, Coin};
use sui::dynamic_field as df;
use sui::event;
use sui::sui::SUI;
use flurry::config::AdminCap;
use flurry::egg;
use flurry::profile::{Self, Profile};
use flurry::training;
use flurry::yeti::Yeti;

const EPrice: u64 = 70;
const EBadElement: u64 = 71;
const ENotEnoughFlakes: u64 = 72;
const EPartnerClaimed: u64 = 73;
const ENotReady: u64 = 74;
const ENoTraining: u64 = 75;
const ESplit: u64 = 76;

const BPS: u64 = 10_000;
const DEFAULT_RESERVE_BPS: u64 = 5_000;
const DEFAULT_POT_BPS: u64 = 3_000;

const ELEMENTS: u8 = 4;
const MINUTE_MS: u64 = 60_000;

public struct Shop has key {
    id: UID,
    egg_price: u64,
    element_egg_price: u64,
    snowflake_egg_price: u64,
    merge_fee: u64,
    skip_per_min: u64,
    treasury: Balance<SUI>,
}

public struct PartnerKey has copy, drop, store {}
/// Revenue split (dynamic fields on Shop): every payment feeds the buyback reserve and the
/// Lodge's staker pot; the rest stays in `treasury` for operations.
public struct ReserveKey has copy, drop, store {}
public struct PotKey has copy, drop, store {}
public struct SplitKey has copy, drop, store {}
public struct Split has store, copy, drop { reserve_bps: u64, pot_bps: u64 }
/// Price of one extra training play (dynamic field: Shop's own fields are fixed after publish).
public struct ExtraPlayPriceKey has copy, drop, store {}
const DEFAULT_EXTRA_PLAY: u64 = 20_000_000;
const DAY_MS_SHOP: u64 = 86_400_000;

public struct EggBought has copy, drop { owner: address, element: u8, paid_mist: u64, paid_snowflakes: u64, partner: bool }

/// One-time admin setup: shares the shop with testnet default prices.
public fun create(_: &AdminCap, ctx: &mut TxContext) {
    transfer::share_object(Shop {
        id: object::new(ctx),
        egg_price: 500_000_000,
        element_egg_price: 1_000_000_000,
        snowflake_egg_price: 400,
        merge_fee: 100_000_000,
        skip_per_min: 10_000_000,
        treasury: balance::zero(),
    });
}

public fun set_prices(s: &mut Shop, _: &AdminCap, egg: u64, element_egg: u64, snowflake_egg: u64, merge_fee: u64, skip_per_min: u64) {
    s.egg_price = egg; s.element_egg_price = element_egg; s.snowflake_egg_price = snowflake_egg;
    s.merge_fee = merge_fee; s.skip_per_min = skip_per_min;
}

public fun withdraw(s: &mut Shop, _: &AdminCap, amount: u64, ctx: &mut TxContext): Coin<SUI> {
    coin::take(&mut s.treasury, amount, ctx)
}

/// Takes exactly `price` from `payment`, splits it into reserve / staker pot / ops (treasury),
/// and returns the change to the sender.
public(package) fun take(s: &mut Shop, mut payment: Coin<SUI>, price: u64, ctx: &mut TxContext) {
    assert!(payment.value() >= price, EPrice);
    let mut paid = coin::into_balance(payment.split(price, ctx));
    let (rb, pb) = split_bps(s);
    let to_reserve = paid.split(((price as u128) * (rb as u128) / (BPS as u128)) as u64);
    let to_pot = paid.split(((price as u128) * (pb as u128) / (BPS as u128)) as u64);
    reserve_join(s, to_reserve);
    pot_mut(s).join(to_pot);
    balance::join(&mut s.treasury, paid);
    if (payment.value() > 0) transfer::public_transfer(payment, ctx.sender()) else coin::destroy_zero(payment);
}

public fun split_bps(s: &Shop): (u64, u64) {
    if (!df::exists_(&s.id, SplitKey {})) return (DEFAULT_RESERVE_BPS, DEFAULT_POT_BPS);
    let sp: &Split = df::borrow(&s.id, SplitKey {});
    (sp.reserve_bps, sp.pot_bps)
}

public fun set_split(s: &mut Shop, _: &AdminCap, reserve_bps: u64, pot_bps: u64) {
    assert!(reserve_bps + pot_bps <= BPS, ESplit);
    let v = Split { reserve_bps, pot_bps };
    if (df::exists_(&s.id, SplitKey {})) *df::borrow_mut(&mut s.id, SplitKey {}) = v
    else df::add(&mut s.id, SplitKey {}, v);
}

fun reserve_mut(s: &mut Shop): &mut Balance<SUI> {
    if (!df::exists_(&s.id, ReserveKey {})) df::add(&mut s.id, ReserveKey {}, balance::zero<SUI>());
    df::borrow_mut(&mut s.id, ReserveKey {})
}

fun pot_mut(s: &mut Shop): &mut Balance<SUI> {
    if (!df::exists_(&s.id, PotKey {})) df::add(&mut s.id, PotKey {}, balance::zero<SUI>());
    df::borrow_mut(&mut s.id, PotKey {})
}

public fun reserve_value(s: &Shop): u64 {
    if (df::exists_(&s.id, ReserveKey {})) { let b: &Balance<SUI> = df::borrow(&s.id, ReserveKey {}); b.value() } else 0
}

public fun pot_value(s: &Shop): u64 {
    if (df::exists_(&s.id, PotKey {})) { let b: &Balance<SUI> = df::borrow(&s.id, PotKey {}); b.value() } else 0
}

/// Anyone may top up the buyback reserve (e.g. the owner seeding a launch).
public fun fund_reserve(s: &mut Shop, c: Coin<SUI>) { reserve_mut(s).join(coin::into_balance(c)); }

/// Anyone may top up the Lodge's staker pot.
public fun fund_pot(s: &mut Shop, c: Coin<SUI>) { pot_mut(s).join(coin::into_balance(c)); }

public(package) fun reserve_take(s: &mut Shop, amount: u64, ctx: &mut TxContext): Coin<SUI> {
    coin::take(reserve_mut(s), amount, ctx)
}

public(package) fun reserve_join(s: &mut Shop, b: Balance<SUI>) { reserve_mut(s).join(b); }

public(package) fun pot_take_all(s: &mut Shop): Balance<SUI> { pot_mut(s).withdraw_all() }

/// For sibling modules that keep their settings on the Shop (Shop's own fields are frozen).
public(package) fun uid(s: &Shop): &UID { &s.id }
public(package) fun uid_mut(s: &mut Shop): &mut UID { &mut s.id }

/// An egg of your home element.
public fun buy_egg(s: &mut Shop, p: &Profile, payment: Coin<SUI>, ctx: &mut TxContext) {
    let price = s.egg_price;
    take(s, payment, price, ctx);
    egg::give_new(profile::element(p), ctx.sender(), ctx);
    event::emit(EggBought { owner: ctx.sender(), element: profile::element(p), paid_mist: price, paid_snowflakes: 0, partner: false });
}

/// An egg of the element you choose.
public fun buy_element_egg(s: &mut Shop, _p: &Profile, element: u8, payment: Coin<SUI>, ctx: &mut TxContext) {
    assert!(element < ELEMENTS, EBadElement);
    let price = s.element_egg_price;
    take(s, payment, price, ctx);
    egg::give_new(element, ctx.sender(), ctx);
    event::emit(EggBought { owner: ctx.sender(), element, paid_mist: price, paid_snowflakes: 0, partner: false });
}

/// Trade Snowflakes for an egg of your home element.
public fun buy_egg_snowflakes(s: &Shop, p: &mut Profile, ctx: &mut TxContext) {
    assert!(profile::snowflakes(p) >= s.snowflake_egg_price, ENotEnoughFlakes);
    profile::spend_snowflakes(p, s.snowflake_egg_price);
    egg::give_new(profile::element(p), ctx.sender(), ctx);
    event::emit(EggBought { owner: ctx.sender(), element: profile::element(p), paid_mist: 0, paid_snowflakes: s.snowflake_egg_price, partner: false });
}

/// Once per profile: when a yeti is ready to merge, a free egg so it can have a partner.
public fun claim_partner_egg(p: &mut Profile, y: &Yeti, ctx: &mut TxContext) {
    assert!(!df::exists_(profile::uid(p), PartnerKey {}), EPartnerClaimed);
    assert!(training::merge_ready(y), ENotReady);
    df::add(profile::uid_mut(p), PartnerKey {}, true);
    egg::give_new(profile::element(p), ctx.sender(), ctx);
    event::emit(EggBought { owner: ctx.sender(), element: profile::element(p), paid_mist: 0, paid_snowflakes: 0, partner: true });
}

public fun partner_claimed(p: &Profile): bool { df::exists_(profile::uid(p), PartnerKey {}) }

/// Finish a training now, paying per started minute left.
public fun skip_training(y: &mut Yeti, s: &mut Shop, payment: Coin<SUI>, clock: &Clock, ctx: &mut TxContext) {
    assert!(training::status(y).is_some(), ENoTraining);
    let left = training::remaining_ms(y, clock);
    let price = ((left + MINUTE_MS - 1) / MINUTE_MS) * s.skip_per_min;
    take(s, payment, price, ctx);
    training::force_finish(y);
}

/// Buy one extra training play for a game (after today's two free ones).
public fun buy_extra_play(s: &mut Shop, p: &mut Profile, game: u8, payment: Coin<SUI>, ctx: &mut TxContext) {
    let price = extra_play_price(s);
    take(s, payment, price, ctx);
    training::add_play_credit(p, game, ctx.epoch_timestamp_ms() / DAY_MS_SHOP);
}

public fun extra_play_price(s: &Shop): u64 {
    if (df::exists_(&s.id, ExtraPlayPriceKey {})) *df::borrow(&s.id, ExtraPlayPriceKey {}) else DEFAULT_EXTRA_PLAY
}

public fun set_extra_play_price(s: &mut Shop, _: &AdminCap, price: u64) {
    if (df::exists_(&s.id, ExtraPlayPriceKey {})) *df::borrow_mut(&mut s.id, ExtraPlayPriceKey {}) = price
    else df::add(&mut s.id, ExtraPlayPriceKey {}, price);
}

public fun egg_price(s: &Shop): u64 { s.egg_price }
public fun element_egg_price(s: &Shop): u64 { s.element_egg_price }
public fun snowflake_egg_price(s: &Shop): u64 { s.snowflake_egg_price }
public fun merge_fee(s: &Shop): u64 { s.merge_fee }
public fun skip_per_min(s: &Shop): u64 { s.skip_per_min }
public fun treasury_value(s: &Shop): u64 { s.treasury.value() }
