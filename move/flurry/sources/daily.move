/// The daily run: one rotating game per UTC day. Playing on consecutive days builds a streak;
/// the 7th day in a row gives a free egg and the streak starts again.
module flurry::daily;

use sui::clock::Clock;
use sui::event;
use flurry::attest;
use flurry::config::{Self, GameConfig};
use flurry::egg;
use flurry::profile::{Self, Profile};

const EAlreadyToday: u64 = 60;
const EWrongDailyGame: u64 = 61;

const PURPOSE_DAILY: u8 = 2;
const DAY_MS: u64 = 86_400_000;
const GAMES: u64 = 4;
const STREAK_FOR_EGG: u8 = 7;

public struct DailyDone has copy, drop { profile_id: ID, day: u64, streak: u8 }
public struct StreakEgg has copy, drop { profile_id: ID, owner: address }

/// Today's game: UTC day index mod 4.
public fun game_for_day(day: u64): u8 { (day % GAMES) as u8 }

public fun submit(
    p: &mut Profile, cfg: &GameConfig, game: u8, score: u32, snowflakes: u64,
    expires_ms: u64, sig: vector<u8>, clock: &Clock, ctx: &mut TxContext,
) {
    config::assert_live(cfg);
    let day = clock.timestamp_ms() / DAY_MS;
    assert!(game == game_for_day(day), EWrongDailyGame);
    let last = profile::last_daily_day(p);
    assert!(day != last, EAlreadyToday);
    attest::verify(cfg, p, PURPOSE_DAILY, game, score, snowflakes, expires_ms, sig, clock);
    profile::bump_nonce(p);
    profile::add_snowflakes(p, snowflakes);
    let prev = profile::streak(p);
    let streak = if (prev > 0 && last + 1 == day) prev + 1 else 1;
    event::emit(DailyDone { profile_id: object::id(p), day, streak });
    if (streak >= STREAK_FOR_EGG) {
        profile::set_streak(p, 0, day);
        egg::give_new(profile::element(p), ctx.sender(), ctx);
        event::emit(StreakEgg { profile_id: object::id(p), owner: ctx.sender() });
    } else {
        profile::set_streak(p, streak, day);
    }
}
