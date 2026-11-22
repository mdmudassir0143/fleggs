/// The Yeti NFT: level, element(s), trait slots and its AI-written name and card.
module flurry::yeti;

use std::string::{Self, String};
use sui::display_registry::DisplayRegistry;
use sui::event;
use sui::clock::Clock;
use sui::random::{Random, RandomGenerator};
use flurry::attest;
use flurry::config::{AdminCap, GameConfig};
use flurry::egg::{Self, Egg};

const EStagesIncomplete: u64 = 30;
const ELoreSet: u64 = 31;
const ENameTooLong: u64 = 32;

const MAX_NAME_BYTES: u64 = 24;

const MUTATION_PERCENT: u8 = 5;
const MUTANT_BAND: u8 = 12;
const VARIANTS_PER_TIER: u8 = 4;
const TIER_1_MIN: u16 = 400;
const TIER_2_MIN: u16 = 700;

public struct Trait has store, copy, drop {
    slot: u8,
    variant: u8,
    points: u8,
}

public struct Yeti has key, store {
    id: UID,
    level: u8,
    elements: vector<u8>,
    traits: vector<Trait>,
    name: String,
    card_url: String,
    lore_blob: Option<String>,
    card_blob: Option<String>,
    parents: vector<ID>,
}

public struct LoreAttached has copy, drop {
    yeti_id: ID,
    name: String,
}

public struct Hatched has copy, drop {
    yeti_id: ID,
    owner: address,
    element: u8,
    variants: vector<u8>,
    mutated: bool,
}

#[allow(lint(self_transfer))]
/// One-time admin setup of how wallets show a Yeti (Display V2 lives in the shared registry at 0xd).
public fun create_display(registry: &mut DisplayRegistry, _: &AdminCap, ctx: &mut TxContext) {
    let (mut d, cap) = sui::display_registry::new<Yeti>(registry, std::internal::permit<Yeti>(), ctx);
    d.set(&cap, b"name".to_string(), b"{name}".to_string());
    d.set(&cap, b"description".to_string(), b"Level {level} yeti from Flurry Eggs".to_string());
    d.set(&cap, b"image_url".to_string(), b"{card_url}".to_string());
    d.set(&cap, b"project_url".to_string(), b"https://flurry-eggs.vercel.app".to_string());
    sui::display_registry::share(d);
    transfer::public_transfer(cap, ctx.sender());
}

fun tier(score: u16): u8 {
    if (score < TIER_1_MIN) 0 else if (score < TIER_2_MIN) 1 else 2
}

/// One trait per stage: variant = tier * 4 + rand(0..=3); 5% chance one slot mutates to 12 + rand(0..=3).
public(package) fun roll_traits(scores: &vector<u16>, gen: &mut RandomGenerator): (vector<Trait>, bool) {
    let mut traits = vector[];
    let mut i = 0;
    while (i < scores.length()) {
        let variant = tier(scores[i]) * VARIANTS_PER_TIER + gen.generate_u8_in_range(0, VARIANTS_PER_TIER - 1);
        traits.push_back(Trait { slot: i as u8, variant, points: 0 });
        i = i + 1;
    };
    let mutated = gen.generate_u8_in_range(0, 99) < MUTATION_PERCENT;
    if (mutated) {
        let slot = gen.generate_u64_in_range(0, traits.length() - 1);
        traits[slot].variant = MUTANT_BAND + gen.generate_u8_in_range(0, VARIANTS_PER_TIER - 1);
    };
    (traits, mutated)
}

/// Hatches a fully warmed egg into a Level 1 yeti. Private entry so randomness cannot be gamed by composition.
entry fun hatch(egg: Egg, r: &Random, ctx: &mut TxContext) {
    assert!(egg::stage_scores(&egg).length() == egg::stage_count(), EStagesIncomplete);
    let (element, scores) = egg::consume(egg);
    let mut gen = r.new_generator(ctx);
    let (traits, mutated) = roll_traits(&scores, &mut gen);
    let mut variants = vector[];
    traits.do_ref!(|t| variants.push_back(t.variant));
    let y = Yeti {
        id: object::new(ctx),
        level: 1,
        elements: vector[element],
        traits,
        name: string::utf8(b"Unnamed Yeti"),
        card_url: string::utf8(b""),
        lore_blob: option::none(),
        card_blob: option::none(),
        parents: vector[],
    };
    event::emit(Hatched { yeti_id: object::id(&y), owner: ctx.sender(), element, variants, mutated });
    transfer::public_transfer(y, ctx.sender());
}

/// Writes the AI name and the Walrus lore/card onto a freshly hatched yeti. Referee-signed, once per yeti.
public fun attach_lore(
    y: &mut Yeti, cfg: &GameConfig, name: String, lore_blob: String, card_blob: String,
    card_url: String, expires_ms: u64, sig: vector<u8>, clock: &Clock,
) {
    assert!(y.lore_blob.is_none(), ELoreSet);
    assert!(name.length() <= MAX_NAME_BYTES, ENameTooLong);
    attest::verify_lore(cfg, object::id_address(y), name, lore_blob, card_blob, card_url, expires_ms, sig, clock);
    y.name = name;
    y.card_url = card_url;
    y.lore_blob = option::some(lore_blob);
    y.card_blob = option::some(card_blob);
    event::emit(LoreAttached { yeti_id: object::id(y), name });
}

public fun level(y: &Yeti): u8 { y.level }

public(package) fun uid(y: &Yeti): &UID { &y.id }

public(package) fun new_trait(slot: u8, variant: u8, points: u8): Trait { Trait { slot, variant, points } }
public fun mutant_band(): u8 { MUTANT_BAND }

/// Burns a yeti (merge). Callers make sure it has no training in progress.
public(package) fun destroy(y: Yeti): ID {
    let Yeti { id, level: _, elements: _, traits: _, name: _, card_url: _, lore_blob: _, card_blob: _, parents: _ } = y;
    let yid = id.to_inner();
    id.delete();
    yid
}

/// A merged yeti, unnamed until its lore is attached.
public(package) fun new_merged(level: u8, elements: vector<u8>, traits: vector<Trait>, parents: vector<ID>, ctx: &mut TxContext): Yeti {
    Yeti {
        id: object::new(ctx), level, elements, traits, name: string::utf8(b"Unnamed Yeti"), card_url: string::utf8(b""),
        lore_blob: option::none(), card_blob: option::none(), parents,
    }
}
public(package) fun uid_mut(y: &mut Yeti): &mut UID { &mut y.id }

/// Index of the trait in `slot`, if the yeti has that slot.
public fun trait_index(y: &Yeti, slot: u8): Option<u64> {
    let mut i = 0;
    while (i < y.traits.length()) {
        if (y.traits[i].slot == slot) return option::some(i);
        i = i + 1;
    };
    option::none()
}

/// Trait points cap for this yeti's level (level × 2).
public fun trait_cap(y: &Yeti): u8 { y.level * 2 }

#[test_only]
/// Tests: a yeti with chosen level, elements, variants and points, sent to the sender.
public fun new_for_testing(level: u8, elements: vector<u8>, variants: vector<u8>, points: u8, ctx: &mut TxContext) {
    let mut traits = vector[];
    let mut i = 0;
    while (i < variants.length()) { traits.push_back(Trait { slot: i as u8, variant: variants[i], points }); i = i + 1; };
    transfer::public_transfer(Yeti {
        id: object::new(ctx), level, elements, traits, name: string::utf8(b"Test"), card_url: string::utf8(b""),
        lore_blob: option::none(), card_blob: option::none(), parents: vector[],
    }, ctx.sender());
}

#[test_only]
/// Tests: set every trait to the level cap (skips hours of training).
public fun max_traits_for_testing(y: &mut Yeti) {
    let cap = y.level * 2;
    let mut i = 0;
    while (i < y.traits.length()) { y.traits[i].points = cap; i = i + 1; };
}

/// +1 point on the trait at `index` (callers check the cap).
public(package) fun add_trait_point(y: &mut Yeti, index: u64) {
    let t = &mut y.traits[index];
    t.points = t.points + 1;
}
public fun card_url(y: &Yeti): String { y.card_url }
public fun card_blob(y: &Yeti): Option<String> { y.card_blob }
public fun lore_blob(y: &Yeti): Option<String> { y.lore_blob }
public fun elements(y: &Yeti): vector<u8> { y.elements }
public fun traits(y: &Yeti): vector<Trait> { y.traits }
public fun name(y: &Yeti): String { y.name }
public fun trait_slot(t: &Trait): u8 { t.slot }
public fun trait_variant(t: &Trait): u8 { t.variant }
public fun trait_points(t: &Trait): u8 { t.points }
