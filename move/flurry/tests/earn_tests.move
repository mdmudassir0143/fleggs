#[test_only]
module flurry::earn_tests;

use sui::clock;
use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::test_scenario as ts;
use flurry::config::{AdminCap, GameConfig};
use flurry::profile::Profile;
use flurry::yeti::{Self, Yeti};
use flurry::shop::{Self, Shop};
use flurry::earn;
use flurry::training;
use flurry::hatch_tests;

const PLAYER: address = @0xB0B;
const ADMIN: address = @0x0;
const SUI_1: u64 = 1_000_000_000;

/// A shop with launch prices, a reserve of `reserve` MIST, and one test yeti of `level` for the player.
fun world(level: u8, reserve: u64): ts::Scenario {
    let mut s = hatch_tests::setup();
    s.next_tx(ADMIN);
    let cap = s.take_from_sender<AdminCap>();
    shop::create(&cap, s.ctx());
    s.return_to_sender(cap);
    s.next_tx(ADMIN);
    let mut sh = s.take_shared<Shop>();
    if (reserve > 0) shop::fund_reserve(&mut sh, coin::mint_for_testing<SUI>(reserve, s.ctx()));
    ts::return_shared(sh);
    s.next_tx(PLAYER);
    yeti::new_for_testing(level, vector[0], vector[1, 2, 3, 4, 5], 0, s.ctx());
    s
}

fun sell(s: &mut ts::Scenario) {
    s.next_tx(PLAYER);
    let mut sh = s.take_shared<Shop>();
    let y = s.take_from_sender<Yeti>();
    earn::sell_to_treasury(&mut sh, y, s.ctx());
    ts::return_shared(sh);
}

fun received(s: &mut ts::Scenario): u64 {
    s.next_tx(PLAYER);
    let c = s.take_from_sender<Coin<SUI>>();
    let v = c.value();
    s.return_to_sender(c);
    v
}

#[test]
fun test_l3_sells_for_table_price() {
    let mut s = world(3, 100 * SUI_1);
    sell(&mut s);
    assert!(received(&mut s) == 1_400_000_000);
    s.next_tx(PLAYER);
    assert!(ts::ids_for_sender<Yeti>(&s).length() == 0);
    let sh = s.take_shared<Shop>();
    assert!(shop::reserve_value(&sh) == 100 * SUI_1 - 1_400_000_000);
    ts::return_shared(sh);
    s.end();
}

#[test]
fun test_reserve_cap_binds() {
    let mut s = world(5, 10 * SUI_1);
    s.next_tx(PLAYER);
    let sh = s.take_shared<Shop>();
    assert!(earn::treasury_price(&sh, 5) == 200_000_000); // 2% of 10 SUI, not 6.5 SUI
    ts::return_shared(sh);
    sell(&mut s);
    assert!(received(&mut s) == 200_000_000);
    s.end();
}

#[test, expected_failure(abort_code = flurry::earn::ELevelTooLow)]
fun test_level_1_cannot_sell() {
    let mut s = world(1, 100 * SUI_1);
    sell(&mut s);
    s.end();
}

#[test, expected_failure(abort_code = flurry::earn::EReserveEmpty)]
fun test_empty_reserve() {
    let mut s = world(2, 0);
    sell(&mut s);
    s.end();
}

#[test, expected_failure(abort_code = flurry::earn::ETraining)]
fun test_training_yeti_cannot_sell() {
    let mut s = world(2, 100 * SUI_1);
    { s.next_tx(PLAYER); let b = ts::ctx_builder(&s).set_clock_timestamp(1_700_000_000_000); s.next_with_context(b); };
    let mut y = s.take_from_sender<Yeti>();
    let cfg = s.take_shared<GameConfig>();
    let mut p = s.take_from_sender<Profile>();
    flurry::profile::add_snowflakes_for_testing(&mut p, 100);
    training::start(&mut y, &mut p, &cfg, 0, clock::borrow());
    s.return_to_sender(p); ts::return_shared(cfg); s.return_to_sender(y);
    sell(&mut s);
    s.end();
}

#[test]
fun test_admin_sets_prices() {
    let mut s = world(2, 100 * SUI_1);
    s.next_tx(ADMIN);
    let cap = s.take_from_sender<AdminCap>();
    let mut sh = s.take_shared<Shop>();
    earn::set_prices(&mut sh, &cap, vector[0, 0, 900_000_000, 2, 3, 4], 500);
    assert!(earn::treasury_price(&sh, 2) == 900_000_000);
    assert!(earn::treasury_price(&sh, 1) == 0);
    s.return_to_sender(cap); ts::return_shared(sh);
    s.end();
}

fun sell_min(s: &mut ts::Scenario, min_paid: u64) {
    s.next_tx(PLAYER);
    let mut sh = s.take_shared<Shop>();
    let y = s.take_from_sender<Yeti>();
    earn::sell_to_treasury_min(&mut sh, y, min_paid, s.ctx());
    ts::return_shared(sh);
}

#[test]
fun test_sell_with_minimum_pays_when_price_holds() {
    let mut s = world(3, 100 * SUI_1);
    sell_min(&mut s, 1_400_000_000);
    assert!(received(&mut s) == 1_400_000_000);
    s.end();
}

#[test, expected_failure(abort_code = flurry::earn::EBelowMin)]
fun test_sell_aborts_if_price_dropped_below_what_was_confirmed() {
    // the player confirmed 1.4 SUI, but the reserve shrank so the cap now pays less
    let mut s = world(3, 10 * SUI_1);
    sell_min(&mut s, 1_400_000_000);
    s.end();
}
