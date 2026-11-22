#[test_only]
module flurry::lodge_tests;

use sui::clock;
use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::test_scenario as ts;
use flurry::config::{AdminCap, GameConfig};
use flurry::profile::Profile;
use flurry::yeti::{Self, Yeti};
use flurry::shop::{Self, Shop};
use flurry::lodge::{Self, Lodge};
use flurry::training;
use flurry::hatch_tests;

const PLAYER: address = @0xB0B;
const OTHER: address = @0xCAFE;
const ADMIN: address = @0x0;
const SUI_1: u64 = 1_000_000_000;
const DAY: u64 = 86_400_000;

fun world(): ts::Scenario {
    let mut s = hatch_tests::setup();
    s.next_tx(ADMIN);
    let cap = s.take_from_sender<AdminCap>();
    shop::create(&cap, s.ctx());
    lodge::create(&cap, s.ctx());
    s.return_to_sender(cap);
    s
}

fun tick(s: &mut ts::Scenario, who: address, ms: u64) {
    s.next_tx(who);
    let t = clock::borrow().timestamp_ms() + ms;
    let b = ts::ctx_builder(s).set_clock_timestamp(t);
    s.next_with_context(b);
}

/// Mints a yeti of `level` for `who` and stakes it; returns its ID.
fun stake_new(s: &mut ts::Scenario, who: address, level: u8): ID {
    s.next_tx(who);
    yeti::new_for_testing(level, vector[0], vector[1, 2, 3, 4, 5], 0, s.ctx());
    tick(s, who, 1_000);
    let y = s.take_from_sender<Yeti>();
    let id = object::id(&y);
    let mut l = s.take_shared<Lodge>();
    let mut sh = s.take_shared<Shop>();
    lodge::stake(&mut l, &mut sh, y, clock::borrow(), s.ctx());
    ts::return_shared(l); ts::return_shared(sh);
    id
}

fun fund_and_sync(s: &mut ts::Scenario, amount: u64) {
    s.next_tx(ADMIN);
    let mut l = s.take_shared<Lodge>();
    let mut sh = s.take_shared<Shop>();
    shop::fund_pot(&mut sh, coin::mint_for_testing<SUI>(amount, s.ctx()));
    lodge::sync(&mut l, &mut sh);
    ts::return_shared(l); ts::return_shared(sh);
}

fun pending(s: &mut ts::Scenario, id: ID): u64 {
    s.next_tx(ADMIN);
    let l = s.take_shared<Lodge>();
    let p = lodge::pending(&l, id);
    ts::return_shared(l);
    p
}

fun coins_of(s: &mut ts::Scenario, who: address): u64 {
    s.next_tx(who);
    let ids = ts::ids_for_sender<Coin<SUI>>(s);
    let mut total = 0; let mut i = 0;
    while (i < ids.length()) { let c = s.take_from_sender_by_id<Coin<SUI>>(ids[i]); total = total + c.value(); s.return_to_sender(c); i = i + 1; };
    total
}

#[test]
fun test_two_stakers_split_by_weight() {
    let mut s = world();
    let a = stake_new(&mut s, PLAYER, 3);  // ×3
    let b = stake_new(&mut s, OTHER, 5);   // ×20
    fund_and_sync(&mut s, 23 * SUI_1);
    assert!(pending(&mut s, a) == 3 * SUI_1);
    assert!(pending(&mut s, b) == 20 * SUI_1);
    s.end();
}

#[test]
fun test_pot_waits_for_first_staker() {
    let mut s = world();
    fund_and_sync(&mut s, 5 * SUI_1);
    let a = stake_new(&mut s, PLAYER, 2);
    fund_and_sync(&mut s, 0);
    assert!(pending(&mut s, a) == 5 * SUI_1);
    s.end();
}

#[test, expected_failure(abort_code = flurry::lodge::ELevel)]
fun test_level_1_cannot_stake() {
    let mut s = world();
    stake_new(&mut s, PLAYER, 1);
    s.end();
}

#[test, expected_failure(abort_code = flurry::lodge::ENotOwner)]
fun test_only_owner_unstakes() {
    let mut s = world();
    let a = stake_new(&mut s, PLAYER, 2);
    tick(&mut s, OTHER, 1_000);
    let mut l = s.take_shared<Lodge>();
    let mut sh = s.take_shared<Shop>();
    lodge::request_unstake(&mut l, &mut sh, a, clock::borrow(), s.ctx());
    ts::return_shared(l); ts::return_shared(sh);
    s.end();
}

#[test, expected_failure(abort_code = flurry::lodge::ETraining)]
fun test_training_cannot_stake() {
    let mut s = world();
    s.next_tx(PLAYER);
    yeti::new_for_testing(2, vector[0], vector[1, 2, 3, 4], 0, s.ctx());
    tick(&mut s, PLAYER, 1_000);
    let ids = ts::ids_for_sender<Yeti>(&s);
    let mut y = s.take_from_sender_by_id<Yeti>(ids[ids.length() - 1]);
    if (yeti::level(&y) != 2) { s.return_to_sender(y); y = s.take_from_sender_by_id<Yeti>(ids[0]); };
    let cfg = s.take_shared<GameConfig>();
    let mut p = s.take_from_sender<Profile>();
    flurry::profile::add_snowflakes_for_testing(&mut p, 100);
    training::start(&mut y, &mut p, &cfg, 0, clock::borrow());
    s.return_to_sender(p); ts::return_shared(cfg);
    let mut l = s.take_shared<Lodge>();
    let mut sh = s.take_shared<Shop>();
    lodge::stake(&mut l, &mut sh, y, clock::borrow(), s.ctx());
    ts::return_shared(l); ts::return_shared(sh);
    s.end();
}
