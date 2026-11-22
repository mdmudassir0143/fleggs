/// The Lodge: stake a yeti (Level 2+) to earn a share of shop revenue. The staker pot on the
/// Shop is moved in by `sync` (anyone may call it; every Lodge action calls it first; the Worker
/// calls it hourly) and shared by weight through a reward-per-weight accumulator. Unstaking stops
/// earning at once; the yeti comes back after `unstake_ms`.
#[allow(lint(self_transfer), deprecated_usage)]
module flurry::lodge;

use sui::balance::{Self, Balance};
use sui::clock::Clock;
use sui::coin;
use sui::dynamic_field as df;
use sui::dynamic_object_field as dof;
use sui::event;
use sui::sui::SUI;
use flurry::config::AdminCap;
use flurry::shop::{Self, Shop};
use flurry::training;
use flurry::yeti::{Self, Yeti};

const ELevel: u64 = 120;
const ETraining: u64 = 121;
const ENotOwner: u64 = 122;
const ETooSoon: u64 = 123;
const ENoStake: u64 = 124;
const EBadParams: u64 = 125;
const EUseClaimAll: u64 = 126;
const EClaimCooldown: u64 = 127;
const ENothingToClaim: u64 = 128;
const ELocked: u64 = 129;

const ACC_SCALE: u128 = 1_000_000_000_000_000_000;

public struct Lodge has key {
    id: UID,
    total_weight: u64,
    acc: u128,
    rewards: Balance<SUI>,
    /// Pot that arrived while nobody was staked; shared out at the next sync with stakers.
    carry: u64,
    weights: vector<u64>,
    unstake_ms: u64,
    count: u64,
}

public struct StakeKey has copy, drop, store { id: ID }
public struct ItemKey has copy, drop, store { id: ID }
/// Active stakes: `unlock_ms` is when its rewards become claimable (staked + 24 h).
/// (Stakes from before this rule have `weight == 0` once unstaking.)
public struct Stake has store, copy, drop { owner: address, weight: u64, debt: u128, owed: u64, unlock_ms: u64, level: u8 }

public struct Staked has copy, drop { yeti_id: ID, owner: address, weight: u64 }
public struct UnstakeRequested has copy, drop { yeti_id: ID, owner: address, unlock_ms: u64 }
public struct Withdrawn has copy, drop { yeti_id: ID, owner: address, paid: u64 }
public struct Claimed has copy, drop { yeti_id: ID, owner: address, amount: u64 }
public struct Synced has copy, drop { amount: u64, total_weight: u64 }
public struct ClaimedAll has copy, drop { owner: address, amount: u64 }
public struct Unstaked has copy, drop { yeti_id: ID, owner: address, kept: u64, forfeited: u64 }

/// Per player: rewards kept from unstaked yetis, and when they last claimed (one claim per 24 h).
public struct AccountKey has copy, drop, store { owner: address }
public struct Account has store, copy, drop { owed: u64, last_claim_ms: u64 }
/// Running totals for everyone to see.
public struct TotalsKey has copy, drop, store {}
public struct Totals has store, copy, drop { claimed: u64, forfeited: u64 }

/// One-time admin setup: weights by level (L2 ×1, L3 ×3, L4 ×8, L5 ×20) and a 24 h unstake.
public fun create(_: &AdminCap, ctx: &mut TxContext) {
    transfer::share_object(Lodge {
        id: object::new(ctx), total_weight: 0, acc: 0, rewards: balance::zero(), carry: 0,
        weights: vector[0, 0, 1, 3, 8, 20], unstake_ms: 86_400_000, count: 0,
    });
}

public fun set_params(l: &mut Lodge, _: &AdminCap, weights: vector<u64>, unstake_ms: u64) {
    assert!(weights.length() == 6, EBadParams);
    l.weights = weights; l.unstake_ms = unstake_ms;
}

/// Moves the Shop's staker pot into the Lodge and shares it out by weight.
public fun sync(l: &mut Lodge, s: &mut Shop) {
    let b = shop::pot_take_all(s);
    let amount = b.value();
    l.rewards.join(b);
    let dist = amount + l.carry;
    if (l.total_weight > 0) {
        l.acc = l.acc + (dist as u128) * ACC_SCALE / (l.total_weight as u128);
        l.carry = 0;
    } else l.carry = dist;
    if (amount > 0) event::emit(Synced { amount, total_weight: l.total_weight });
}

fun accrued(l: &Lodge, st: &Stake): u64 {
    (((st.weight as u128) * l.acc - st.debt) / ACC_SCALE) as u64
}

public fun stake(l: &mut Lodge, s: &mut Shop, y: Yeti, clock: &Clock, ctx: &mut TxContext) {
    sync(l, s);
    let level = yeti::level(&y);
    let weight = if ((level as u64) < l.weights.length()) l.weights[level as u64] else 0;
    assert!(weight > 0, ELevel);
    assert!(training::status(&y).is_none(), ETraining);
    let id = object::id(&y);
    df::add(&mut l.id, StakeKey { id }, Stake { owner: ctx.sender(), weight, debt: (weight as u128) * l.acc, owed: 0, unlock_ms: clock.timestamp_ms() + l.unstake_ms, level });
    dof::add(&mut l.id, ItemKey { id }, y);
    l.total_weight = l.total_weight + weight;
    l.count = l.count + 1;
    // pot that waited for a first staker is shared now
    if (l.carry > 0) { let c = l.carry; l.carry = 0; l.acc = l.acc + (c as u128) * ACC_SCALE / (l.total_weight as u128); };
    event::emit(Staked { yeti_id: id, owner: ctx.sender(), weight });
}

/// Unstake: a staked yeti is locked for 24 h. After that it comes straight back, and its rewards are
/// kept for your next claim.
public fun request_unstake(l: &mut Lodge, s: &mut Shop, id: ID, clock: &Clock, ctx: &TxContext) {
    sync(l, s);
    assert!(df::exists_(&l.id, StakeKey { id }), ENoStake);
    let st: Stake = df::remove(&mut l.id, StakeKey { id });
    assert!(st.owner == ctx.sender(), ENotOwner);
    let now = clock.timestamp_ms();
    // active stakes are locked for 24 h (older, already-unstaking stakes can always leave)
    assert!(st.weight == 0 || now >= st.unlock_ms, ELocked);
    let kept = st.owed + ((((st.weight as u128) * l.acc - st.debt) / ACC_SCALE) as u64);
    let forfeited = 0;
    l.total_weight = l.total_weight - st.weight;
    if (kept > 0) { let a = account_mut(l, st.owner); a.owed = a.owed + kept; };
    let y: Yeti = dof::remove(&mut l.id, ItemKey { id });
    l.count = l.count - 1;
    transfer::public_transfer(y, st.owner);
    event::emit(Unstaked { yeti_id: id, owner: st.owner, kept, forfeited });
}

fun account_mut(l: &mut Lodge, owner: address): &mut Account {
    if (!df::exists_(&l.id, AccountKey { owner })) df::add(&mut l.id, AccountKey { owner }, Account { owed: 0, last_claim_ms: 0 });
    df::borrow_mut(&mut l.id, AccountKey { owner })
}

fun totals_mut(l: &mut Lodge): &mut Totals {
    if (!df::exists_(&l.id, TotalsKey {})) df::add(&mut l.id, TotalsKey {}, Totals { claimed: 0, forfeited: 0 });
    df::borrow_mut(&mut l.id, TotalsKey {})
}

/// Claim everything you're owed — kept rewards plus every listed stake that has been staked 24 h —
/// in one go. One claim per player per 24 h, however many yetis are staked.
public fun claim_all(l: &mut Lodge, s: &mut Shop, ids: vector<ID>, clock: &Clock, ctx: &mut TxContext) {
    sync(l, s);
    let now = clock.timestamp_ms();
    let me = ctx.sender();
    let interval = l.unstake_ms;
    let (owed, last) = account_info(l, me);
    assert!(last == 0 || now >= last + interval, EClaimCooldown);
    let mut amount = owed;
    let acc = l.acc;
    let mut i = 0;
    while (i < ids.length()) {
        let id = ids[i];
        assert!(df::exists_(&l.id, StakeKey { id }), ENoStake);
        let st: &mut Stake = df::borrow_mut(&mut l.id, StakeKey { id });
        assert!(st.owner == me, ENotOwner);
        if (st.weight > 0 && now >= st.unlock_ms) {
            amount = amount + st.owed + ((((st.weight as u128) * acc - st.debt) / ACC_SCALE) as u64);
            st.debt = (st.weight as u128) * acc;
            st.owed = 0;
        };
        i = i + 1;
    };
    assert!(amount > 0, ENothingToClaim);
    let a = account_mut(l, me); a.owed = 0; a.last_claim_ms = now;
    let t = totals_mut(l); t.claimed = t.claimed + amount;
    transfer::public_transfer(coin::take(&mut l.rewards, amount, ctx), me);
    event::emit(ClaimedAll { owner: me, amount });
}

/// (rewards kept from unstaked yetis, last claim time) for a player.
public fun account_info(l: &Lodge, owner: address): (u64, u64) {
    if (!df::exists_(&l.id, AccountKey { owner })) return (0, 0);
    let a: &Account = df::borrow(&l.id, AccountKey { owner });
    (a.owed, a.last_claim_ms)
}

/// (all-time claimed, all-time forfeited back to stakers)
public fun totals(l: &Lodge): (u64, u64) {
    if (!df::exists_(&l.id, TotalsKey {})) return (0, 0);
    let t: &Totals = df::borrow(&l.id, TotalsKey {});
    (t.claimed, t.forfeited)
}

public fun withdraw(l: &mut Lodge, id: ID, clock: &Clock, ctx: &mut TxContext) {
    assert!(df::exists_(&l.id, StakeKey { id }), ENoStake);
    let st: Stake = *df::borrow(&l.id, StakeKey { id });
    assert!(st.owner == ctx.sender(), ENotOwner);
    assert!(st.unlock_ms > 0 && clock.timestamp_ms() >= st.unlock_ms, ETooSoon);
    let _: Stake = df::remove(&mut l.id, StakeKey { id });
    let y: Yeti = dof::remove(&mut l.id, ItemKey { id });
    l.count = l.count - 1;
    if (st.owed > 0) transfer::public_transfer(coin::take(&mut l.rewards, st.owed, ctx), st.owner);
    transfer::public_transfer(y, st.owner);
    event::emit(Withdrawn { yeti_id: id, owner: st.owner, paid: st.owed });
}

/// Retired: claims are per player, once per 24 h — use `claim_all`.
public fun claim(_l: &mut Lodge, _s: &mut Shop, _id: ID, _ctx: &mut TxContext) {
    abort EUseClaimAll
}

/// What a stake could claim right now (excluding pot not yet synced).
public fun pending(l: &Lodge, id: ID): u64 {
    let st: &Stake = df::borrow(&l.id, StakeKey { id });
    st.owed + accrued(l, st)
}

/// (owner, weight, unlock_ms)
public fun stake_info(l: &Lodge, id: ID): (address, u64, u64) {
    let st: &Stake = df::borrow(&l.id, StakeKey { id });
    (st.owner, st.weight, st.unlock_ms)
}

public fun total_weight(l: &Lodge): u64 { l.total_weight }
public fun weights(l: &Lodge): vector<u64> { l.weights }
public fun unstake_ms(l: &Lodge): u64 { l.unstake_ms }
public fun rewards_value(l: &Lodge): u64 { l.rewards.value() }
