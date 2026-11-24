// @vitest-environment jsdom
import { describe, expect, test } from 'vitest';
import { parseRoute, navigate, visibleTabs, TABS, skyFor, routeParam } from './nav';

const snap = (over: object) => ({ address: '0x1', profile: { id: 'p', element: 0, snowflakes: 0n, nonce: 0n }, eggs: [], yetis: [], identity: { nickname: 'S', avatar: null }, ...over });

describe('router', () => {
  test('unknown hash falls back to egg', () => {
    expect(parseRoute('')).toBe('egg');
    expect(parseRoute('#nope')).toBe('egg');
    expect(parseRoute('#yetis')).toBe('yetis');
    expect(parseRoute('#play')).toBe('play');
  });
  test('old Den and Train links open the Yetis tab', () => {
    expect(parseRoute('#den')).toBe('yetis');
    expect(parseRoute('#train')).toBe('yetis');
  });
  test("a yeti's own page lives under the Yetis tab, so back returns to the grid", () => {
    expect(parseRoute('#yetis/0xabc')).toBe('yetis');
    expect(routeParam('#yetis/0xabc')).toBe('0xabc');
    expect(routeParam('#yetis')).toBeNull();
  });
  test('navigating updates location.hash', () => {
    navigate('yetis');
    expect(location.hash).toBe('#yetis');
    navigate('yetis', '0xabc');
    expect(location.hash).toBe('#yetis/0xabc');
  });
  test('only available tabs render', () => {
    expect(visibleTabs().map((t) => t.route)).toEqual(['egg', 'yetis', 'play', 'earn', 'shop']);
  });
});

describe('skyFor', () => {
  test('four moods across the day', () => {
    expect(skyFor(6).mood).toBe('dawn');
    expect(skyFor(13).mood).toBe('day');
    expect(skyFor(18).mood).toBe('dusk');
    expect(skyFor(23).mood).toBe('night');
    expect(skyFor(2).mood).toBe('night');
  });
  test('night uses light text on the sky', () => {
    expect(skyFor(23).ink).toBe('#FFFFFF');
    expect(skyFor(13).ink).toBe('#14213D');
  });
});
