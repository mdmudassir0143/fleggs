/// Merge two maxed yetis of the same level into one yeti of the next level (up to L5 Elder Yeti).
/// Per slot the player picks which parent's trait to keep; it carries its points + 1 (capped).
/// Levels unlock slots (L2: 4, L3+: 5); a new slot rolls a random trait at 0 points. 5% mutation.
module flurry::merge;

use sui::coin::Coin;
use sui::event;
use sui::random::Random;
use sui::sui::SUI;
use flurry::shop::{Self, Shop};
use flurry::training;
use flurry::yeti::{Self, Yeti};

const ELevelMismatch: u64 = 80;
const EMaxLevel: u64 = 81;
const ENotMaxed: u64 = 82;
const ETraining: u64 = 83;
const EBadPicks: u64 = 84;

const MAX_LEVEL: u8 = 5;
const MUTATION_PERCENT: u8 = 5;

public struct Merged has copy, drop {
    yeti_id: ID,
    owner: address,
    level: u8,
    elements: vector<u8>,
    variants: vector<u8>,
    mutated: bool,
    parents: vector<ID>,
}

/// Trait slots a level has.
public fun slots_for(level: u8): u64 { if (level <= 1) 3 else if (level == 2) 4 else 5 }

/// Private entry: randomness can't be gamed by composing calls.
entry fun merge(a: Yeti, b: Yeti, picks: vector<u8>, s: &mut Shop, fee: Coin<SUI>, r: &Random, ctx: &mut TxContext) {
    let level = yeti::level(&a);
    assert!(level == yeti::level(&b), ELevelMismatch);
    assert!(level < MAX_LEVEL, EMaxLevel);
    assert!(training::status(&a).is_none() && training::status(&b).is_none(), ETraining);
    assert!(training::merge_ready(&a) && training::merge_ready(&b), ENotMaxed);
    let ta = yeti::traits(&a);
    let tb = yeti::traits(&b);
    let n = ta.length();
    assert!(picks.length() == n && tb.length() == n, EBadPicks);
    let fee_amount = shop::merge_fee(s);
    shop::take(s, fee, fee_amount, ctx);

    let new_level = level + 1;
    let cap = new_level * 2;
    let mut gen = r.new_generator(ctx);
    let mut traits = vector[];
    let mut i = 0;
    while (i < n) {
        let p = picks[i];
        assert!(p <= 1, EBadPicks);
        let src = if (p == 0) &ta[i] else &tb[i];
        let pts = yeti::trait_points(src) + 1;
        traits.push_back(yeti::new_trait(i as u8, yeti::trait_variant(src), if (pts > cap) cap else pts));
        i = i + 1;
    };
    while (traits.length() < slots_for(new_level)) {
        let slot = traits.length() as u8;
        traits.push_back(yeti::new_trait(slot, gen.generate_u8_in_range(0, yeti::mutant_band() - 1), 0));
    };
    let mutated = gen.generate_u8_in_range(0, 99) < MUTATION_PERCENT;
    if (mutated) {
        let k = gen.generate_u64_in_range(0, traits.length() - 1);
        let t = traits[k];
        *(&mut traits[k]) = yeti::new_trait(yeti::trait_slot(&t), yeti::mutant_band() + gen.generate_u8_in_range(0, 3), yeti::trait_points(&t));
    };

    // Elements: same → same; different → a two-element hybrid, sorted.
    let ea = yeti::elements(&a)[0];
    let eb = yeti::elements(&b)[0];
    let elements = if (ea == eb) vector[ea] else if (ea < eb) vector[ea, eb] else vector[eb, ea];

    let parents = vector[yeti::destroy(a), yeti::destroy(b)];
    let mut variants = vector[];
    traits.do_ref!(|t| variants.push_back(yeti::trait_variant(t)));
    let child = yeti::new_merged(new_level, elements, traits, parents, ctx);
    event::emit(Merged { yeti_id: object::id(&child), owner: ctx.sender(), level: new_level, elements, variants, mutated, parents });
    transfer::public_transfer(child, ctx.sender());
}
