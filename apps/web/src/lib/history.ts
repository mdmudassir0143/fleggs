import { fromBase64, normalizeSuiAddress } from '@mysten/sui/utils';
import { ELEMENT_NAMES } from '@flurry/art';
import { GAME_INFO } from './train';
import { sui } from './merge';

export const GRAPHQL_URL = 'https://graphql.testnet.sui.io/graphql';

/** Everything a player can buy or claim, by Move function. */
const KINDS = [
  ['shop', 'buy_egg'], ['shop', 'buy_element_egg'], ['shop', 'buy_egg_snowflakes'], ['shop', 'claim_partner_egg'],
  ['shop', 'buy_extra_play'], ['shop', 'skip_training'], ['merge', 'merge'],
] as const;

export type HistoryRow = { digest: string; fn: string; label: string; cost: string; at: number };

/** One GraphQL request per package version (Sui caps size and node count): this player's purchases. */
export function historyQuery(address: string, pkg: string): string {
  // Sui GraphQL caps a query at 5000 bytes, so the field list lives in one fragment.
  const fragment = 'fragment T on TransactionConnection{nodes{digest effects{status timestamp balanceChanges{nodes{owner{address}amount coinType{repr}}}}kind{__typename ...on ProgrammableTransaction{inputs(first:6){nodes{__typename ...on MoveValue{bcs}}}}}}}';
  const parts = KINDS.map(([mod, fn]) => `${fn}:transactions(last:20,filter:{sentAddress: "${address}",function:"${pkg}::${mod}::${fn}"}){...T}`);
  return `{${parts.join(' ')}} ${fragment}`;
}

type Node = {
  digest: string;
  effects: { status: string; timestamp: string; balanceChanges: { nodes: { owner: { address: string } | null; amount: string; coinType: { repr: string } }[] } };
  kind?: { inputs?: { nodes: { __typename: string; bcs?: string }[] } };
};

const SUI_TYPE = '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI';

type Result = { data?: Record<string, { nodes: Node[] } | null> };

/** Fetches and merges the history across package versions. */
export async function fetchHistory(address: string, packages: string[], snowflakeEggPrice: number, f: typeof fetch = fetch): Promise<HistoryRow[]> {
  const results = await Promise.all(packages.map(async (pkg) => {
    const r = await f(GRAPHQL_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: historyQuery(address, pkg) }) });
    const j = (await r.json()) as Result & { errors?: { message: string }[] };
    if (j.errors?.length) throw new Error(j.errors[0].message);
    return j;
  }));
  return parseHistory(results, address, snowflakeEggPrice);
}

export function parseHistory(json: Result | Result[], address: string, snowflakeEggPrice: number): HistoryRow[] {
  const me = normalizeSuiAddress(address);
  const seen = new Map<string, HistoryRow>();
  const groups = (Array.isArray(json) ? json : [json]).flatMap((j) => Object.entries(j.data ?? {}));
  for (const [alias, group] of groups) {
    const fn = alias.replace(/_\d+$/, '');
    for (const n of group?.nodes ?? []) {
      if (n.effects.status !== 'SUCCESS' || seen.has(n.digest)) continue;
      const firstPure = n.kind?.inputs?.nodes.find((x) => x.__typename === 'MoveValue')?.bcs;
      const byte = firstPure ? fromBase64(firstPure)[0] : 0;
      const mine = n.effects.balanceChanges.nodes.find((b) => b.owner && normalizeSuiAddress(b.owner.address) === me && b.coinType.repr === SUI_TYPE);
      const spent = mine && BigInt(mine.amount) < 0n ? -BigInt(mine.amount) : 0n;
      const label = {
        buy_egg: 'Egg', buy_element_egg: `${ELEMENT_NAMES[byte] ?? 'Element'} egg`, buy_egg_snowflakes: 'Snowflake egg',
        claim_partner_egg: 'Partner egg', buy_extra_play: `Extra ${GAME_INFO[byte]?.name ?? ''} play`.replace('  ', ' '),
        skip_training: 'Training skip', merge: 'Merge fee',
      }[fn] ?? fn;
      const cost = fn === 'buy_egg_snowflakes' ? `${snowflakeEggPrice} Snowflakes` : spent > 0n ? sui(spent) : 'Free';
      seen.set(n.digest, { digest: n.digest, fn, label, cost, at: Date.parse(n.effects.timestamp) });
    }
  }
  return [...seen.values()].sort((a, b) => b.at - a.at);
}

/** The Snowflake egg card: how close you are, and a button that says exactly what happens. */
export function snowflakeEggCopy(have: number, price: number) {
  const ready = have >= price;
  return { pct: Math.min(100, Math.floor((have / price) * 100)), button: ready ? `Trade ${price} Snowflakes` : `Need ${price - have} more`, ready };
}

export const explorerTx = (digest: string) => `https://suiscan.xyz/testnet/tx/${digest}`;
