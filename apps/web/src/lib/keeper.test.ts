import { describe, expect, test, vi } from 'vitest';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { TESTNET, validateNickname } from '@flurry/shared';
import { loadIdentity, resolveAvatar, setupReducer, initialSetup, suggestNickname } from './keeper';
import { buildSetIdentity } from './flurry';

const yeti = { id: '0x' + '0c'.repeat(32), level: 1, elements: [2], variants: [9, 6, 3], name: 'Moss', cardUrl: '', named: true };

describe('identity', () => {
  test('identity loads from chain, not local storage', async () => {
    const read = vi.fn(async () => ({ nickname: 'Snowy', avatar: { kind: 'preset' as const, preset: 9 } }));
    (globalThis as any).localStorage?.setItem?.('flurry:nickname', 'Imposter');
    expect(await loadIdentity('0xp', read)).toEqual({ nickname: 'Snowy', avatar: { kind: 'preset', preset: 9 } });
    expect(read).toHaveBeenCalledWith('0xp');
  });

  test('falls back to preset when avatar yeti not owned', () => {
    expect(resolveAvatar({ kind: 'yeti', yetiId: '0xgone' }, [yeti])).toEqual({ kind: 'preset', preset: 0 });
    expect(resolveAvatar({ kind: 'yeti', yetiId: yeti.id }, [yeti])).toEqual({ kind: 'yeti', yeti });
    expect(resolveAvatar(null, [])).toEqual({ kind: 'preset', preset: 0 });
  });
});

describe('transactions', () => {
  test('buildSetIdentity targets latestPackageId identity::set_nickname and set_avatar_preset in one PTB', () => {
    const data = buildSetIdentity('0x' + 'aa'.repeat(32), { nickname: 'Snowy', avatar: { kind: 'preset', preset: 9 } }).getData();
    const calls = data.commands.map((c: any) => c.MoveCall);
    expect(calls.map((c: any) => `${c.module}::${c.function}`)).toEqual(['identity::set_nickname', 'identity::set_avatar_preset']);
    expect(calls.every((c: any) => normalizeSuiAddress(c.package) === normalizeSuiAddress(TESTNET.latestPackageId))).toBe(true);
  });

  test('a yeti avatar uses set_avatar_yeti', () => {
    const data = buildSetIdentity('0x' + 'aa'.repeat(32), { avatar: { kind: 'yeti', yetiId: yeti.id } }).getData();
    expect((data.commands[0] as any).MoveCall.function).toBe('set_avatar_yeti');
  });
});

describe('setupReducer', () => {
  test('submit is disabled while saving', () => {
    let s = initialSetup({ needsProfile: true });
    s = setupReducer(s, { type: 'SET', nickname: 'Snowy', preset: 3, element: 1 });
    expect(s.canSubmit).toBe(true);
    s = setupReducer(s, { type: 'SUBMIT' });
    expect(s).toMatchObject({ phase: 'creating', canSubmit: false });
    expect(setupReducer(s, { type: 'SUBMIT' })).toBe(s);
  });

  test('invalid nickname blocks submit and explains why', () => {
    const s = setupReducer(initialSetup({ needsProfile: true }), { type: 'SET', nickname: 'x!', preset: 0, element: 0 });
    expect(s.canSubmit).toBe(false);
    expect(s.nicknameError).toBe('Use 2–20 letters, numbers, spaces, _ or -.');
  });

  test('existing players skip profile creation', () => {
    let s = initialSetup({ needsProfile: false });
    s = setupReducer(s, { type: 'SET', nickname: 'Snowy', preset: 3, element: null });
    expect(setupReducer(s, { type: 'SUBMIT' }).phase).toBe('naming');
  });

  test('failure returns to editing with the message', () => {
    let s = setupReducer(initialSetup({ needsProfile: true }), { type: 'SET', nickname: 'Snowy', preset: 3, element: 1 });
    s = setupReducer(setupReducer(s, { type: 'SUBMIT' }), { type: 'FAIL', error: 'nope' });
    expect(s).toMatchObject({ phase: 'editing', error: 'nope', canSubmit: true });
  });
});

test('suggestNickname always passes validateNickname', () => {
  for (let i = 0; i < 200; i++) expect(validateNickname(suggestNickname(i)).ok).toBe(true);
});
