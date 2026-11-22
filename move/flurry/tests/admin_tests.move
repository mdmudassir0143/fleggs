#[test_only]
module flurry::admin_tests;

use std::string;
use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::test_scenario as ts;
use flurry::config::{Self, AdminCap};
use flurry::profile::{Self, Profile};
use flurry::egg::Egg;
use flurry::shop::{Self, Shop};
use flurry::admin::{Self, SnowflakeGift};
use flurry::hatch_tests;

const PLAYER: address = @0xB0B;
const ADMIN: address = @0x0;
const NEW_ADMIN: address = @0xA11CE;

fun world(): ts::Scenario {
    let mut s = hatch_tests::setup();
    s.next_tx(ADMIN);
    let cap = s.take_from_sender<AdminCap>();
    shop::create(&cap, s.ctx());
    s.return_to_sender(cap);
    s
}

#[test]
fun test_admin_can_issue_a_second_admin_key() {
    let mut s = world();
    s.next_tx(ADMIN);
    let cap = s.take_from_sender<AdminCap>();
    config::issue_admin_cap(&cap, NEW_ADMIN, s.ctx());
    s.return_to_sender(cap);
    s.next_tx(NEW_ADMIN);
    assert!(ts::has_most_recent_for_sender<AdminCap>(&s));
    s.end();
}

#[test]
fun test_snowflake_gift_is_claimed_into_the_profile() {
    let mut s = world();
    s.next_tx(ADMIN);
    let cap = s.take_from_sender<AdminCap>();
    admin::gift_snowflakes(&cap, PLAYER, 50, string::utf8(b"Thanks for testing!"), s.ctx());
    s.return_to_sender(cap);
    s.next_tx(PLAYER);
    let g = s.take_from_sender<SnowflakeGift>();
    let mut p = s.take_from_sender<Profile>();
    let before = profile::snowflakes(&p);
    admin::redeem_snowflakes(g, &mut p);
    assert!(profile::snowflakes(&p) == before + 50);
    s.return_to_sender(p);
    s.end();
}

#[test]
fun test_admin_can_gift_an_egg() {
    let mut s = world();
    s.next_tx(PLAYER);
    let before = ts::ids_for_sender<Egg>(&s).length();
    s.next_tx(ADMIN);
    let cap = s.take_from_sender<AdminCap>();
    admin::gift_egg(&cap, PLAYER, 2, s.ctx());
    s.return_to_sender(cap);
    s.next_tx(PLAYER);
    assert!(ts::ids_for_sender<Egg>(&s).length() == before + 1);
    s.end();
}

#[test]
fun test_withdraw_to_admin_sends_the_ops_share() {
    let mut s = world();
    s.next_tx(PLAYER);
    let mut sh = s.take_shared<Shop>();
    let p = s.take_from_sender<Profile>();
    shop::buy_egg(&mut sh, &p, coin::mint_for_testing<SUI>(500_000_000, s.ctx()), s.ctx());
    s.return_to_sender(p); ts::return_shared(sh);
    s.next_tx(ADMIN);
    let cap = s.take_from_sender<AdminCap>();
    let mut sh = s.take_shared<Shop>();
    admin::withdraw_to_me(&mut sh, &cap, 100_000_000, s.ctx());
    s.return_to_sender(cap); ts::return_shared(sh);
    s.next_tx(ADMIN);
    let c = s.take_from_sender<Coin<SUI>>();
    assert!(c.value() == 100_000_000);
    s.return_to_sender(c);
    s.end();
}

#[test]
fun test_admin_can_mark_and_unmark_a_test_account() {
    let mut s = world();
    s.next_tx(ADMIN);
    let cap = s.take_from_sender<AdminCap>();
    let mut reg = s.take_shared<config::Registry>();
    assert!(!config::is_test_account(&reg, PLAYER));
    config::mark_test_account(&mut reg, &cap, PLAYER, true);
    assert!(config::is_test_account(&reg, PLAYER));
    config::mark_test_account(&mut reg, &cap, PLAYER, false);
    assert!(!config::is_test_account(&reg, PLAYER));
    s.return_to_sender(cap); ts::return_shared(reg);
    s.end();
}

#[test]
fun test_admin_sends_sui_to_the_sponsor() {
    let mut s = world();
    s.next_tx(ADMIN);
    let cap = s.take_from_sender<AdminCap>();
    admin::fund_sponsor(&cap, coin::mint_for_testing<SUI>(700, s.ctx()), NEW_ADMIN);
    s.return_to_sender(cap);
    s.next_tx(NEW_ADMIN);
    let c = s.take_from_sender<Coin<SUI>>();
    assert!(c.value() == 700);
    s.return_to_sender(c);
    s.end();
}
