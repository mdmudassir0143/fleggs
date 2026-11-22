#[test_only]
module flurry::plays_tests;

use sui::clock;
use sui::coin;
use sui::sui::SUI;
use sui::test_scenario as ts;
use flurry::config::{AdminCap, GameConfig};
use flurry::profile::Profile;
use flurry::shop::{Self, Shop};
use flurry::training;
use flurry::test_sigs;
use flurry::hatch_tests;

const PLAYER: address = @0xB0B;
const ADMIN: address = @0x0;
const EXPIRES: u64 = 1_800_000_000_000;
const DAY: u64 = 86_400_000;
const D0: u64 = 19_700; // a UTC day well before the signatures expire

fun world(): ts::Scenario {
    let mut s = hatch_tests::setup();
    s.next_tx(ADMIN);
    let cap = s.take_from_sender<AdminCap>();
    shop::create(&cap, s.ctx());
    s.return_to_sender(cap);
    s
}

/// A training run's Snowflakes on `day` (nonce = how many attested runs this profile has made).
fun earn(s: &mut ts::Scenario, day: u64, game: u8, nonce: u64) {
    { s.next_tx(PLAYER); let b = ts::ctx_builder(s).set_clock_timestamp(day * DAY + 3_600_000 + nonce * 1_000); s.next_with_context(b); };
    let cfg = s.take_shared<GameConfig>();
    let mut p = s.take_from_sender<Profile>();
    training::earn(&mut p, &cfg, game, 500, 10, EXPIRES, test_sigs::sig(1, game, nonce), clock::borrow());
    s.return_to_sender(p); ts::return_shared(cfg);
}

fun buy_play(s: &mut ts::Scenario, game: u8) {
    s.next_tx(PLAYER);
    let mut sh = s.take_shared<Shop>();
    let mut p = s.take_from_sender<Profile>();
    let c = coin::mint_for_testing<SUI>(20_000_000, s.ctx());
    shop::buy_extra_play(&mut sh, &mut p, game, c, s.ctx());
    s.return_to_sender(p); ts::return_shared(sh);
}

#[test]
fun test_two_free_earns_per_game_per_day() {
    let mut s = world();
    earn(&mut s, D0, 1, 0);
    earn(&mut s, D0, 1, 1);
    s.end();
}

#[test, expected_failure(abort_code = flurry::training::ENoPlays)]
fun test_third_earn_without_a_credit_aborts() {
    let mut s = world();
    earn(&mut s, D0, 1, 0);
    earn(&mut s, D0, 1, 1);
    earn(&mut s, D0, 1, 2);
    s.end();
}

#[test]
fun test_a_bought_play_allows_one_more() {
    let mut s = world();
    earn(&mut s, D0, 1, 0);
    earn(&mut s, D0, 1, 1);
    buy_play(&mut s, 1);
    earn(&mut s, D0, 1, 2);
    s.next_tx(PLAYER);
    let sh = s.take_shared<Shop>();
    assert!(shop::treasury_value(&sh) + shop::reserve_value(&sh) + shop::pot_value(&sh) == 20_000_000);
    ts::return_shared(sh);
    s.end();
}

#[test]
fun test_a_new_utc_day_resets_the_free_count() {
    let mut s = world();
    earn(&mut s, D0, 2, 0);
    earn(&mut s, D0, 2, 1);
    earn(&mut s, D0 + 1, 2, 2);
    earn(&mut s, D0 + 1, 2, 3);
    s.end();
}

#[test]
fun test_games_are_counted_separately() {
    let mut s = world();
    earn(&mut s, D0, 1, 0);
    earn(&mut s, D0, 1, 1);
    earn(&mut s, D0, 2, 2);
    earn(&mut s, D0, 3, 3);
    s.end();
}

#[test]
fun test_plays_reader_reports_used_and_credits() {
    let mut s = world();
    earn(&mut s, D0, 1, 0);
    buy_play(&mut s, 1);
    s.next_tx(PLAYER);
    let p = s.take_from_sender<Profile>();
    let (used, credits) = training::plays(&p, 1, D0);
    assert!(used == 1 && credits == 1);
    let (u2, c2) = training::plays(&p, 1, D0 + 1); // a new day: free count resets, credits stay
    assert!(u2 == 0 && c2 == 1);
    s.return_to_sender(p);
    s.end();
}

#[test]
fun test_extra_play_price_defaults_and_is_admin_settable() {
    let mut s = world();
    s.next_tx(ADMIN);
    let cap = s.take_from_sender<AdminCap>();
    let mut sh = s.take_shared<Shop>();
    assert!(shop::extra_play_price(&sh) == 20_000_000);
    shop::set_extra_play_price(&mut sh, &cap, 30_000_000);
    assert!(shop::extra_play_price(&sh) == 30_000_000);
    s.return_to_sender(cap); ts::return_shared(sh);
    s.end();
}
