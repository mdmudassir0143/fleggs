#[test_only]
module flurry::shop_tests;

use sui::clock;
use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::test_scenario as ts;
use flurry::config::{AdminCap, GameConfig};
use flurry::profile::{Self, Profile};
use flurry::egg::{Self, Egg};
use flurry::yeti::{Self, Yeti};
use flurry::shop::{Self, Shop};
use flurry::training;
use flurry::hatch_tests;

const PLAYER: address = @0xB0B;
const ADMIN: address = @0x0;
const SUI_1: u64 = 1_000_000_000;

/// Player with a hatched L1 yeti (221 Snowflakes from stages) and a shared Shop with default prices.
fun world(): ts::Scenario {
    let mut s = hatch_tests::setup();
    hatch_tests::stage(&mut s, 812, 81, x"fdfe34784d191193aebbd7f190b26fbb38192e3550060e443a5d1c5406354c26fbf382ab2d333a13dadfc607e6395283f36c68b2495803b5f85cd3e21a49de0e");
    hatch_tests::stage(&mut s, 500, 50, x"18b826da3d70dfcbebbdcda8f12c75c130282ec976df79e08ddf6524ce9b9e5675a0f661e5c9500fc8db6837799699f00f6dbe7ef29163468a3559365c0aa30c");
    hatch_tests::stage(&mut s, 900, 90, x"349c3878abef1e1164f10c475f68b084fa6e6ab807102be299606ff757ee0414f8df4a65fa8b6a7713283e6ecb6debbc4c5903ed7493563f4f07f38b4799a407");
    hatch_tests::hatch(&mut s);
    s.next_tx(ADMIN);
    let cap = s.take_from_sender<AdminCap>();
    shop::create(&cap, s.ctx());
    s.return_to_sender(cap);
    s
}

fun pay(s: &mut ts::Scenario, amount: u64): Coin<SUI> { coin::mint_for_testing<SUI>(amount, s.ctx()) }
fun eggs(s: &mut ts::Scenario): u64 { s.next_tx(PLAYER); ts::ids_for_sender<Egg>(s).length() }
fun change(s: &mut ts::Scenario): u64 {
    s.next_tx(PLAYER);
    let ids = ts::ids_for_sender<Coin<SUI>>(s);
    if (ids.length() == 0) return 0;
    let c = s.take_from_sender<Coin<SUI>>();
    let v = c.value();
    s.return_to_sender(c);
    v
}

#[test]
fun test_buy_egg_takes_price_refunds_change_and_mints() {
    let mut s = world();
    let before = eggs(&mut s);
    s.next_tx(PLAYER);
    let mut sh = s.take_shared<Shop>();
    let p = s.take_from_sender<Profile>();
    let c = pay(&mut s, SUI_1);
    shop::buy_egg(&mut sh, &p, c, s.ctx());
    assert!(shop::treasury_value(&sh) + shop::reserve_value(&sh) + shop::pot_value(&sh) == SUI_1 / 2);
    s.return_to_sender(p); ts::return_shared(sh);
    assert!(eggs(&mut s) == before + 1);
    assert!(change(&mut s) == SUI_1 / 2);
    s.end();
}

#[test, expected_failure(abort_code = flurry::shop::EPrice)]
fun test_underpaying_aborts() {
    let mut s = world();
    s.next_tx(PLAYER);
    let mut sh = s.take_shared<Shop>();
    let p = s.take_from_sender<Profile>();
    let c = pay(&mut s, SUI_1 / 2 - 1);
    shop::buy_egg(&mut sh, &p, c, s.ctx());
    abort 0
}

#[test]
fun test_element_egg_uses_the_chosen_element() {
    let mut s = world();
    s.next_tx(PLAYER);
    let mut sh = s.take_shared<Shop>();
    let p = s.take_from_sender<Profile>();
    let c = pay(&mut s, SUI_1);
    shop::buy_element_egg(&mut sh, &p, 3, c, s.ctx());
    s.return_to_sender(p); ts::return_shared(sh);
    s.next_tx(PLAYER);
    let e = s.take_from_sender<Egg>();
    assert!(egg::element(&e) == 3);
    s.return_to_sender(e);
    s.end();
}

#[test]
fun test_snowflake_egg_spends_400() {
    let mut s = world();
    s.next_tx(PLAYER);
    let sh = s.take_shared<Shop>();
    let mut p = s.take_from_sender<Profile>();
    profile::add_snowflakes_for_testing(&mut p, 200); // 221 + 200 = 421
    shop::buy_egg_snowflakes(&sh, &mut p, s.ctx());
    assert!(profile::snowflakes(&p) == 21);
    s.return_to_sender(p); ts::return_shared(sh);
    s.end();
}

#[test, expected_failure(abort_code = flurry::shop::ENotEnoughFlakes)]
fun test_snowflake_egg_with_399_aborts() {
    let mut s = world();
    s.next_tx(PLAYER);
    let sh = s.take_shared<Shop>();
    let mut p = s.take_from_sender<Profile>();
    profile::add_snowflakes_for_testing(&mut p, 178); // 399
    shop::buy_egg_snowflakes(&sh, &mut p, s.ctx());
    abort 0
}

#[test, expected_failure(abort_code = flurry::shop::ENotReady)]
fun test_partner_egg_needs_a_merge_ready_yeti() {
    let mut s = world();
    s.next_tx(PLAYER);
    let mut p = s.take_from_sender<Profile>();
    let y = s.take_from_sender<Yeti>();
    shop::claim_partner_egg(&mut p, &y, s.ctx());
    abort 0
}

#[test, expected_failure(abort_code = flurry::shop::EPartnerClaimed)]
fun test_partner_egg_only_once() {
    let mut s = world();
    s.next_tx(PLAYER);
    let mut p = s.take_from_sender<Profile>();
    let mut y = s.take_from_sender<Yeti>();
    yeti::max_traits_for_testing(&mut y);
    shop::claim_partner_egg(&mut p, &y, s.ctx());
    assert!(shop::partner_claimed(&p));
    shop::claim_partner_egg(&mut p, &y, s.ctx());
    abort 0
}

#[test]
fun test_skip_finishes_training_and_charges_per_started_minute() {
    let mut s = world();
    { s.next_tx(PLAYER); let b = ts::ctx_builder(&s).set_clock_timestamp(1_700_000_000_000); s.next_with_context(b); };
    let cfg = s.take_shared<GameConfig>();
    let mut p = s.take_from_sender<Profile>();
    let mut y = s.take_from_sender<Yeti>();
    training::start(&mut y, &mut p, &cfg, 0, clock::borrow()); // 2 minutes
    s.return_to_sender(p); ts::return_shared(cfg); s.return_to_sender(y);
    { s.next_tx(PLAYER); let b = ts::ctx_builder(&s).set_clock_timestamp(1_700_000_030_000); s.next_with_context(b); }; // 90 s left → 2 started minutes
    let mut sh = s.take_shared<Shop>();
    let mut y = s.take_from_sender<Yeti>();
    let before = yeti::trait_points(&yeti::traits(&y)[0]);
    let c = pay(&mut s, SUI_1);
    shop::skip_training(&mut y, &mut sh, c, clock::borrow(), s.ctx());
    assert!(shop::treasury_value(&sh) + shop::reserve_value(&sh) + shop::pot_value(&sh) == 2 * 10_000_000);
    assert!(yeti::trait_points(&yeti::traits(&y)[0]) == before + 1);
    assert!(training::status(&y).is_none());
    s.return_to_sender(y); ts::return_shared(sh);
    s.end();
}

#[test]
fun test_admin_sets_prices_and_withdraws() {
    let mut s = world();
    s.next_tx(PLAYER);
    let mut sh = s.take_shared<Shop>();
    let p = s.take_from_sender<Profile>();
    let c = pay(&mut s, SUI_1);
    shop::buy_egg(&mut sh, &p, c, s.ctx());
    s.return_to_sender(p); ts::return_shared(sh);
    s.next_tx(ADMIN);
    let cap = s.take_from_sender<AdminCap>();
    let mut sh = s.take_shared<Shop>();
    shop::set_prices(&mut sh, &cap, 1, 2, 3, 4, 5);
    assert!(shop::egg_price(&sh) == 1 && shop::snowflake_egg_price(&sh) == 3 && shop::merge_fee(&sh) == 4);
    let ops = shop::treasury_value(&sh);
    assert!(ops == SUI_1 / 2 / 5); // ops keeps 20%
    let out = shop::withdraw(&mut sh, &cap, ops, s.ctx());
    assert!(out.value() == ops && shop::treasury_value(&sh) == 0);
    transfer::public_transfer(out, ADMIN);
    s.return_to_sender(cap); ts::return_shared(sh);
    s.end();
}
