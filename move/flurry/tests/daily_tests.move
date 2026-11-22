#[test_only]
module flurry::daily_tests;

use sui::clock;
use sui::test_scenario as ts;
use flurry::config::GameConfig;
use flurry::profile::{Self, Profile};
use flurry::egg::Egg;
use flurry::daily;
use flurry::test_sigs;
use flurry::hatch_tests;

const PLAYER: address = @0xB0B;
const EXPIRES: u64 = 1_800_000_000_000;
const DAY: u64 = 86_400_000;
const D0: u64 = 20_000; // a UTC day index; 20000 % 4 == 0

/// Submits the daily run on `day` with the given nonce (the game is the day's game unless overridden).
fun play(s: &mut ts::Scenario, day: u64, nonce: u64, game: u8) {
    { s.next_tx(PLAYER); let b = ts::ctx_builder(s).set_clock_timestamp(day * DAY + 3_600_000 + nonce * 1_000); s.next_with_context(b); };
    let cfg = s.take_shared<GameConfig>();
    let mut p = s.take_from_sender<Profile>();
    daily::submit(&mut p, &cfg, game, 500, 10, EXPIRES, test_sigs::sig(2, game, nonce), clock::borrow(), s.ctx());
    s.return_to_sender(p); ts::return_shared(cfg);
}

fun g(day: u64): u8 { (day % 4) as u8 }

fun streak(s: &mut ts::Scenario): u8 {
    s.next_tx(PLAYER);
    let p = s.take_from_sender<Profile>();
    let n = profile::streak(&p);
    s.return_to_sender(p);
    n
}

fun eggs(s: &mut ts::Scenario): u64 {
    s.next_tx(PLAYER);
    ts::ids_for_sender<Egg>(s).length()
}

#[test]
fun test_first_day_streak_is_one() {
    let mut s = hatch_tests::setup();
    play(&mut s, D0, 0, g(D0));
    assert!(streak(&mut s) == 1);
    s.end();
}

#[test, expected_failure(abort_code = flurry::daily::EAlreadyToday)]
fun test_same_day_twice_fails() {
    let mut s = hatch_tests::setup();
    play(&mut s, D0, 0, g(D0));
    play(&mut s, D0, 1, g(D0));
    s.end();
}

#[test]
fun test_consecutive_days_increment() {
    let mut s = hatch_tests::setup();
    play(&mut s, D0, 0, g(D0));
    play(&mut s, D0 + 1, 1, g(D0 + 1));
    play(&mut s, D0 + 2, 2, g(D0 + 2));
    assert!(streak(&mut s) == 3);
    s.end();
}

#[test]
fun test_gap_resets_to_one() {
    let mut s = hatch_tests::setup();
    play(&mut s, D0, 0, g(D0));
    play(&mut s, D0 + 1, 1, g(D0 + 1));
    play(&mut s, D0 + 3, 2, g(D0 + 3));
    assert!(streak(&mut s) == 1);
    s.end();
}

#[test]
fun test_seventh_day_mints_egg_and_resets() {
    let mut s = hatch_tests::setup();
    let before = eggs(&mut s);
    let mut i = 0;
    while (i < 7) { play(&mut s, D0 + i, i, g(D0 + i)); i = i + 1; };
    assert!(streak(&mut s) == 0);
    assert!(eggs(&mut s) == before + 1);
    s.end();
}

#[test, expected_failure(abort_code = flurry::daily::EWrongDailyGame)]
fun test_wrong_game_fails() {
    let mut s = hatch_tests::setup();
    play(&mut s, D0, 0, g(D0 + 1));
    s.end();
}
