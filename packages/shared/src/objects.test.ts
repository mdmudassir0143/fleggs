import { expect, test } from 'vitest';
import { ProfileBcs, EggBcs } from './objects';

test('Profile layout reads nonce after id, element, snowflakes, streak, last_daily_day', () => {
  const bytes = ProfileBcs.serialize({
    id: '0x' + '11'.repeat(32), element: 2, snowflakes: 81n, streak: 0, last_daily_day: 0n, nonce: 3n,
  }).toBytes();
  expect(bytes.length).toBe(32 + 1 + 8 + 1 + 8 + 8);
  expect(ProfileBcs.parse(bytes).nonce).toBe('3');
});

test('Egg layout reads element and stage scores', () => {
  const bytes = EggBcs.serialize({ id: '0x' + '22'.repeat(32), element: 1, stage_scores: [812, 500] }).toBytes();
  expect(EggBcs.parse(bytes).stage_scores).toEqual([812, 500]);
});

import { YetiBcs } from './objects';

test('Yeti layout round-trips level, elements, traits and name', () => {
  const v = {
    id: '0x' + '33'.repeat(32), level: 1, elements: [2],
    traits: [{ slot: 0, variant: 9, points: 0 }, { slot: 1, variant: 4, points: 0 }, { slot: 2, variant: 13, points: 0 }],
    name: 'Unnamed Yeti', card_url: '', lore_blob: null, card_blob: null, parents: [],
  };
  const parsed = YetiBcs.parse(YetiBcs.serialize(v).toBytes());
  expect(parsed.level).toBe(1);
  expect(parsed.traits.map((t) => t.variant)).toEqual([9, 4, 13]);
  expect(parsed.name).toBe('Unnamed Yeti');
});
