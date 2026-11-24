import { describe, expect, test } from 'vitest';
import { buildSetIdentity } from './flurry';
import { foilFor, sortYetis, tiltFromPointer, traitRows } from './den';

const y = (id: string, variants: number[]) => ({ id, level: 1, elements: [0], variants, name: id, cardUrl: '', named: true });

describe('den', () => {
  test('newest first (chain order reversed)', () => {
    expect(sortYetis([y('a', []), y('b', []), y('c', [])]).map((v) => v.id)).toEqual(['c', 'b', 'a']);
  });

  test('trait rows show band names', () => {
    expect(traitRows(y('a', [1, 6, 13]))).toEqual([
      { trait: 'Fur', band: 'Common' }, { trait: 'Horns', band: 'Fine' }, { trait: 'Power', band: 'Mutant' },
    ]);
  });

  test('foilFor picks the highest band', () => {
    expect(foilFor([0, 1, 2])).toBe('common');
    expect(foilFor([0, 5, 2])).toBe('fine');
    expect(foilFor([9, 5, 2])).toBe('rare');
    expect(foilFor([9, 14, 2])).toBe('mutant');
    expect(foilFor([])).toBe('common');
  });

  test('tiltFromPointer clamps to ±12°', () => {
    const rect = { left: 0, top: 0, width: 200, height: 300 };
    expect(tiltFromPointer(100, 150, rect)).toEqual({ rx: 0, ry: 0, px: 50, py: 50 });
    const far = tiltFromPointer(9999, -9999, rect);
    expect(far.ry).toBe(12); expect(far.rx).toBe(12);
    const corner = tiltFromPointer(0, 300, rect);
    expect(corner.ry).toBe(-12); expect(corner.rx).toBe(-12);
  });

  test('set-as-avatar builds identity::set_avatar_yeti with the yeti', () => {
    const yetiId = '0x' + 'ab'.repeat(32), profileId = '0x' + '01'.repeat(32);
    const data = buildSetIdentity(profileId, { avatar: { kind: 'yeti', yetiId } }).getData();
    const call = data.commands[0].MoveCall!;
    expect(call.module).toBe('identity');
    expect(call.function).toBe('set_avatar_yeti');
    const inputs = data.inputs.map((i) => JSON.stringify(i));
    expect(inputs.some((s) => s.includes(yetiId.slice(2)))).toBe(true);
  });
});
