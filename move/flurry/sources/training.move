/// Clash-of-Clans–style training: spend Snowflakes to raise one trait by a point after a short
/// timer. Training state is a dynamic field on the Yeti (added by upgrade; Yeti's fields are fixed).
#[allow(deprecated_usage)]
module flurry::training;

use sui::clock::Clock;
use sui::dynamic_field as df;
use sui::event;
use flurry::attest;
use flurry::config::{Self, GameConfig};
use flurry::profile::{Self, Profile};
use flurry::yeti::{Self, Yeti};

const ENotEnough: u64 = 50;
const EAtCap: u64 = 51;
const EBusy: u64 = 52;
const ENotReady: u64 = 53;
const ENoTraining: u64 = 54;
const EBadSlot: u64 = 55;
const EBadGame: u64 = 56;
const ENoPlays: u64 = 57;

/// Free training plays per game per UTC day; more need a bought play credit.
const FREE_PLAYS: u8 = 2;
const DAY_MS: u64 = 86_400_000;

const PURPOSE_TRAINING: u8 = 1;
const GAMES: u8 = 4;
/// Testnet-short values: the next point p+1 costs 25×(p+1) Snowflakes and 2×(p+1) minutes.
const COST_PER_POINT: u64 = 25;
const MS_PER_POINT: u64 = 120_000;

public struct TrainingKey has copy, drop, store {}

public struct Training has store, copy, drop {
    slot: u8,
    ready_at_ms: u64,
}

/// Per-profile, per-game play counter (dynamic field on the Profile).
public struct PlaysKey has copy, drop, store { game: u8 }
public struct Plays has store, copy, drop { day: u64, used: u8, credits: u64 }

public struct TrainingStarted has copy, drop { yeti_id: ID, slot: u8, ready_at_ms: u64 }
public struct Trained has copy, drop { yeti_id: ID, slot: u8, points: u8 }

/// A free training run: credits the referee-attested Snowflakes.
public fun earn(
    p: &mut Profile, cfg: &GameConfig, game: u8, score: u32, snowflakes: u64,
    expires_ms: u64, sig: vector<u8>, clock: &Clock,
) {
    config::assert_live(cfg);
    assert!(game < GAMES, EBadGame);
    attest::verify(cfg, p, PURPOSE_TRAINING, game, score, snowflakes, expires_ms, sig, clock);
    use_play(p, game, clock.timestamp_ms() / DAY_MS);
    profile::bump_nonce(p);
    profile::add_snowflakes(p, snowflakes);
}

/// Spends one of today's free plays, or a bought credit once the free ones are gone.
fun use_play(p: &mut Profile, game: u8, day: u64) {
    let key = PlaysKey { game };
    if (!df::exists_(profile::uid(p), key)) df::add(profile::uid_mut(p), key, Plays { day, used: 0, credits: 0 });
    let pl: &mut Plays = df::borrow_mut(profile::uid_mut(p), key);
    if (pl.day != day) { pl.day = day; pl.used = 0; };
    if (pl.used < FREE_PLAYS) pl.used = pl.used + 1
    else { assert!(pl.credits > 0, ENoPlays); pl.credits = pl.credits - 1; }
}

/// One extra play for `game` (bought in the shop). Credits don't expire.
public(package) fun add_play_credit(p: &mut Profile, game: u8, day: u64) {
    assert!(game < GAMES, EBadGame);
    let key = PlaysKey { game };
    if (!df::exists_(profile::uid(p), key)) df::add(profile::uid_mut(p), key, Plays { day, used: 0, credits: 0 });
    let pl: &mut Plays = df::borrow_mut(profile::uid_mut(p), key);
    pl.credits = pl.credits + 1;
}

/// (free plays used on `day`, bought credits left) for a game.
public fun plays(p: &Profile, game: u8, day: u64): (u8, u64) {
    let key = PlaysKey { game };
    if (!df::exists_(profile::uid(p), key)) return (0, 0);
    let pl: &Plays = df::borrow(profile::uid(p), key);
    (if (pl.day == day) pl.used else 0, pl.credits)
}

public fun free_plays(): u8 { FREE_PLAYS }

/// Pays for the next point on `slot` and starts its timer. One training per yeti at a time.
public fun start(y: &mut Yeti, p: &mut Profile, cfg: &GameConfig, slot: u8, clock: &Clock) {
    config::assert_live(cfg);
    assert!(!df::exists_(yeti::uid(y), TrainingKey {}), EBusy);
    let idx = yeti::trait_index(y, slot);
    assert!(idx.is_some(), EBadSlot);
    let points = yeti::trait_points(&yeti::traits(y)[idx.destroy_some()]);
    assert!(points < yeti::trait_cap(y), EAtCap);
    let next = (points as u64) + 1;
    assert!(profile::snowflakes(p) >= COST_PER_POINT * next, ENotEnough);
    profile::spend_snowflakes(p, COST_PER_POINT * next);
    let ready_at_ms = clock.timestamp_ms() + MS_PER_POINT * next;
    df::add(yeti::uid_mut(y), TrainingKey {}, Training { slot, ready_at_ms });
    event::emit(TrainingStarted { yeti_id: object::id(y), slot, ready_at_ms });
}

/// Collects the point once the timer is done.
public fun finish(y: &mut Yeti, clock: &Clock) {
    assert!(df::exists_(yeti::uid(y), TrainingKey {}), ENoTraining);
    let t: Training = *df::borrow(yeti::uid(y), TrainingKey {});
    assert!(clock.timestamp_ms() >= t.ready_at_ms, ENotReady);
    let _: Training = df::remove(yeti::uid_mut(y), TrainingKey {});
    let idx = yeti::trait_index(y, t.slot).destroy_some();
    yeti::add_trait_point(y, idx);
    let points = yeti::trait_points(&yeti::traits(y)[idx]);
    event::emit(Trained { yeti_id: object::id(y), slot: t.slot, points });
}

/// Milliseconds left on the training in progress (0 when none or done).
public fun remaining_ms(y: &Yeti, clock: &Clock): u64 {
    if (!df::exists_(yeti::uid(y), TrainingKey {})) return 0;
    let t: &Training = df::borrow(yeti::uid(y), TrainingKey {});
    if (clock.timestamp_ms() >= t.ready_at_ms) 0 else t.ready_at_ms - clock.timestamp_ms()
}

/// Finishes the training now (used by the paid skip): +1 point on its slot.
public(package) fun force_finish(y: &mut Yeti) {
    assert!(df::exists_(yeti::uid(y), TrainingKey {}), ENoTraining);
    let t: Training = df::remove(yeti::uid_mut(y), TrainingKey {});
    let idx = yeti::trait_index(y, t.slot).destroy_some();
    yeti::add_trait_point(y, idx);
    let points = yeti::trait_points(&yeti::traits(y)[idx]);
    event::emit(Trained { yeti_id: object::id(y), slot: t.slot, points });
}

/// Ready to merge: every trait at its level cap and nothing training (owner's merge rule).
public fun merge_ready(y: &Yeti): bool {
    if (df::exists_(yeti::uid(y), TrainingKey {})) return false;
    let cap = yeti::trait_cap(y);
    let ts = yeti::traits(y);
    let mut i = 0;
    while (i < ts.length()) { if (yeti::trait_points(&ts[i]) < cap) return false; i = i + 1; };
    true
}

/// The training in progress, if any.
public fun status(y: &Yeti): Option<Training> {
    if (!df::exists_(yeti::uid(y), TrainingKey {})) return option::none();
    option::some(*df::borrow(yeti::uid(y), TrainingKey {}))
}

public fun training_slot(t: &Training): u8 { t.slot }
public fun training_ready_at(t: &Training): u64 { t.ready_at_ms }
