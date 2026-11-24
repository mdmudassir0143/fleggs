import { describe, expect, test } from 'vitest';
import { DAY_MS } from '@flurry/shared';
import { nextEggPaths, SNOWFLAKE_EGG_PRICE } from './home';

const DAY = 20_001;
const now = DAY * DAY_MS + 3_600_000;
const y = (o: object = {}) => ({ id: 'y', level: 1, elements: [0], variants: [1, 1, 1], name: 'Moss', cardUrl: '', named: true, points: [0, 0, 0], training: null, ...o });
const snap = (o: object = {}) => ({ address: '0x1', profile: { id: 'p', element: 0, snowflakes: 120n, nonce: 0n, streak: 3, lastDailyDay: DAY - 1 }, eggs: [], yetis: [y()], ...o });

describe('home: next egg', () => {
  test('next egg paths show streak and Snowflake progress', () => {
    const p = nextEggPaths(snap() as never, now);
    expect(p.map((x) => x.id)).toEqual(['streak', 'snowflakes', 'shop']);
    expect(p[0]).toMatchObject({ value: 3, max: 7 });
    expect(p[1]).toMatchObject({ value: 120, max: SNOWFLAKE_EGG_PRICE, soon: false });
    expect(p[2].soon).toBe(false);
  });
});


import { partnerCandidate, skipPrice, snowflakeEggReady } from './home';

describe('getting eggs', () => {
  test('Snowflake egg button is enabled at the price', () => {
    expect(snowflakeEggReady(399, 400)).toBe(false);
    expect(snowflakeEggReady(400, 400)).toBe(true);
  });
  test('partner egg is offered only with a merge-ready yeti and before it was claimed', () => {
    const ready = y({ id: 'g', name: 'Glimmer', points: [2, 2, 2] });
    expect(partnerCandidate([y()], false)).toBeNull();
    expect(partnerCandidate([y(), ready], false)?.name).toBe('Glimmer');
    expect(partnerCandidate([ready], true)).toBeNull();
  });
  test('skip costs per started minute left', () => {
    expect(skipPrice(90_000, 10_000_000n)).toBe(20_000_000n);
    expect(skipPrice(60_000, 10_000_000n)).toBe(10_000_000n);
    expect(skipPrice(1, 10_000_000n)).toBe(10_000_000n);
    expect(skipPrice(0, 10_000_000n)).toBe(0n);
  });
});
