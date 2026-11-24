import { Transaction, coinWithBalance } from '@mysten/sui/transactions';
import type { SuiGrpcClient } from '@mysten/sui/grpc';
import { fromBase64, normalizeSuiAddress } from '@mysten/sui/utils';
import type { LoreResult } from './reveal';
import { TESTNET, ProfileBcs, EggBcs, YetiBcs, ShopBcs, readTraining, readListings, readStakes, type PlayerAvatar, type TrainingState } from '@flurry/shared';

export type Profile = { id: string; element: number; snowflakes: bigint; nonce: bigint; streak?: number; lastDailyDay?: number };
export type Egg = { id: string; element: number; stageScores: number[] };

const type = (s: string) => `${TESTNET.packageId}::${s}`;

export function buildCreateProfile(element: number): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: type('onboard::create_profile'),
    arguments: [tx.object(TESTNET.registryId), tx.object(TESTNET.gameConfigId), tx.pure.u8(element)],
  });
  return tx;
}

async function owned(client: SuiGrpcClient, owner: string, struct: string) {
  const { objects } = await client.core.listOwnedObjects({ owner, type: type(struct), include: { content: true } });
  return objects;
}

export async function getMyProfile(client: SuiGrpcClient, owner: string): Promise<Profile | null> {
  const [o] = await owned(client, owner, 'profile::Profile');
  if (!o) return null;
  const p = ProfileBcs.parse(o.content);
  return { id: o.objectId, element: p.element, snowflakes: BigInt(p.snowflakes), nonce: BigInt(p.nonce), streak: p.streak, lastDailyDay: Number(p.last_daily_day) };
}

export async function getMyEggs(client: SuiGrpcClient, owner: string): Promise<Egg[]> {
  return (await owned(client, owner, 'egg::Egg')).map((o) => {
    const e = EggBcs.parse(o.content);
    return { id: o.objectId, element: e.element, stageScores: e.stage_scores };
  });
}

export type Yeti = {
  id: string; level: number; elements: number[]; variants: number[]; name: string; cardUrl: string; named: boolean;
  /** Trait points per slot (same order as variants). */
  points?: number[];
  /** Training in progress, read from the yeti's dynamic field. */
  training?: TrainingState | null;
};

/** A Yeti from its object's BCS content. */
export function yetiFromContent(objectId: string, content: Uint8Array): Yeti {
  const y = YetiBcs.parse(content);
  return {
    id: objectId, level: y.level, elements: y.elements, variants: y.traits.map((t) => t.variant),
    points: y.traits.map((t) => t.points),
    name: y.name, cardUrl: y.card_url, named: y.lore_blob !== null,
  };
}

export async function getMyYetis(client: SuiGrpcClient, owner: string): Promise<Yeti[]> {
  const objs = await owned(client, owner, 'yeti::Yeti');
  return Promise.all(objs.map(async (o) => ({ ...yetiFromContent(o.objectId, o.content), training: await readTraining(client, o.objectId) })));
}

/** Yetis held on the player's behalf: listed on the Market, or in the Lodge. */
export type Held = { yeti: Yeti; where: 'listed' | 'staked' | 'unstaking'; price?: bigint; unlockMs?: number; weight?: number };

export async function getMyHeld(client: SuiGrpcClient, owner: string): Promise<Held[]> {
  const { fetchEarnState, heldFrom } = await import('./useEarn');
  try {
    return await heldFrom(await fetchEarnState(), owner, client as never);
  } catch {
    // game server unreachable: read the chain directly
    const [listings, stakes] = await Promise.all([readListings(client).catch(() => []), readStakes(client).catch(() => [])]);
    return heldFrom({ listings, stakes } as never, owner, client as never);
  }
}

type Attested = { score: number; snowflakes: bigint; expiresMs: bigint; signature: string };
const latest = (s: string) => `${TESTNET.latestPackageId}::${s}`;

function attestedArgs(tx: Transaction, game: number, a: Attested) {
  return [tx.pure.u8(game), tx.pure.u32(a.score), tx.pure.u64(a.snowflakes), tx.pure.u64(a.expiresMs), tx.pure.vector('u8', fromBase64(a.signature))];
}

/** Credits a free training run's Snowflakes. */
export function buildEarn(profileId: string, game: number, a: Attested): Transaction {
  const tx = new Transaction();
  tx.moveCall({ target: latest('training::earn'), arguments: [tx.object(profileId), tx.object(TESTNET.gameConfigId), ...attestedArgs(tx, game, a), tx.object.clock()] });
  return tx;
}

/** Pays Snowflakes and starts the timer for +1 point on `slot`. */
export function buildStartTraining(yetiId: string, profileId: string, slot: number): Transaction {
  const tx = new Transaction();
  tx.moveCall({ target: latest('training::start'), arguments: [tx.object(yetiId), tx.object(profileId), tx.object(TESTNET.gameConfigId), tx.pure.u8(slot), tx.object.clock()] });
  return tx;
}

/** Collects the point once the timer is done. */
export function buildFinishTraining(yetiId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({ target: latest('training::finish'), arguments: [tx.object(yetiId), tx.object.clock()] });
  return tx;
}

/** Records today's run: streak +1, and a free egg on the 7th day in a row. */
export function buildSubmitDaily(profileId: string, game: number, a: Attested): Transaction {
  const tx = new Transaction();
  tx.moveCall({ target: latest('daily::submit'), arguments: [tx.object(profileId), tx.object(TESTNET.gameConfigId), ...attestedArgs(tx, game, a), tx.object.clock()] });
  return tx;
}

/** Writes the AI name and Walrus card onto the yeti (new function in the upgraded package). */
export function buildAttachLore(yetiId: string, l: LoreResult): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${TESTNET.latestPackageId}::yeti::attach_lore`,
    arguments: [
      tx.object(yetiId),
      tx.object(TESTNET.gameConfigId),
      tx.pure.string(l.name),
      tx.pure.string(l.loreBlob),
      tx.pure.string(l.cardBlob),
      tx.pure.string(l.cardUrl),
      tx.pure.u64(l.expiresMs),
      tx.pure.vector('u8', fromBase64(l.signature)),
      tx.object.clock(),
    ],
  });
  return tx;
}

/** Nickname and/or avatar in one sponsored transaction (flurry::identity, upgraded package). */
export function buildSetIdentity(profileId: string, v: { nickname?: string; avatar?: PlayerAvatar }): Transaction {
  const tx = new Transaction();
  const pkg = TESTNET.latestPackageId;
  if (v.nickname !== undefined) {
    tx.moveCall({ target: `${pkg}::identity::set_nickname`, arguments: [tx.object(profileId), tx.pure.string(v.nickname)] });
  }
  if (v.avatar?.kind === 'preset') {
    tx.moveCall({ target: `${pkg}::identity::set_avatar_preset`, arguments: [tx.object(profileId), tx.pure.u8(v.avatar.preset)] });
  } else if (v.avatar?.kind === 'yeti') {
    tx.moveCall({ target: `${pkg}::identity::set_avatar_yeti`, arguments: [tx.object(profileId), tx.object(v.avatar.yetiId)] });
  }
  return tx;
}


// ── Shop, eggs and merge (Plan 5) ──────────────────────────────────────────────────────────
// Payments come from the player's own SUI (coinWithBalance, never the sponsor's gas coin).
const pay = (amount: bigint) => coinWithBalance({ balance: amount, useGasCoin: false });

export function buildBuyEgg(profileId: string, price: bigint): Transaction {
  const tx = new Transaction();
  tx.moveCall({ target: latest('shop::buy_egg'), arguments: [tx.object(TESTNET.shopId), tx.object(profileId), pay(price)] });
  return tx;
}

export function buildBuyElementEgg(profileId: string, element: number, price: bigint): Transaction {
  const tx = new Transaction();
  tx.moveCall({ target: latest('shop::buy_element_egg'), arguments: [tx.object(TESTNET.shopId), tx.object(profileId), tx.pure.u8(element), pay(price)] });
  return tx;
}

export function buildBuySnowflakeEgg(profileId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({ target: latest('shop::buy_egg_snowflakes'), arguments: [tx.object(TESTNET.shopId), tx.object(profileId)] });
  return tx;
}

export function buildClaimPartnerEgg(profileId: string, yetiId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({ target: latest('shop::claim_partner_egg'), arguments: [tx.object(profileId), tx.object(yetiId)] });
  return tx;
}

/** One extra training play for a game (after today's two free ones). */
export function buildBuyExtraPlay(profileId: string, game: number, price: bigint): Transaction {
  const tx = new Transaction();
  tx.moveCall({ target: latest('shop::buy_extra_play'), arguments: [tx.object(TESTNET.shopId), tx.object(profileId), tx.pure.u8(game), pay(price)] });
  return tx;
}

export function buildSkipTraining(yetiId: string, price: bigint): Transaction {
  const tx = new Transaction();
  tx.moveCall({ target: latest('shop::skip_training'), arguments: [tx.object(yetiId), tx.object(TESTNET.shopId), pay(price), tx.object.clock()] });
  return tx;
}

/** Merge two maxed yetis; `picks[i]` = 0 keeps the first yeti's trait in slot i, 1 the second's. */
export function buildMerge(a: string, b: string, picks: number[], fee: bigint): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: latest('merge::merge'),
    arguments: [tx.object(a), tx.object(b), tx.pure.vector('u8', picks), tx.object(TESTNET.shopId), pay(fee), tx.object.random()],
  });
  return tx;
}

export type Shop = { eggPrice: bigint; elementEggPrice: bigint; snowflakeEggPrice: number; mergeFee: bigint; skipPerMin: bigint };

export async function getShop(client: SuiGrpcClient): Promise<Shop> {
  const { object } = await client.core.getObject({ objectId: TESTNET.shopId, include: { content: true } });
  const s = ShopBcs.parse(object.content);
  return { eggPrice: BigInt(s.egg_price), elementEggPrice: BigInt(s.element_egg_price), snowflakeEggPrice: Number(s.snowflake_egg_price), mergeFee: BigInt(s.merge_fee), skipPerMin: BigInt(s.skip_per_min) };
}

/** The player's spendable SUI (coins + address balance), in MIST. */
export async function getSuiBalance(client: SuiGrpcClient, owner: string): Promise<bigint> {
  const { balance } = await client.core.getBalance({ owner });
  return BigInt(balance.balance);
}

/** Whether this profile already claimed its one partner egg. */
export async function getPartnerClaimed(client: SuiGrpcClient, profileId: string): Promise<boolean> {
  try {
    await client.core.getDynamicField({ parentId: profileId, name: { type: `${TESTNET.shopTypesId}::shop::PartnerKey`, bcs: new Uint8Array([0]) } });
    return true;
  } catch { return false; }
}

const id = (tx: Transaction, v: string) => tx.pure.id(v);

/** Sell a yeti to the treasury (it's burned). Aborts if the price fell below `minPaid`, the amount the player confirmed. */
export function buildSellToTreasury(yetiId: string, minPaid: bigint): Transaction {
  const tx = new Transaction();
  tx.moveCall({ target: latest('earn::sell_to_treasury_min'), arguments: [tx.object(TESTNET.shopId), tx.object(yetiId), tx.pure.u64(minPaid)] });
  return tx;
}

export function buildList(yetiId: string, price: bigint): Transaction {
  const tx = new Transaction();
  tx.moveCall({ target: latest('market::list'), arguments: [tx.object(TESTNET.marketId), tx.object(yetiId), tx.pure.u64(price), tx.object.clock()] });
  return tx;
}

export function buildDelist(yetiId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({ target: latest('market::delist'), arguments: [tx.object(TESTNET.marketId), id(tx, yetiId)] });
  return tx;
}

export function buildSetPrice(yetiId: string, price: bigint): Transaction {
  const tx = new Transaction();
  tx.moveCall({ target: latest('market::set_price'), arguments: [tx.object(TESTNET.marketId), id(tx, yetiId), tx.pure.u64(price)] });
  return tx;
}

export function buildBuyListing(yetiId: string, price: bigint): Transaction {
  const tx = new Transaction();
  tx.moveCall({ target: latest('market::buy'), arguments: [tx.object(TESTNET.marketId), tx.object(TESTNET.shopId), id(tx, yetiId), pay(price)] });
  return tx;
}

export function buildStake(yetiId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({ target: latest('lodge::stake'), arguments: [tx.object(TESTNET.lodgeId), tx.object(TESTNET.shopId), tx.object(yetiId), tx.object.clock()] });
  return tx;
}

export function buildRequestUnstake(yetiId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({ target: latest('lodge::request_unstake'), arguments: [tx.object(TESTNET.lodgeId), tx.object(TESTNET.shopId), id(tx, yetiId), tx.object.clock()] });
  return tx;
}

export function buildWithdraw(yetiId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({ target: latest('lodge::withdraw'), arguments: [tx.object(TESTNET.lodgeId), id(tx, yetiId), tx.object.clock()] });
  return tx;
}


/** Your one claim for the day: everything owed across all your staked yetis. */
export function buildClaimAll(yetiIds: string[]): Transaction {
  const tx = new Transaction();
  tx.moveCall({ target: latest('lodge::claim_all'), arguments: [tx.object(TESTNET.lodgeId), tx.object(TESTNET.shopId), tx.pure.vector('id', yetiIds), tx.object.clock()] });
  return tx;
}
