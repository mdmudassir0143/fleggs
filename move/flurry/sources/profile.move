/// A player's non-transferable profile: home element, Snowflakes, streak and attestation nonce.
module flurry::profile;

use flurry::config::{Self, GameConfig, Registry};

const EBadElement: u64 = 1;
const EAlreadyRegistered: u64 = 2;
const ELEMENT_COUNT: u8 = 4;

public struct Profile has key {
    id: UID,
    element: u8,
    snowflakes: u64,
    streak: u8,
    last_daily_day: u64,
    nonce: u64,
}

/// Creates and keeps the caller's profile. Called by `onboard::create_profile`, which also gives the free egg.
public(package) fun create(reg: &mut Registry, cfg: &GameConfig, element: u8, ctx: &mut TxContext) {
    config::assert_live(cfg);
    assert!(element < ELEMENT_COUNT, EBadElement);
    let profile = Profile { id: object::new(ctx), element, snowflakes: 0, streak: 0, last_daily_day: 0, nonce: 0 };
    assert!(config::register(reg, ctx.sender(), object::id(&profile)), EAlreadyRegistered);
    transfer::transfer(profile, ctx.sender());
}

public fun element(p: &Profile): u8 { p.element }
public fun nonce(p: &Profile): u64 { p.nonce }
public fun snowflakes(p: &Profile): u64 { p.snowflakes }
public fun streak(p: &Profile): u8 { p.streak }
public fun last_daily_day(p: &Profile): u64 { p.last_daily_day }

public(package) fun uid(p: &Profile): &UID { &p.id }
public(package) fun uid_mut(p: &mut Profile): &mut UID { &mut p.id }

public(package) fun bump_nonce(p: &mut Profile) { p.nonce = p.nonce + 1; }
public(package) fun add_snowflakes(p: &mut Profile, n: u64) { p.snowflakes = p.snowflakes + n; }

const ENotEnoughSnowflakes: u64 = 4;
public(package) fun spend_snowflakes(p: &mut Profile, n: u64) {
    assert!(p.snowflakes >= n, ENotEnoughSnowflakes);
    p.snowflakes = p.snowflakes - n;
}
#[test_only]
public fun add_snowflakes_for_testing(p: &mut Profile, n: u64) { p.snowflakes = p.snowflakes + n; }

public(package) fun set_streak(p: &mut Profile, streak: u8, day: u64) { p.streak = streak; p.last_daily_day = day; }
