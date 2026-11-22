#[test_only]
module flurry::market_tests;

use sui::clock;
use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::test_scenario as ts;
use flurry::config::{AdminCap, GameConfig};
use flurry::profile::Profile;
use flurry::yeti::{Self, Yeti};
use flurry::shop::{Self, Shop};
use flurry::market::{Self, Market};
use flurry::training;
use flurry::hatch_tests;

const SELLER: address = @0xB0B;
const BUYER: address = @0xCAFE;
const ADMIN: address = @0x0;
const SUI_1: u64 = 1_000_000_000;

fun world(): ts::Scenario {
    let mut s = hatch_tests::setup();
    s.next_tx(ADMIN);
    let cap = s.take_from_sender<AdminCap>();
    shop::create(&cap, s.ctx());
    market::create(&cap, s.ctx());
    s.return_to_sender(cap);
    s.next_tx(SELLER);
    yeti::new_for_testing(2, vector[0], vector[1, 2, 3, 4], 0, s.ctx());
    s
}

fun list(s: &mut ts::Scenario, price: u64): ID {
    { s.next_tx(SELLER); let t = clock::borrow().timestamp_ms() + 1_000; let b = ts::ctx_builder(s).set_clock_timestamp(t); s.next_with_context(b); };
    let mut m = s.take_shared<Market>();
    let y = s.take_from_sender<Yeti>();
    let id = object::id(&y);
    market::list(&mut m, y, price, clock::borrow(), s.ctx());
    ts::return_shared(m);
    id
}

fun coins_of(s: &mut ts::Scenario, who: address): u64 {
    s.next_tx(who);
    let ids = ts::ids_for_sender<Coin<SUI>>(s);
    let mut total = 0; let mut i = 0;
    while (i < ids.length()) { let c = s.take_from_sender_by_id<Coin<SUI>>(ids[i]); total = total + c.value(); s.return_to_sender(c); i = i + 1; };
    total
}

#[test]
fun test_list_and_buy_pays_seller_97_reserve_3() {
    let mut s = world();
    let id = list(&mut s, 2 * SUI_1);
    s.next_tx(BUYER);
    let mut m = s.take_shared<Market>();
    let mut sh = s.take_shared<Shop>();
    let (seller, price, _) = market::listing(&m, id);
    assert!(seller == SELLER && price == 2 * SUI_1);
    market::buy(&mut m, &mut sh, id, coin::mint_for_testing<SUI>(2_500_000_000, s.ctx()), s.ctx());
    assert!(shop::reserve_value(&sh) == 60_000_000);
    ts::return_shared(m); ts::return_shared(sh);
    assert!(coins_of(&mut s, SELLER) == 1_940_000_000);
    assert!(coins_of(&mut s, BUYER) == 500_000_000);
    s.next_tx(BUYER);
    assert!(ts::ids_for_sender<Yeti>(&s).length() == 1);
    s.end();
}

#[test]
fun test_delist_returns_yeti_and_seller_can_reprice() {
    let mut s = world();
    let id = list(&mut s, SUI_1);
    s.next_tx(SELLER);
    let mut m = s.take_shared<Market>();
    market::set_price(&mut m, id, 3 * SUI_1, s.ctx());
    let (_, price, _) = market::listing(&m, id);
    assert!(price == 3 * SUI_1);
    market::delist(&mut m, id, s.ctx());
    ts::return_shared(m);
    s.next_tx(SELLER);
    assert!(ts::ids_for_sender<Yeti>(&s).length() == 1);
    s.end();
}

#[test, expected_failure(abort_code = flurry::market::ENotSeller)]
fun test_only_seller_can_delist() {
    let mut s = world();
    let id = list(&mut s, SUI_1);
    s.next_tx(BUYER);
    let mut m = s.take_shared<Market>();
    market::delist(&mut m, id, s.ctx());
    ts::return_shared(m);
    s.end();
}

#[test, expected_failure(abort_code = flurry::market::ENotSeller)]
fun test_only_seller_can_reprice() {
    let mut s = world();
    let id = list(&mut s, SUI_1);
    s.next_tx(BUYER);
    let mut m = s.take_shared<Market>();
    market::set_price(&mut m, id, 1, s.ctx());
    ts::return_shared(m);
    s.end();
}

#[test, expected_failure(abort_code = flurry::market::ESelf)]
fun test_seller_cannot_buy_own() {
    let mut s = world();
    let id = list(&mut s, SUI_1);
    s.next_tx(SELLER);
    let mut m = s.take_shared<Market>();
    let mut sh = s.take_shared<Shop>();
    market::buy(&mut m, &mut sh, id, coin::mint_for_testing<SUI>(SUI_1, s.ctx()), s.ctx());
    ts::return_shared(m); ts::return_shared(sh);
    s.end();
}

#[test, expected_failure(abort_code = flurry::market::EPay)]
fun test_short_payment_aborts() {
    let mut s = world();
    let id = list(&mut s, SUI_1);
    s.next_tx(BUYER);
    let mut m = s.take_shared<Market>();
    let mut sh = s.take_shared<Shop>();
    market::buy(&mut m, &mut sh, id, coin::mint_for_testing<SUI>(SUI_1 - 1, s.ctx()), s.ctx());
    ts::return_shared(m); ts::return_shared(sh);
    s.end();
}

#[test, expected_failure(abort_code = flurry::market::EPrice)]
fun test_zero_price_aborts() {
    let mut s = world();
    list(&mut s, 0);
    s.end();
}

#[test, expected_failure(abort_code = flurry::market::ETraining)]
fun test_cannot_list_training_yeti() {
    let mut s = world();
    { s.next_tx(SELLER); let b = ts::ctx_builder(&s).set_clock_timestamp(1_700_000_000_000); s.next_with_context(b); };
    let mut y = s.take_from_sender<Yeti>();
    let cfg = s.take_shared<GameConfig>();
    let mut p = s.take_from_sender<Profile>();
    flurry::profile::add_snowflakes_for_testing(&mut p, 100);
    training::start(&mut y, &mut p, &cfg, 0, clock::borrow());
    s.return_to_sender(p); ts::return_shared(cfg); s.return_to_sender(y);
    list(&mut s, SUI_1);
    s.end();
}
