import { readListings, readLodge, readSales, readStakes, readTotals, readTreasury, readWeekClaimed, readWeekSynced } from '@flurry/shared';
import { createSuiClient } from '../chain';

/** JSON with bigints as strings. */
export const serialize = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x));

type Cacheish = { match(r: Request): Promise<Response | undefined>; put(r: Request, res: Response): Promise<void> };

/**
 * Serve `load()` from the edge cache for `ttl` seconds, so many players share one chain read.
 * `fresh` (after a player's own action) skips the cache and refreshes it.
 */
export async function cachedJson(url: string, ttl: number, fresh: boolean, load: () => Promise<unknown>, cache: Cacheish): Promise<Response> {
  const key = new Request(url.split('?')[0]);
  if (!fresh) {
    const hit = await cache.match(key);
    if (hit) return hit;
  }
  const res = new Response(serialize(await load()), { headers: { 'content-type': 'application/json', 'cache-control': `public, max-age=${ttl}` } });
  await cache.put(key, res.clone());
  return res;
}

/** Everything the Earn tab needs, in one read: treasury, Lodge, listings, stakes, totals, this week's pot, recent sales. */
export async function loadEarnState() {
  const client = createSuiClient();
  const [treasury, lodge, listings, stakes, totals, weekSynced, claimedWeek, sales] = await Promise.all([
    readTreasury(client), readLodge(client), readListings(client), readStakes(client), readTotals(client),
    readWeekSynced().catch(() => 0n), readWeekClaimed().catch(() => 0n), readSales().catch(() => []),
  ]);
  // weekPot: paid into the stakers' pool this week (shared out + still in the shop's pot)
  return { at: Date.now(), treasury, lodge, listings, stakes, totals, weekPot: weekSynced + treasury.pot, claimedWeek, sales };
}
