/// Player entry point: one profile per address plus the free first egg.
module flurry::onboard;

use flurry::config::{GameConfig, Registry};
use flurry::egg;
use flurry::profile;

public fun create_profile(reg: &mut Registry, cfg: &GameConfig, element: u8, ctx: &mut TxContext) {
    profile::create(reg, cfg, element, ctx);
    egg::give_new(element, ctx.sender(), ctx);
}
