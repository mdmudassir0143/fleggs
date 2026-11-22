#[test_only]
module flurry::lore_tests;

use sui::clock;
use sui::test_scenario as ts;
use flurry::attest;
use flurry::config::GameConfig;
use flurry::hatch_tests;
use flurry::yeti::{Self, Yeti};

const EXPIRES: u64 = 1_800_000_000_000;
// Lore for the hatch_tests yeti 0x0bc9…7d3, signed by the fixed test key (gen-vector.ts --lore).
const LORE_MSG: vector<u8> = x"464c555252595f4c4f52455f56310bc9c77af025eb7f73940ad00c9d6f06d45253339a110b0f9ff03b822e5877d306506562626c65024c310243310c68747470733a2f2f782f433100505c18a3010000";
const LORE_SIG: vector<u8> = x"3132006f26fd22cd9bad4910112367dac434b3f87431cae796d98538fc17d861e63778a2041ffa00945b9009940f606b4d61f76144652000edf262db4a7d5201";
const LONG_SIG: vector<u8> = x"6de6ec711df9dcd17085cbf8192ff23fea8584083fd2745cfd9f885c21fd590bd68b48bc2d5ed4375f1b758755d173da575044a9c6fb081a6d6c2b5fedfd9c00";

fun attach(s: &mut ts::Scenario, name: vector<u8>, sig: vector<u8>) {
    s.next_tx(hatch_tests::player());
    let cfg = s.take_shared<GameConfig>();
    let mut y = s.take_from_sender<Yeti>();
    yeti::attach_lore(
        &mut y, &cfg, name.to_string(), b"L1".to_string(), b"C1".to_string(),
        b"https://x/C1".to_string(), EXPIRES, sig, clock::borrow(),
    );
    s.return_to_sender(y);
    ts::return_shared(cfg);
}

#[test]
fun test_lore_message_matches_ts() {
    let msg = attest::lore_message_for_testing(
        @0x0bc9c77af025eb7f73940ad00c9d6f06d45253339a110b0f9ff03b822e5877d3,
        b"Pebble".to_string(), b"L1".to_string(), b"C1".to_string(), b"https://x/C1".to_string(), EXPIRES,
    );
    assert!(msg == LORE_MSG);
}

#[test]
fun test_attach_lore_sets_name_blobs_and_url() {
    let mut s = hatch_tests::hatched();
    attach(&mut s, b"Pebble", LORE_SIG);
    s.next_tx(hatch_tests::player());
    let y = s.take_from_sender<Yeti>();
    assert!(yeti::name(&y) == b"Pebble".to_string());
    assert!(yeti::card_url(&y) == b"https://x/C1".to_string());
    assert!(yeti::card_blob(&y) == option::some(b"C1".to_string()));
    assert!(yeti::lore_blob(&y) == option::some(b"L1".to_string()));
    s.return_to_sender(y);
    s.end();
}

#[test, expected_failure(abort_code = flurry::yeti::ELoreSet)]
fun test_attach_twice_fails() {
    let mut s = hatch_tests::hatched();
    attach(&mut s, b"Pebble", LORE_SIG);
    attach(&mut s, b"Pebble", LORE_SIG);
    s.end();
}

#[test, expected_failure(abort_code = flurry::attest::EBadSig)]
fun test_attach_with_wrong_name_fails() {
    let mut s = hatch_tests::hatched();
    attach(&mut s, b"Pebbles", LORE_SIG);
    s.end();
}

#[test, expected_failure(abort_code = flurry::yeti::ENameTooLong)]
fun test_name_over_24_fails() {
    let mut s = hatch_tests::hatched();
    attach(&mut s, b"Pebble the Very Long Named Yeti", LONG_SIG);
    s.end();
}
