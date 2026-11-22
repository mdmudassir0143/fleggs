import { bcs } from '@mysten/sui/bcs';

/** BCS layouts of flurry Move structs, in field order. Parse `object.content` with these. */
export const ProfileBcs = bcs.struct('Profile', {
  id: bcs.Address,
  element: bcs.u8(),
  snowflakes: bcs.u64(),
  streak: bcs.u8(),
  last_daily_day: bcs.u64(),
  nonce: bcs.u64(),
});

export const EggBcs = bcs.struct('Egg', {
  id: bcs.Address,
  element: bcs.u8(),
  stage_scores: bcs.vector(bcs.u16()),
});

export const TraitBcs = bcs.struct('Trait', { slot: bcs.u8(), variant: bcs.u8(), points: bcs.u8() });

export const YetiBcs = bcs.struct('Yeti', {
  id: bcs.Address,
  level: bcs.u8(),
  elements: bcs.vector(bcs.u8()),
  traits: bcs.vector(TraitBcs),
  name: bcs.string(),
  card_url: bcs.string(),
  lore_blob: bcs.option(bcs.string()),
  card_blob: bcs.option(bcs.string()),
  parents: bcs.vector(bcs.Address),
});

/** `flurry::yeti::Hatched` event. */
export const HatchedBcs = bcs.struct('Hatched', {
  yeti_id: bcs.Address,
  owner: bcs.Address,
  element: bcs.u8(),
  variants: bcs.vector(bcs.u8()),
  mutated: bcs.bool(),
});

export const MergedBcs = bcs.struct('Merged', {
  yeti_id: bcs.Address,
  owner: bcs.Address,
  level: bcs.u8(),
  elements: bcs.vector(bcs.u8()),
  variants: bcs.vector(bcs.u8()),
  mutated: bcs.bool(),
  parents: bcs.vector(bcs.Address),
});

export const ShopBcs = bcs.struct('Shop', {
  id: bcs.Address,
  egg_price: bcs.u64(),
  element_egg_price: bcs.u64(),
  snowflake_egg_price: bcs.u64(),
  merge_fee: bcs.u64(),
  skip_per_min: bcs.u64(),
  treasury: bcs.u64(),
});
