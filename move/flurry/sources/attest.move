/// Verifies referee-signed game results. The message layout must match
/// `packages/shared/src/attestation.ts` byte for byte:
/// b"FLURRY_ATT_V1" || bcs(profile_id, nonce, purpose, game, score, snowflakes, expires_ms).
/// The profile's current nonce is part of the message, so a used signature can never verify again.
module flurry::attest;

use std::string::String;
use sui::bcs;
use sui::clock::Clock;
use sui::ed25519;
use flurry::config::{Self, GameConfig};
use flurry::profile::{Self, Profile};

const EBadSig: u64 = 10;
const EExpired: u64 = 12;

const PREFIX: vector<u8> = b"FLURRY_ATT_V1";
const LORE_PREFIX: vector<u8> = b"FLURRY_LORE_V1";

fun message(
    profile_id: address, nonce: u64, purpose: u8, game: u8, score: u32, snowflakes: u64, expires_ms: u64,
): vector<u8> {
    let mut m = PREFIX;
    m.append(bcs::to_bytes(&profile_id));
    m.append(bcs::to_bytes(&nonce));
    m.append(bcs::to_bytes(&purpose));
    m.append(bcs::to_bytes(&game));
    m.append(bcs::to_bytes(&score));
    m.append(bcs::to_bytes(&snowflakes));
    m.append(bcs::to_bytes(&expires_ms));
    m
}

fun check(
    pk: vector<u8>, profile_id: address, nonce: u64, purpose: u8, game: u8, score: u32,
    snowflakes: u64, expires_ms: u64, sig: vector<u8>, clock: &Clock,
) {
    assert!(clock.timestamp_ms() <= expires_ms, EExpired);
    let msg = message(profile_id, nonce, purpose, game, score, snowflakes, expires_ms);
    assert!(ed25519::ed25519_verify(&sig, &pk, &msg), EBadSig);
}

/// Aborts unless `sig` is the referee's signature over this result for `p` at its current nonce.
public(package) fun verify(
    cfg: &GameConfig, p: &Profile, purpose: u8, game: u8, score: u32, snowflakes: u64,
    expires_ms: u64, sig: vector<u8>, clock: &Clock,
) {
    check(
        config::attestor_pk(cfg), object::id_address(p), profile::nonce(p),
        purpose, game, score, snowflakes, expires_ms, sig, clock,
    );
}

fun lore_message(
    yeti_id: address, name: String, lore_blob: String, card_blob: String, card_url: String, expires_ms: u64,
): vector<u8> {
    let mut m = LORE_PREFIX;
    m.append(bcs::to_bytes(&yeti_id));
    m.append(bcs::to_bytes(&name));
    m.append(bcs::to_bytes(&lore_blob));
    m.append(bcs::to_bytes(&card_blob));
    m.append(bcs::to_bytes(&card_url));
    m.append(bcs::to_bytes(&expires_ms));
    m
}

/// Aborts unless `sig` is the referee's signature over this exact lore for `yeti_id`.
public(package) fun verify_lore(
    cfg: &GameConfig, yeti_id: address, name: String, lore_blob: String, card_blob: String,
    card_url: String, expires_ms: u64, sig: vector<u8>, clock: &Clock,
) {
    assert!(clock.timestamp_ms() <= expires_ms, EExpired);
    let msg = lore_message(yeti_id, name, lore_blob, card_blob, card_url, expires_ms);
    assert!(ed25519::ed25519_verify(&sig, &config::attestor_pk(cfg), &msg), EBadSig);
}

#[test_only]
public fun lore_message_for_testing(
    yeti_id: address, name: String, lore_blob: String, card_blob: String, card_url: String, expires_ms: u64,
): vector<u8> { lore_message(yeti_id, name, lore_blob, card_blob, card_url, expires_ms) }

#[test_only]
public fun message_for_testing(
    profile_id: address, nonce: u64, purpose: u8, game: u8, score: u32, snowflakes: u64, expires_ms: u64,
): vector<u8> { message(profile_id, nonce, purpose, game, score, snowflakes, expires_ms) }

#[test_only]
public fun verify_raw_for_testing(pk: vector<u8>, msg: vector<u8>, sig: vector<u8>): bool {
    ed25519::ed25519_verify(&sig, &pk, &msg)
}

#[test_only]
public fun check_for_testing(
    pk: vector<u8>, profile_id: address, nonce: u64, purpose: u8, game: u8, score: u32,
    snowflakes: u64, expires_ms: u64, sig: vector<u8>, clock: &Clock,
) { check(pk, profile_id, nonce, purpose, game, score, snowflakes, expires_ms, sig, clock) }
