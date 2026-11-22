/// A frozen egg that is warmed through three micro-game stages before hatching.
module flurry::egg;

use sui::clock::Clock;
use flurry::attest;
use flurry::config::GameConfig;
use flurry::profile::{Self, Profile};

const EEggFull: u64 = 20;
const EScoreRange: u64 = 21;

const STAGES: u64 = 3;
const MAX_SCORE: u32 = 1000;
const PURPOSE_EGG_STAGE: u8 = 0;
const GAME_KEEP_IT_WARM: u8 = 0;

public struct Egg has key {
    id: UID,
    element: u8,
    stage_scores: vector<u16>,
}

public(package) fun new(element: u8, ctx: &mut TxContext): Egg {
    Egg { id: object::new(ctx), element, stage_scores: vector[] }
}

/// Mints a fresh egg straight to `recipient` (eggs are non-transferable, so only this module may transfer them).
public(package) fun give_new(element: u8, recipient: address, ctx: &mut TxContext) {
    transfer::transfer(new(element, ctx), recipient);
}

/// Records one referee-signed stage score on the egg and credits its Snowflakes.
public fun submit_stage(
    egg: &mut Egg, p: &mut Profile, cfg: &GameConfig, score: u32, snowflakes: u64,
    expires_ms: u64, sig: vector<u8>, clock: &Clock,
) {
    assert!(egg.stage_scores.length() < STAGES, EEggFull);
    assert!(score <= MAX_SCORE, EScoreRange);
    attest::verify(cfg, p, PURPOSE_EGG_STAGE, GAME_KEEP_IT_WARM, score, snowflakes, expires_ms, sig, clock);
    egg.stage_scores.push_back(score as u16);
    profile::add_snowflakes(p, snowflakes);
    profile::bump_nonce(p);
}

/// Destroys the egg and returns its element and stage scores (used by hatching).
public(package) fun consume(egg: Egg): (u8, vector<u16>) {
    let Egg { id, element, stage_scores } = egg;
    id.delete();
    (element, stage_scores)
}

public fun element(e: &Egg): u8 { e.element }
public fun stage_scores(e: &Egg): vector<u16> { e.stage_scores }
public fun stage_count(): u64 { STAGES }
