#[test_only]
module flurry::treasury_tests;

use sui::coin;
use sui::sui::SUI;
use sui::test_scenario as ts;
use flurry::config::AdminCap;
use flurry::profile::Profile;
use flurry::shop::{Self, Shop};
use flurry::hatch_tests;

const PLAYER: address = @0xB0B;
const ADMIN: address = @0x0;
const SUI_1: u64 = 1_000_000_000;

fun world(): ts::Scenario {
    let mut s = hatch_tests::setup();
    s.next_tx(ADMIN);
    let cap = s.take_from_sender<AdminCap>();
    shop::create(&cap, s.ctx());
    s.return_to_sender(cap);
    s
}

fun buy_egg(s: &mut ts::Scenario) {
    s.next_tx(PLAYER);
    let mut sh = s.take_shared<Shop>();
    let p = s.take_from_sender<Profile>();
    let c = coin::mint_for_testing<SUI>(SUI_1 / 2, s.ctx());
    shop::buy_egg(&mut sh, &p, c, s.ctx());
    s.return_to_sender(p); ts::return_shared(sh);
}

fun values(s: &mut ts::Scenario): (u64, u64, u64) {
    s.next_tx(PLAYER);
    let sh = s.take_shared<Shop>();
    let (r, p, t) = (shop::reserve_value(&sh), shop::pot_value(&sh), shop::treasury_value(&sh));
    ts::return_shared(sh);
    (r, p, t)
}

#[test]
fun test_a_purchase_splits_50_30_20() {
    let mut s = world();
    buy_egg(&mut s);
    let (r, p, t) = values(&mut s);
    assert!(r == 250_000_000 && p == 150_000_000 && t == 100_000_000);
    s.end();
}

#[test]
fun test_set_split_admin_and_bound() {
    let mut s = world();
    s.next_tx(ADMIN);
    let cap = s.take_from_sender<AdminCap>();
    let mut sh = s.take_shared<Shop>();
    shop::set_split(&mut sh, &cap, 6000, 3000);
    let (rb, pb) = shop::split_bps(&sh);
    assert!(rb == 6000 && pb == 3000);
    s.return_to_sender(cap); ts::return_shared(sh);
    buy_egg(&mut s);
    let (r, _, t) = values(&mut s);
    assert!(r == 300_000_000 && t == 50_000_000);
    s.end();
}

#[test, expected_failure(abort_code = flurry::shop::ESplit)]
fun test_split_cannot_exceed_100_percent() {
    let mut s = world();
    s.next_tx(ADMIN);
    let cap = s.take_from_sender<AdminCap>();
    let mut sh = s.take_shared<Shop>();
    shop::set_split(&mut sh, &cap, 8000, 3000);
    s.return_to_sender(cap); ts::return_shared(sh);
    s.end();
}

#[test]
fun test_anyone_can_fund() {
    let mut s = world();
    s.next_tx(PLAYER);
    let mut sh = s.take_shared<Shop>();
    shop::fund_reserve(&mut sh, coin::mint_for_testing<SUI>(5 * SUI_1, s.ctx()));
    shop::fund_pot(&mut sh, coin::mint_for_testing<SUI>(2 * SUI_1, s.ctx()));
    ts::return_shared(sh);
    let (r, p, _) = values(&mut s);
    assert!(r == 5 * SUI_1 && p == 2 * SUI_1);
    s.end();
}
