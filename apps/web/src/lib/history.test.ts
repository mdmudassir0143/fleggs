import { describe, expect, test } from 'vitest';
import { historyQuery, parseHistory, snowflakeEggCopy } from './history';

const ME = '0x' + 'aa'.repeat(32);
const SPONSOR = '0x' + '5d'.repeat(32);
const SUI = '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI';
const tx = (digest: string, at: string, mine: string, firstPure?: string, status = 'SUCCESS') => ({
  digest,
  effects: { status, timestamp: at, balanceChanges: { nodes: [
    { owner: { address: SPONSOR }, amount: '-3234810', coinType: { repr: SUI } },
    ...(mine ? [{ owner: { address: ME }, amount: mine, coinType: { repr: SUI } }] : []),
  ] } },
  kind: { __typename: 'ProgrammableTransaction', inputs: { nodes: [{ __typename: 'SharedInput' }, ...(firstPure ? [{ __typename: 'MoveValue', bcs: firstPure }] : [])] } },
});

describe('shop history', () => {
  test('one aliased query per purchase kind, for this player only, within Sui limits', () => {
    const q = historyQuery(ME, '0x' + 'ab'.repeat(32));
    expect(q).toContain(`sentAddress: "${ME}"`);
    expect(q).toContain('::shop::buy_extra_play');
    expect(q).toContain('::merge::merge');
    expect(q.match(/transactions\(/g)!.length).toBe(7);
    expect(q.length).toBeLessThan(5000);
  });

  test('rows: newest first, what was bought, and what it cost the player (not the sponsored gas)', () => {
    const json = { data: {
      buy_extra_play_0: { nodes: [tx('d1', '2026-11-19T16:37:12Z', '-20000000', 'AA==')] },
      buy_element_egg_1: { nodes: [tx('d2', '2026-11-19T18:00:00Z', '-1000000000', 'Aw==')] },
      buy_egg_snowflakes_0: { nodes: [tx('d3', '2026-11-18T10:00:00Z', '')] },
      claim_partner_egg_0: { nodes: [tx('d4', '2026-11-17T10:00:00Z', '')] },
      skip_training_0: { nodes: [tx('d5', '2026-11-16T10:00:00Z', '-30000000', undefined, 'FAILURE')] },
    } };
    const rows = parseHistory(json, ME, 400);
    expect(rows.map((r) => r.digest)).toEqual(['d2', 'd1', 'd3', 'd4']); // failed tx dropped
    expect(rows[0]).toMatchObject({ label: 'Ember egg', cost: '1 SUI', at: Date.parse('2026-11-19T18:00:00Z') });
    expect(rows[1]).toMatchObject({ label: 'Extra Keep It Warm play', cost: '0.02 SUI' });
    expect(rows[2]).toMatchObject({ label: 'Snowflake egg', cost: '400 Snowflakes' });
    expect(rows[3]).toMatchObject({ label: 'Partner egg', cost: 'Free' });
  });

  test('the same transaction seen under two packages appears once', () => {
    const json = { data: { buy_egg_0: { nodes: [tx('d1', '2026-11-19T10:00:00Z', '-500000000')] }, buy_egg_1: { nodes: [tx('d1', '2026-11-19T10:00:00Z', '-500000000')] } } };
    expect(parseHistory(json, ME, 400)).toHaveLength(1);
  });
});

describe('Snowflake egg copy', () => {
  test('says what you trade, what you get and how far you are', () => {
    expect(snowflakeEggCopy(297, 400)).toEqual({ pct: 74, button: 'Need 103 more', ready: false });
    expect(snowflakeEggCopy(450, 400)).toEqual({ pct: 100, button: 'Trade 400 Snowflakes', ready: true });
  });
});
