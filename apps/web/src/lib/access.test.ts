import { describe, expect, test, vi } from 'vitest';
import { resolveAccess } from './access';

describe('what a signed-in player is allowed to see', () => {
  test('allowed players go straight in', async () => {
    const link = vi.fn();
    expect(await resolveAccess({ status: async () => ({ allowed: true, linked: true }), getJwt: async () => 'jwt', link })).toEqual({ kind: 'allowed' });
    expect(link).not.toHaveBeenCalled();
  });
  test('a new account links its Google email and waits if not approved', async () => {
    const r = await resolveAccess({ status: async () => ({ allowed: false, linked: false }), getJwt: async () => 'jwt', link: async () => ({ email: 'a@b.io', status: 'pending' as const }) });
    expect(r).toEqual({ kind: 'pending', email: 'a@b.io' });
  });
  test('…or goes in if that email was already approved', async () => {
    const r = await resolveAccess({ status: async () => ({ allowed: false, linked: false }), getJwt: async () => 'jwt', link: async () => ({ email: 'a@b.io', status: 'approved' as const }) });
    expect(r).toEqual({ kind: 'allowed' });
  });
  test('a linked account that is not approved waits (no new link needed)', async () => {
    const link = vi.fn();
    expect(await resolveAccess({ status: async () => ({ allowed: false, linked: true }), getJwt: async () => 'jwt', link })).toEqual({ kind: 'pending', email: null });
    expect(link).not.toHaveBeenCalled();
  });
  test('an old session without a usable Google token asks to sign in again', async () => {
    const r = await resolveAccess({ status: async () => ({ allowed: false, linked: false }), getJwt: async () => null, link: vi.fn() });
    expect(r).toEqual({ kind: 'resign' });
    const r2 = await resolveAccess({ status: async () => ({ allowed: false, linked: false }), getJwt: async () => 'old', link: async () => { throw new Error('Sign in again to check your access.'); } });
    expect(r2).toEqual({ kind: 'resign' });
  });
  test('if the server cannot be reached, let them in (the server still enforces)', async () => {
    expect(await resolveAccess({ status: async () => { throw new Error('offline'); }, getJwt: async () => null, link: vi.fn() })).toEqual({ kind: 'allowed' });
  });
});
