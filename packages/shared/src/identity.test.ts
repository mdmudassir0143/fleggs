import { describe, expect, test } from 'vitest';
import { AvatarBcs, DENY, validateNickname } from './identity';

describe('validateNickname', () => {
  test("accepts 'Mudassir_01' and 'Snow drift-2'", () => {
    expect(validateNickname('Mudassir_01')).toEqual({ ok: true });
    expect(validateNickname('Snow drift-2')).toEqual({ ok: true });
  });
  test('rejects 1 and 21 chars', () => {
    expect(validateNickname('A')).toEqual({ ok: false, reason: 'length' });
    expect(validateNickname('A'.repeat(21))).toEqual({ ok: false, reason: 'length' });
  });
  test('rejects emoji and punctuation', () => {
    expect(validateNickname('snow❄')).toMatchObject({ ok: false });
    expect(validateNickname('hey!')).toEqual({ ok: false, reason: 'chars' });
  });
  test('rejects leading/trailing space', () => {
    expect(validateNickname(' Snowy')).toEqual({ ok: false, reason: 'chars' });
    expect(validateNickname('Snowy ')).toEqual({ ok: false, reason: 'chars' });
  });
  test('rejects deny-list words', () => {
    expect(validateNickname('stupid yeti')).toEqual({ ok: false, reason: 'blocked' });
    for (const ok of ['hello', 'assist', 'diet', 'class', 'Hellen', 'shell']) expect(DENY.test(ok)).toBe(false);
    for (const bad of ['damned', 'kills', 'hating', 'idiots']) expect(DENY.test(bad)).toBe(true);
  });
  test('byte length is what counts (matches Move)', () => {
    expect(validateNickname('é'.repeat(2))).toEqual({ ok: false, reason: 'chars' });
  });
});

test('Avatar layout reads kind, preset and optional yeti id', () => {
  const bytes = AvatarBcs.serialize({ kind: 1, preset: 0, yeti: '0x' + '0c'.repeat(32) }).toBytes();
  expect(AvatarBcs.parse(bytes)).toMatchObject({ kind: 1, preset: 0 });
});
