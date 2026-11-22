#[test_only]
module flurry::identity_tests;

use sui::test_scenario as ts;
use flurry::hatch_tests;
use flurry::identity;
use flurry::profile::Profile;
use flurry::yeti::Yeti;

macro fun with_profile($s: &mut ts::Scenario, $f: |&mut Profile|) {
    let s = $s;
    s.next_tx(hatch_tests::player());
    let mut p = s.take_from_sender<Profile>();
    $f(&mut p);
    s.return_to_sender(p);
}

#[test]
fun test_set_and_read_nickname() {
    let mut s = hatch_tests::setup();
    with_profile!(&mut s, |p| identity::set_nickname(p, b"Snowy_01".to_string()));
    with_profile!(&mut s, |p| assert!(identity::nickname(p) == option::some(b"Snowy_01".to_string())));
    s.end();
}

#[test]
fun test_overwrite_nickname() {
    let mut s = hatch_tests::setup();
    with_profile!(&mut s, |p| identity::set_nickname(p, b"First".to_string()));
    with_profile!(&mut s, |p| identity::set_nickname(p, b"Second one".to_string()));
    with_profile!(&mut s, |p| assert!(identity::nickname(p) == option::some(b"Second one".to_string())));
    s.end();
}

#[test, expected_failure(abort_code = flurry::identity::ENickLength)]
fun test_nickname_too_short_fails() {
    let mut s = hatch_tests::setup();
    with_profile!(&mut s, |p| identity::set_nickname(p, b"A".to_string()));
    s.end();
}

#[test, expected_failure(abort_code = flurry::identity::ENickChars)]
fun test_nickname_bad_chars_fails() {
    let mut s = hatch_tests::setup();
    with_profile!(&mut s, |p| identity::set_nickname(p, b"bad!".to_string()));
    s.end();
}

#[test, expected_failure(abort_code = flurry::identity::ENickChars)]
fun test_leading_space_fails() {
    let mut s = hatch_tests::setup();
    with_profile!(&mut s, |p| identity::set_nickname(p, b" Snowy".to_string()));
    s.end();
}

#[test]
fun test_set_avatar_preset() {
    let mut s = hatch_tests::setup();
    with_profile!(&mut s, |p| identity::set_avatar_preset(p, 9));
    with_profile!(&mut s, |p| {
        let a = identity::avatar(p).destroy_some();
        assert!(identity::avatar_kind(&a) == 0 && identity::avatar_preset(&a) == 9);
    });
    s.end();
}

#[test, expected_failure(abort_code = flurry::identity::EBadPreset)]
fun test_bad_preset_fails() {
    let mut s = hatch_tests::setup();
    with_profile!(&mut s, |p| identity::set_avatar_preset(p, 10));
    s.end();
}

#[test]
fun test_set_avatar_yeti_stores_id() {
    let mut s = hatch_tests::hatched();
    let y = s.take_from_sender<Yeti>();
    let yid = object::id(&y);
    with_profile!(&mut s, |p| identity::set_avatar_yeti(p, &y));
    with_profile!(&mut s, |p| {
        let a = identity::avatar(p).destroy_some();
        assert!(identity::avatar_kind(&a) == 1 && identity::avatar_yeti(&a) == option::some(yid));
    });
    s.return_to_sender(y);
    s.end();
}
