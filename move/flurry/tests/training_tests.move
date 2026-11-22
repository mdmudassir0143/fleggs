#[test_only]
module flurry::training_tests;

use sui::clock;
use sui::test_scenario as ts;
use flurry::config::GameConfig;
use flurry::profile::{Self, Profile};
use flurry::yeti::{Self, Yeti};
use flurry::training;
use flurry::test_sigs;
use flurry::hatch_tests;

const PLAYER: address = @0xB0B;
const EXPIRES: u64 = 1_800_000_000_000;
const T0: u64 = 1_700_000_000_000;

/// Player with a hatched L1 yeti (stages credit 221 Snowflakes; nonce is 3).
fun with_yeti(): ts::Scenario {
    let mut s = hatch_tests::setup();
    hatch_tests::stage(&mut s, 812, 81, x"fdfe34784d191193aebbd7f190b26fbb38192e3550060e443a5d1c5406354c26fbf382ab2d333a13dadfc607e6395283f36c68b2495803b5f85cd3e21a49de0e");
    hatch_tests::stage(&mut s, 500, 50, x"18b826da3d70dfcbebbdcda8f12c75c130282ec976df79e08ddf6524ce9b9e5675a0f661e5c9500fc8db6837799699f00f6dbe7ef29163468a3559365c0aa30c");
    hatch_tests::stage(&mut s, 900, 90, x"349c3878abef1e1164f10c475f68b084fa6e6ab807102be299606ff757ee0414f8df4a65fa8b6a7713283e6ecb6debbc4c5903ed7493563f4f07f38b4799a407");
    hatch_tests::hatch(&mut s);
    s
}

fun at(s: &mut ts::Scenario, ms: u64) { { s.next_tx(PLAYER); let b = ts::ctx_builder(s).set_clock_timestamp(ms); s.next_with_context(b); }; }

fun start(s: &mut ts::Scenario, slot: u8, ms: u64) {
    at(s, ms);
    let cfg = s.take_shared<GameConfig>();
    let mut p = s.take_from_sender<Profile>();
    let mut y = s.take_from_sender<Yeti>();
    training::start(&mut y, &mut p, &cfg, slot, clock::borrow());
    s.return_to_sender(y); s.return_to_sender(p); ts::return_shared(cfg);
}

fun finish(s: &mut ts::Scenario, ms: u64) {
    at(s, ms);
    let mut y = s.take_from_sender<Yeti>();
    training::finish(&mut y, clock::borrow());
    s.return_to_sender(y);
}

fun points(s: &mut ts::Scenario, slot: u8): u8 {
    s.next_tx(PLAYER);
    let y = s.take_from_sender<Yeti>();
    let ts_ = yeti::traits(&y);
    let mut i = 0; let mut out = 0;
    while (i < ts_.length()) { if (yeti::trait_slot(&ts_[i]) == slot) out = yeti::trait_points(&ts_[i]); i = i + 1; };
    s.return_to_sender(y);
    out
}

fun snow(s: &mut ts::Scenario): u64 {
    s.next_tx(PLAYER);
    let p = s.take_from_sender<Profile>();
    let n = profile::snowflakes(&p);
    s.return_to_sender(p);
    n
}

#[test]
fun test_earn_credits_snowflakes_and_bumps_nonce() {
    let mut s = hatch_tests::setup();
    s.next_tx(PLAYER);
    let cfg = s.take_shared<GameConfig>();
    let mut p = s.take_from_sender<Profile>();
    training::earn(&mut p, &cfg, 1, 500, 10, EXPIRES, test_sigs::sig(1, 1, 0), clock::borrow());
    assert!(profile::snowflakes(&p) == 10);
    assert!(profile::nonce(&p) == 1);
    s.return_to_sender(p); ts::return_shared(cfg);
    s.end();
}

#[test]
fun test_start_spends_cost_and_sets_ready_at() {
    let mut s = with_yeti();
    let before = snow(&mut s);
    start(&mut s, 0, T0);
    assert!(snow(&mut s) == before - 25);
    s.next_tx(PLAYER);
    let y = s.take_from_sender<Yeti>();
    let t = training::status(&y).destroy_some();
    assert!(training::training_slot(&t) == 0 && training::training_ready_at(&t) == T0 + 120_000);
    s.return_to_sender(y);
    s.end();
}

#[test, expected_failure(abort_code = flurry::training::EAtCap)]
fun test_start_rejects_at_cap() {
    let mut s = with_yeti();
    start(&mut s, 0, T0); finish(&mut s, T0 + 120_000);
    start(&mut s, 0, T0 + 200_000); finish(&mut s, T0 + 200_000 + 240_000);
    assert!(points(&mut s, 0) == 2);
    start(&mut s, 0, T0 + 900_000); // L1 cap is 2
    s.end();
}

#[test, expected_failure(abort_code = flurry::training::EBusy)]
fun test_start_rejects_while_training() {
    let mut s = with_yeti();
    start(&mut s, 0, T0);
    start(&mut s, 1, T0 + 10);
    s.end();
}

#[test, expected_failure(abort_code = flurry::training::EBadSlot)]
fun test_start_rejects_bad_slot() {
    let mut s = with_yeti();
    start(&mut s, 3, T0); // L1 has slots 0..2
    s.end();
}

#[test, expected_failure(abort_code = flurry::training::ENotReady)]
fun test_finish_before_ready_fails() {
    let mut s = with_yeti();
    start(&mut s, 1, T0);
    finish(&mut s, T0 + 119_999);
    s.end();
}

#[test]
fun test_finish_adds_one_point_and_clears_training() {
    let mut s = with_yeti();
    let p0 = points(&mut s, 2);
    start(&mut s, 2, T0);
    finish(&mut s, T0 + 120_000);
    assert!(points(&mut s, 2) == p0 + 1);
    s.next_tx(PLAYER);
    let y = s.take_from_sender<Yeti>();
    assert!(training::status(&y).is_none());
    s.return_to_sender(y);
    s.end();
}
