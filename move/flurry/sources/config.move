/// Global game settings, the admin capability and the one-profile-per-address registry.
module flurry::config;

use sui::table::{Self, Table};

const EPaused: u64 = 3;

public struct AdminCap has key, store { id: UID }

public struct GameConfig has key {
    id: UID,
    attestor_pk: vector<u8>,
    paused: bool,
    version: u64,
}

public struct Registry has key {
    id: UID,
    profiles: Table<address, ID>,
}

fun init(ctx: &mut TxContext) {
    transfer::share_object(GameConfig { id: object::new(ctx), attestor_pk: vector[], paused: false, version: 1 });
    transfer::share_object(Registry { id: object::new(ctx), profiles: table::new(ctx) });
    transfer::transfer(AdminCap { id: object::new(ctx) }, ctx.sender());
}

public fun set_attestor(cfg: &mut GameConfig, _: &AdminCap, pk: vector<u8>) { cfg.attestor_pk = pk; }

public fun set_paused(cfg: &mut GameConfig, _: &AdminCap, paused: bool) { cfg.paused = paused; }

/// An admin may issue another admin key (e.g. to the owner's in-app account).
public fun issue_admin_cap(_: &AdminCap, to: address, ctx: &mut TxContext) {
    transfer::public_transfer(AdminCap { id: object::new(ctx) }, to);
}

public fun is_paused(cfg: &GameConfig): bool { cfg.paused }

/// Accounts the admin marks as test accounts (bots, staff) so player stats only count real players.
public struct TestKey has copy, drop, store { who: address }

public fun mark_test_account(reg: &mut Registry, _: &AdminCap, who: address, is_test: bool) {
    let k = TestKey { who };
    let has = sui::dynamic_field::exists_(&reg.id, k);
    if (is_test && !has) sui::dynamic_field::add(&mut reg.id, k, true)
    else if (!is_test && has) { let _: bool = sui::dynamic_field::remove(&mut reg.id, k); };
}

public fun is_test_account(reg: &Registry, who: address): bool { sui::dynamic_field::exists_(&reg.id, TestKey { who }) }

public fun attestor_pk(cfg: &GameConfig): vector<u8> { cfg.attestor_pk }

public fun assert_live(cfg: &GameConfig) { assert!(!cfg.paused, EPaused); }

public(package) fun register(reg: &mut Registry, owner: address, profile_id: ID): bool {
    if (reg.profiles.contains(owner)) return false;
    reg.profiles.add(owner, profile_id);
    true
}

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) { init(ctx) }
