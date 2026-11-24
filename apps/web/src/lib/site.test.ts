import { afterEach, describe, expect, test, vi } from 'vitest';
import { fetchSiteMode, joinWaitlist, waitlistCsv } from './site';

afterEach(() => vi.unstubAllGlobals());

describe('site helpers', () => {
  test('the mode falls back to open when the server cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await fetchSiteMode()).toBe('open');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ mode: 'waitlist' }) }));
    expect(await fetchSiteMode()).toBe('waitlist');
  });

  test('joining reports a server message as the error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'That email doesn’t look right.' }) }));
    await expect(joinWaitlist('x')).rejects.toThrow('That email doesn’t look right.');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, already: true }) }));
    expect(await joinWaitlist('a@b.io')).toEqual({ ok: true, already: true });
  });

  test('the CSV has a header, ISO dates, and quotes any comma or quote', () => {
    const csv = waitlistCsv([{ email: 'a@b.io', at: Date.UTC(2026, 10, 20), status: 'approved' }, { email: 'we"ird,@x.io', at: 0 }]);
    expect(csv.split('\n')).toEqual(['email,joined,status', 'a@b.io,2026-11-20T00:00:00.000Z,approved', '"we""ird,@x.io",1970-01-01T00:00:00.000Z,pending']);
  });
});
