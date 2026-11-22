#[test_only]
module flurry::lodge_v2_tests;

use sui::clock;
use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::test_scenario as ts;
use flurry::config::AdminCap;
use flurry::yeti::{Self, Yeti};
use flurry::shop::{Self, Shop};
use flurry::lodge::{Self, Lodge};
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

fun stake_new(s: &mut ts::Scenario, who: address, level: u8): ID {
    s.next_tx(who);
    yeti::new_for_testing(level, vector[0], vector[1, 2, 3, 4, 5], 0, s.ctx());
    tick(s, who, 1_000);
    let ids = ts::ids_for_sender<Yeti>(s);
    let y = s.take_from_sender_by_id<Yeti>(ids[ids.length() - 1]);
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

fun claim_all(s: &mut ts::Scenario, who: address, ids: vector<ID>) {
    tick(s, who, 1_000);
    let mut l = s.take_shared<Lodge>();
    let mut sh = s.take_shared<Shop>();
    lodge::claim_all(&mut l, &mut sh, ids, clock::borrow(), s.ctx());
    ts::return_shared(l); ts::return_shared(sh);
}

fun unstake(s: &mut ts::Scenario, who: address, id: ID) {
    tick(s, who, 1_000);
    let mut l = s.take_shared<Lodge>();
    let mut sh = s.take_shared<Shop>();
    lodge::request_unstake(&mut l, &mut sh, id, clock::borrow(), s.ctx());
    ts::return_shared(l); ts::return_shared(sh);
}

fun coins_of(s: &mut ts::Scenario, who: address): u64 {
    s.next_tx(who);
    let ids = ts::ids_for_sender<Coin<SUI>>(s);
    let mut total = 0; let mut i = 0;
    while (i < ids.length()) { let c = s.take_from_sender_by_id<Coin<SUI>>(ids[i]); total = total + c.value(); s.return_to_sender(c); i = i + 1; };
    total
}

#[test, expected_failure(abort_code = flurry::lodge::ENothingToClaim)]
fun test_nothing_claimable_in_the_first_24_hours() {
    let mut s = world();
    let a = stake_new(&mut s, PLAYER, 2);
    fund_and_sync(&mut s, 2 * SUI_1);
    claim_all(&mut s, PLAYER, vector[a]);
    s.end();
}

#[test]
fun test_claim_after_24_hours_pays_all_your_stakes_at_once() {
    let mut s = world();
    let a = stake_new(&mut s, PLAYER, 2);
    let b = stake_new(&mut s, PLAYER, 3);
    fund_and_sync(&mut s, 4 * SUI_1);
    tick(&mut s, PLAYER, DAY);
    claim_all(&mut s, PLAYER, vector[a, b]);
    assert!(coins_of(&mut s, PLAYER) == 4 * SUI_1);
    s.next_tx(ADMIN);
    let l = s.take_shared<Lodge>();
    let (claimed, _) = lodge::totals(&l);
    assert!(claimed == 4 * SUI_1);
    ts::return_shared(l);
    s.end();
}

#[test, expected_failure(abort_code = flurry::lodge::EClaimCooldown)]
fun test_one_claim_per_player_per_24_hours() {
    let mut s = world();
    let a = stake_new(&mut s, PLAYER, 2);
    let b = stake_new(&mut s, PLAYER, 2);
    fund_and_sync(&mut s, 2 * SUI_1);
    tick(&mut s, PLAYER, DAY);
    claim_all(&mut s, PLAYER, vector[a]);
    fund_and_sync(&mut s, 2 * SUI_1);
    claim_all(&mut s, PLAYER, vector[b]); // same player, same day → refused
    s.end();
}

#[test]
fun test_claim_again_the_next_day() {
    let mut s = world();
    let a = stake_new(&mut s, PLAYER, 2);
    fund_and_sync(&mut s, SUI_1);
    tick(&mut s, PLAYER, DAY);
    claim_all(&mut s, PLAYER, vector[a]);
    fund_and_sync(&mut s, SUI_1);
    tick(&mut s, PLAYER, DAY);
    claim_all(&mut s, PLAYER, vector[a]);
    assert!(coins_of(&mut s, PLAYER) == 2 * SUI_1);
    s.end();
}

#[test]
fun test_unstake_returns_the_yeti_at_once_after_the_lock() {
    let mut s = world();
    let a = stake_new(&mut s, PLAYER, 2);
    tick(&mut s, PLAYER, DAY);
    unstake(&mut s, PLAYER, a);
    s.next_tx(PLAYER);
    assert!(ts::ids_for_sender<Yeti>(&s).length() == 1);
    s.end();
}

#[test, expected_failure(abort_code = flurry::lodge::ELocked)]
fun test_cannot_unstake_during_the_24h_lock() {
    let mut s = world();
    let a = stake_new(&mut s, PLAYER, 2);
    tick(&mut s, PLAYER, DAY - 10_000);
    unstake(&mut s, PLAYER, a);
    s.end();
}

#[test]
fun test_unstake_after_24h_keeps_rewards_for_your_next_claim() {
    let mut s = world();
    let a = stake_new(&mut s, PLAYER, 2);
    fund_and_sync(&mut s, SUI_1);
    tick(&mut s, PLAYER, DAY);
    unstake(&mut s, PLAYER, a);
    s.next_tx(ADMIN);
    let l = s.take_shared<Lodge>();
    let (owed, _) = lodge::account_info(&l, PLAYER);
    assert!(owed == SUI_1);
    ts::return_shared(l);
    claim_all(&mut s, PLAYER, vector[]);
    assert!(coins_of(&mut s, PLAYER) == SUI_1);
    s.end();
}

#[test, expected_failure(abort_code = flurry::lodge::EUseClaimAll)]
fun test_single_claim_is_retired() {
    let mut s = world();
    let a = stake_new(&mut s, PLAYER, 2);
    tick(&mut s, PLAYER, DAY);
    let mut l = s.take_shared<Lodge>();
    let mut sh = s.take_shared<Shop>();
    lodge::claim(&mut l, &mut sh, a, s.ctx());
    ts::return_shared(l); ts::return_shared(sh);
    s.end();
}
