/// The player's chosen nickname and avatar, stored on their Profile as dynamic fields
/// (added in a package upgrade, so Profile's own fields stay unchanged).
#[allow(deprecated_usage)]
module flurry::identity;

use std::string::String;
use sui::dynamic_field as df;
use flurry::profile::{Self, Profile};
use flurry::yeti::Yeti;

const ENickLength: u64 = 40;
const ENickChars: u64 = 41;
const EBadPreset: u64 = 42;

const MIN_NICK: u64 = 2;
const MAX_NICK: u64 = 20;
const PRESETS: u8 = 10;
const KIND_PRESET: u8 = 0;
const KIND_YETI: u8 = 1;

public struct NickKey has copy, drop, store {}
public struct AvatarKey has copy, drop, store {}

/// kind 0 = one of the 10 preset avatars, kind 1 = a yeti the player owned when choosing it.
public struct Avatar has store, copy, drop {
    kind: u8,
    preset: u8,
    yeti: Option<ID>,
}

fun allowed(c: u8): bool {
    (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c == 32 || c == 95 || c == 45
}

fun upsert<K: copy + drop + store, V: store + drop>(p: &mut Profile, key: K, value: V) {
    let uid = profile::uid_mut(p);
    if (df::exists_(uid, key)) *df::borrow_mut<K, V>(uid, key) = value
    else df::add(uid, key, value);
}

/// 2–20 ASCII letters, digits, spaces, `_` or `-`, not starting or ending with a space.
public fun set_nickname(p: &mut Profile, name: String) {
    let b = name.as_bytes();
    let n = b.length();
    assert!(n >= MIN_NICK && n <= MAX_NICK, ENickLength);
    assert!(b[0] != 32 && b[n - 1] != 32, ENickChars);
    let mut i = 0;
    while (i < n) { assert!(allowed(b[i]), ENickChars); i = i + 1; };
    upsert(p, NickKey {}, name);
}

public fun set_avatar_preset(p: &mut Profile, preset: u8) {
    assert!(preset < PRESETS, EBadPreset);
    upsert(p, AvatarKey {}, Avatar { kind: KIND_PRESET, preset, yeti: option::none() });
}

/// Passing `&Yeti` proves the caller owns it at the time of choosing.
public fun set_avatar_yeti(p: &mut Profile, y: &Yeti) {
    upsert(p, AvatarKey {}, Avatar { kind: KIND_YETI, preset: 0, yeti: option::some(object::id(y)) });
}

public fun nickname(p: &Profile): Option<String> {
    let uid = profile::uid(p);
    if (df::exists_(uid, NickKey {})) option::some(*df::borrow<NickKey, String>(uid, NickKey {})) else option::none()
}

public fun avatar(p: &Profile): Option<Avatar> {
    let uid = profile::uid(p);
    if (df::exists_(uid, AvatarKey {})) option::some(*df::borrow<AvatarKey, Avatar>(uid, AvatarKey {})) else option::none()
}

public fun avatar_kind(a: &Avatar): u8 { a.kind }
public fun avatar_preset(a: &Avatar): u8 { a.preset }
public fun avatar_yeti(a: &Avatar): Option<ID> { a.yeti }
