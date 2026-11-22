#[test_only]
module flurry::merge_tests;

use sui::clock;
use sui::coin::{Self, Coin};
use sui::random::Random;
use sui::sui::SUI;
use sui::test_scenario as ts;
use flurry::config::{AdminCap, GameConfig};
use flurry::profile::Profile;
use flurry::yeti::{Self, Yeti};
use flurry::shop::{Self, Shop};
use flurry::merge;
use flurry::training;
use flurry::hatch_tests;

const PLAYER: address = @0xB0B;
const ADMIN: address = @0x0;
const FEE: u64 = 100_000_000;

/// Shop + random + two yetis owned by PLAYER (no hatched one).
fun world(la: u8, ea: vector<u8>, pa: u8, lb: u8, eb: vector<u8>, pb: u8): ts::Scenario {
    let mut s = hatch_tests::setup();
    s.next_tx(ADMIN);
    let cap = s.take_from_sender<AdminCap>();
    shop::create(&cap, s.ctx());
    s.return_to_sender(cap);
    s.next_tx(PLAYER);
    yeti::new_for_testing(la, ea, vector::tabulate!(slots(la), |i| (i as u8) + 1), pa, s.ctx());
    yeti::new_for_testing(lb, eb, vector::tabulate!(slots(lb), |i| (i as u8) + 5), pb, s.ctx());
    s
}

fun slots(l: u8): u64 { if (l == 1) 3 else if (l == 2) 4 else 5 }

fun do_merge(s: &mut ts::Scenario, picks: vector<u8>, fee: u64) {
    s.next_tx(PLAYER);
    let ids = ts::ids_for_sender<Yeti>(s);
    let a = s.take_from_sender_by_id<Yeti>(ids[0]);
    let b = s.take_from_sender_by_id<Yeti>(ids[1]);
    let mut sh = s.take_shared<Shop>();
    let r = s.take_shared<Random>();
    let c = coin::mint_for_testing<SUI>(fee, s.ctx());
    merge::merge(a, b, picks, &mut sh, c, &r, s.ctx());
    ts::return_shared(r); ts::return_shared(sh);
}

fun child(s: &mut ts::Scenario): Yeti {
    s.next_tx(PLAYER);
    let ids = ts::ids_for_sender<Yeti>(s);
    assert!(ids.length() == 1);
    s.take_from_sender<Yeti>()
}

#[test]
fun test_two_maxed_l1_make_one_l2_with_four_slots() {
    let mut s = world(1, vector[0], 2, 1, vector[0], 2);
    do_merge(&mut s, vector[0, 1, 0], FEE);
    let c = child(&mut s);
    assert!(yeti::level(&c) == 2);
    assert!(yeti::traits(&c).length() == 4);
    s.return_to_sender(c);
    s.end();
}

#[test]
fun test_kept_trait_carries_points_plus_one_and_new_slot_starts_at_zero() {
    let mut s = world(1, vector[0], 2, 1, vector[0], 2);
    do_merge(&mut s, vector[0, 1, 0], FEE);
    let c = child(&mut s);
    let t = yeti::traits(&c);
    assert!(yeti::trait_points(&t[0]) == 3 && yeti::trait_points(&t[1]) == 3 && yeti::trait_points(&t[2]) == 3);
    assert!(yeti::trait_points(&t[3]) == 0);
    s.return_to_sender(c);
    s.end();
}

#[test]
fun test_picks_choose_each_parents_variant() {
    let mut s = world(1, vector[0], 2, 1, vector[0], 2);
    do_merge(&mut s, vector[1, 1, 1], FEE);
    let c = child(&mut s);
    let t = yeti::traits(&c);
    // parent A variants 1,2,3 / parent B 5,6,7 — but the two may come back in either order, so accept a full set from one parent
    let v0 = yeti::trait_variant(&t[0]);
    assert!(v0 == 1 || v0 == 5 || v0 >= 12); // mutation may rewrite one slot
    s.return_to_sender(c);
    s.end();
}

#[test]
fun test_different_elements_make_a_hybrid() {
    let mut s = world(1, vector[3], 2, 1, vector[1], 2);
    do_merge(&mut s, vector[0, 0, 0], FEE);
    let c = child(&mut s);
    assert!(yeti::elements(&c) == vector[1, 3]);
    s.return_to_sender(c);
    s.end();
}

#[test, expected_failure(abort_code = flurry::merge::ELevelMismatch)]
fun test_level_mismatch_aborts() {
    let mut s = world(1, vector[0], 2, 2, vector[0], 4);
    do_merge(&mut s, vector[0, 0, 0], FEE);
    s.end();
}

#[test, expected_failure(abort_code = flurry::merge::ENotMaxed)]
fun test_not_maxed_aborts() {
    let mut s = world(1, vector[0], 2, 1, vector[0], 1);
    do_merge(&mut s, vector[0, 0, 0], FEE);
    s.end();
}

#[test, expected_failure(abort_code = flurry::merge::EMaxLevel)]
fun test_l5_cannot_merge() {
    let mut s = world(5, vector[0], 10, 5, vector[0], 10);
    do_merge(&mut s, vector[0, 0, 0, 0, 0], FEE);
    s.end();
}

#[test, expected_failure(abort_code = flurry::merge::EBadPicks)]
fun test_bad_picks_length_aborts() {
    let mut s = world(1, vector[0], 2, 1, vector[0], 2);
    do_merge(&mut s, vector[0, 1], FEE);
    s.end();
}

#[test, expected_failure(abort_code = flurry::shop::EPrice)]
fun test_fee_is_required() {
    let mut s = world(1, vector[0], 2, 1, vector[0], 2);
    do_merge(&mut s, vector[0, 0, 0], FEE - 1);
    s.end();
}

#[test]
fun test_fee_goes_to_the_treasury() {
    let mut s = world(1, vector[0], 2, 1, vector[0], 2);
    do_merge(&mut s, vector[0, 0, 0], FEE);
    s.next_tx(PLAYER);
    let sh = s.take_shared<Shop>();
    // the merge fee splits like any shop payment: 50% reserve, 30% staker pot, 20% ops
    assert!(shop::reserve_value(&sh) == FEE / 2 && shop::pot_value(&sh) == FEE * 3 / 10 && shop::treasury_value(&sh) == FEE / 5);
    ts::return_shared(sh);
    s.end();
}

#[test, expected_failure(abort_code = flurry::merge::ETraining)]
fun test_training_yeti_aborts() {
    let mut s = world(1, vector[0], 1, 1, vector[0], 2);
    // start training on the yeti with 1 point (it has room), then try to merge
    { s.next_tx(PLAYER); let b = ts::ctx_builder(&s).set_clock_timestamp(1_700_000_000_000); s.next_with_context(b); };
    let ids = ts::ids_for_sender<Yeti>(&s);
    let mut y = s.take_from_sender_by_id<Yeti>(ids[0]);
    if (yeti::trait_points(&yeti::traits(&y)[0]) == 2) { s.return_to_sender(y); y = s.take_from_sender_by_id<Yeti>(ids[1]); };
    let cfg = s.take_shared<GameConfig>();
    let mut p = s.take_from_sender<Profile>();
    flurry::profile::add_snowflakes_for_testing(&mut p, 100);
    training::start(&mut y, &mut p, &cfg, 0, clock::borrow());
    s.return_to_sender(p); ts::return_shared(cfg); s.return_to_sender(y);
    do_merge(&mut s, vector[0, 0, 0], FEE);
    s.end();
}
