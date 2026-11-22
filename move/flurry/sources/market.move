/// The player market: list a yeti at your price, change it, take it back, or buy someone else's.
/// A royalty on every sale goes to the buyback reserve; the seller gets the rest.
#[allow(lint(self_transfer), deprecated_usage)]
module flurry::market;

use sui::clock::Clock;
use sui::coin::{Self, Coin};
use sui::dynamic_field as df;
use sui::dynamic_object_field as dof;
use sui::event;
use sui::sui::SUI;
use flurry::config::AdminCap;
use flurry::shop::{Self, Shop};
use flurry::training;
use flurry::yeti::{Self, Yeti};

const EPrice: u64 = 110;
const ETraining: u64 = 111;
const ENotSeller: u64 = 112;
const ESelf: u64 = 113;
const EPay: u64 = 114;
const ENoListing: u64 = 115;
const EBadRoyalty: u64 = 116;

const BPS: u64 = 10_000;

public struct Market has key { id: UID, royalty_bps: u64, count: u64 }

public struct ListingKey has copy, drop, store { id: ID }
public struct ItemKey has copy, drop, store { id: ID }
public struct Listing has store, copy, drop { seller: address, price: u64, listed_ms: u64, level: u8 }

public struct Listed has copy, drop { yeti_id: ID, seller: address, price: u64, level: u8 }
public struct Repriced has copy, drop { yeti_id: ID, price: u64 }
public struct Delisted has copy, drop { yeti_id: ID }
public struct Sold has copy, drop { yeti_id: ID, seller: address, buyer: address, price: u64, level: u8 }

/// One-time admin setup: a shared market with a 3% royalty.
public fun create(_: &AdminCap, ctx: &mut TxContext) {
    transfer::share_object(Market { id: object::new(ctx), royalty_bps: 300, count: 0 });
}

public fun set_royalty(m: &mut Market, _: &AdminCap, bps: u64) { assert!(bps <= BPS, EBadRoyalty); m.royalty_bps = bps; }

public fun list(m: &mut Market, y: Yeti, price: u64, clock: &Clock, ctx: &mut TxContext) {
    assert!(price > 0, EPrice);
    assert!(training::status(&y).is_none(), ETraining);
    let id = object::id(&y);
    let level = yeti::level(&y);
    df::add(&mut m.id, ListingKey { id }, Listing { seller: ctx.sender(), price, listed_ms: clock.timestamp_ms(), level });
    dof::add(&mut m.id, ItemKey { id }, y);
    m.count = m.count + 1;
    event::emit(Listed { yeti_id: id, seller: ctx.sender(), price, level });
}

public fun set_price(m: &mut Market, id: ID, price: u64, ctx: &TxContext) {
    assert!(price > 0, EPrice);
    assert!(df::exists_(&m.id, ListingKey { id }), ENoListing);
    let l: &mut Listing = df::borrow_mut(&mut m.id, ListingKey { id });
    assert!(l.seller == ctx.sender(), ENotSeller);
    l.price = price;
    event::emit(Repriced { yeti_id: id, price });
}

public fun delist(m: &mut Market, id: ID, ctx: &mut TxContext) {
    assert!(df::exists_(&m.id, ListingKey { id }), ENoListing);
    let l: Listing = df::remove(&mut m.id, ListingKey { id });
    assert!(l.seller == ctx.sender(), ENotSeller);
    let y: Yeti = dof::remove(&mut m.id, ItemKey { id });
    m.count = m.count - 1;
    transfer::public_transfer(y, l.seller);
    event::emit(Delisted { yeti_id: id });
}

/// Buy a listed yeti. Exactly the price is taken; any change goes back to the buyer.
public fun buy(m: &mut Market, s: &mut Shop, id: ID, mut payment: Coin<SUI>, ctx: &mut TxContext) {
    assert!(df::exists_(&m.id, ListingKey { id }), ENoListing);
    let l: Listing = df::remove(&mut m.id, ListingKey { id });
    assert!(l.seller != ctx.sender(), ESelf);
    assert!(payment.value() >= l.price, EPay);
    let mut paid = coin::into_balance(payment.split(l.price, ctx));
    let royalty = ((l.price as u128) * (m.royalty_bps as u128) / (BPS as u128)) as u64;
    shop::reserve_join(s, paid.split(royalty));
    transfer::public_transfer(coin::from_balance(paid, ctx), l.seller);
    if (payment.value() > 0) transfer::public_transfer(payment, ctx.sender()) else coin::destroy_zero(payment);
    let y: Yeti = dof::remove(&mut m.id, ItemKey { id });
    m.count = m.count - 1;
    transfer::public_transfer(y, ctx.sender());
    event::emit(Sold { yeti_id: id, seller: l.seller, buyer: ctx.sender(), price: l.price, level: l.level });
}

/// (seller, price, listed_ms) of a listing.
public fun listing(m: &Market, id: ID): (address, u64, u64) {
    let l: &Listing = df::borrow(&m.id, ListingKey { id });
    (l.seller, l.price, l.listed_ms)
}

public fun is_listed(m: &Market, id: ID): bool { df::exists_(&m.id, ListingKey { id }) }
public fun royalty_bps(m: &Market): u64 { m.royalty_bps }
public fun count(m: &Market): u64 { m.count }
