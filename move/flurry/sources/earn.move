/// Sell a yeti to the treasury: a guaranteed price per level, paid from the buyback reserve
/// (fed by shop revenue). The yeti is burned. One sale never takes more than `cap_bps` of the
/// reserve, so the reserve can't be drained.
module flurry::earn;

use sui::dynamic_field as df;
use sui::event;
use flurry::config::AdminCap;
use flurry::shop::{Self, Shop};
use flurry::training;
use flurry::yeti::{Self, Yeti};

const ELevelTooLow: u64 = 100;
const ETraining: u64 = 101;
const EReserveEmpty: u64 = 102;
const EBadTable: u64 = 103;
const EBelowMin: u64 = 104;

const BPS: u64 = 10_000;
const DEFAULT_CAP_BPS: u64 = 200;

public struct PricesKey has copy, drop, store {}
public struct CapKey has copy, drop, store {}

public struct SoldToTreasury has copy, drop { yeti_id: ID, owner: address, level: u8, paid: u64 }

/// Launch table, indexed by level (0–5): L2 0.6, L3 1.4, L4 3, L5 6.5 SUI.
fun default_prices(): vector<u64> { vector[0, 0, 600_000_000, 1_400_000_000, 3_000_000_000, 6_500_000_000] }

fun table_price(s: &Shop, level: u8): u64 {
    let t = if (df::exists_(shop::uid(s), PricesKey {})) *df::borrow<PricesKey, vector<u64>>(shop::uid(s), PricesKey {}) else default_prices();
    if ((level as u64) < t.length()) t[level as u64] else 0
}

fun cap_bps(s: &Shop): u64 {
    if (df::exists_(shop::uid(s), CapKey {})) *df::borrow(shop::uid(s), CapKey {}) else DEFAULT_CAP_BPS
}

/// What the treasury pays right now for a yeti of `level`: the table price, capped at a share
/// of the reserve. 0 for levels below 2.
public fun treasury_price(s: &Shop, level: u8): u64 {
    if (level < 2) return 0;
    let cap = ((shop::reserve_value(s) as u128) * (cap_bps(s) as u128) / (BPS as u128)) as u64;
    let p = table_price(s, level);
    if (p < cap) p else cap
}

public fun set_prices(s: &mut Shop, _: &AdminCap, table: vector<u64>, cap_bps: u64) {
    assert!(table.length() == 6 && cap_bps <= BPS, EBadTable);
    let uid = shop::uid_mut(s);
    if (df::exists_(uid, PricesKey {})) *df::borrow_mut(uid, PricesKey {}) = table else df::add(uid, PricesKey {}, table);
    if (df::exists_(uid, CapKey {})) *df::borrow_mut(uid, CapKey {}) = cap_bps else df::add(uid, CapKey {}, cap_bps);
}

/// Sell `y` to the treasury. The price is paid to the sender; the yeti is burned.
public fun sell_to_treasury(s: &mut Shop, y: Yeti, ctx: &mut TxContext) {
    sell_impl(s, y, 0, ctx);
}

/// Like `sell_to_treasury`, but aborts if the price is now below `min_paid` (what the player
/// confirmed), so a sale never pays less than the player agreed to.
public fun sell_to_treasury_min(s: &mut Shop, y: Yeti, min_paid: u64, ctx: &mut TxContext) {
    sell_impl(s, y, min_paid, ctx);
}

fun sell_impl(s: &mut Shop, y: Yeti, min_paid: u64, ctx: &mut TxContext) {
    let level = yeti::level(&y);
    assert!(level >= 2, ELevelTooLow);
    assert!(training::status(&y).is_none(), ETraining);
    let price = treasury_price(s, level);
    assert!(price > 0, EReserveEmpty);
    assert!(price >= min_paid, EBelowMin);
    let yeti_id = yeti::destroy(y);
    transfer::public_transfer(shop::reserve_take(s, price, ctx), ctx.sender());
    event::emit(SoldToTreasury { yeti_id, owner: ctx.sender(), level, paid: price });
}
