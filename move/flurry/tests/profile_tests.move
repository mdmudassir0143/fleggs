#[test_only]
module flurry::profile_tests;

use sui::test_scenario as ts;
use flurry::config::{Self, GameConfig, Registry, AdminCap};
use flurry::profile::{Self, Profile};
use flurry::onboard;
use flurry::egg::{Self, Egg};

const PLAYER: address = @0xB0B;
const ADMIN: address = @0xAD;

fun setup(): ts::Scenario {
    let mut s = ts::begin(ADMIN);
    config::init_for_testing(s.ctx());
    s
}

fun create(s: &mut ts::Scenario, element: u8) {
    s.next_tx(PLAYER);
    let mut reg = s.take_shared<Registry>();
    let cfg = s.take_shared<GameConfig>();
    onboard::create_profile(&mut reg, &cfg, element, s.ctx());
    ts::return_shared(reg);
    ts::return_shared(cfg);
}

#[test]
fun test_create_profile_gives_profile_and_egg() {
    let mut s = setup();
    create(&mut s, 2);
    s.next_tx(PLAYER);
    let p = s.take_from_sender<Profile>();
    assert!(profile::element(&p) == 2);
    assert!(profile::nonce(&p) == 0);
    assert!(profile::snowflakes(&p) == 0);
    let e = s.take_from_sender<Egg>();
    assert!(egg::element(&e) == 2);
    assert!(egg::stage_scores(&e).length() == 0);
    s.return_to_sender(p);
    s.return_to_sender(e);
    s.end();
}

#[test, expected_failure(abort_code = flurry::profile::EAlreadyRegistered)]
fun test_second_profile_same_address_fails() {
    let mut s = setup();
    create(&mut s, 2);
    create(&mut s, 1);
    s.end();
}

#[test, expected_failure(abort_code = flurry::profile::EBadElement)]
fun test_bad_element_fails() {
    let mut s = setup();
    create(&mut s, 4);
    s.end();
}

#[test, expected_failure(abort_code = flurry::config::EPaused)]
fun test_paused_blocks_create() {
    let mut s = setup();
    s.next_tx(ADMIN);
    let mut cfg = s.take_shared<GameConfig>();
    let cap = s.take_from_sender<AdminCap>();
    config::set_paused(&mut cfg, &cap, true);
    ts::return_shared(cfg);
    s.return_to_sender(cap);
    create(&mut s, 1);
    s.end();
}
