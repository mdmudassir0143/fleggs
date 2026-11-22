/// Admin tools for running the game from the app: gifts (Snowflakes, eggs) and withdrawing the
/// operations share to the admin.
module flurry::admin;

use std::string::String;
use sui::event;
use flurry::config::AdminCap;
use flurry::egg;
use flurry::profile::{Self, Profile};
use flurry::shop::{Self, Shop};

/// A Snowflake gift sitting in a player's wallet until they claim it into their profile.
public struct SnowflakeGift has key { id: UID, amount: u64, note: String }

public struct Gifted has copy, drop { to: address, kind: u8, amount: u64 }
public struct GiftRedeemed has copy, drop { profile_id: ID, amount: u64 }

const KIND_SNOWFLAKES: u8 = 0;
const KIND_EGG: u8 = 1;

public fun gift_snowflakes(_: &AdminCap, to: address, amount: u64, note: String, ctx: &mut TxContext) {
    transfer::transfer(SnowflakeGift { id: object::new(ctx), amount, note }, to);
    event::emit(Gifted { to, kind: KIND_SNOWFLAKES, amount });
}

/// The player claims a Snowflake gift into their profile.
public fun redeem_snowflakes(g: SnowflakeGift, p: &mut Profile) {
    let SnowflakeGift { id, amount, note: _ } = g;
    id.delete();
    profile::add_snowflakes(p, amount);
    event::emit(GiftRedeemed { profile_id: object::id(p), amount });
}

public fun gift_egg(_: &AdminCap, to: address, element: u8, ctx: &mut TxContext) {
    egg::give_new(element, to, ctx);
    event::emit(Gifted { to, kind: KIND_EGG, amount: 1 });
}

/// Withdraw from the operations share (not the reserve or the stakers' pot) to the admin.
#[allow(lint(self_transfer))]
public fun withdraw_to_me(s: &mut Shop, cap: &AdminCap, amount: u64, ctx: &mut TxContext) {
    let c = shop::withdraw(s, cap, amount, ctx);
    transfer::public_transfer(c, ctx.sender());
}

/// Admin sends SUI from their own wallet to an address (the game's gas sponsor).
public fun fund_sponsor(_: &AdminCap, payment: sui::coin::Coin<sui::sui::SUI>, to: address) {
    transfer::public_transfer(payment, to);
}

public fun gift_amount(g: &SnowflakeGift): u64 { g.amount }
public fun gift_note(g: &SnowflakeGift): String { g.note }
