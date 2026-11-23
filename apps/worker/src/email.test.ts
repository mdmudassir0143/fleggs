import { describe, expect, test, vi } from 'vitest';
import { approvalEmail, sendEmail } from './email';

describe('the "you\'re in" email', () => {
  test('has a clear subject, the branded image, a Play button to the game, and a plain-text version', () => {
    const m = approvalEmail({ email: 'lofi@snow.example' });
    expect(m.subject).toBe('You’re in! Your Flurry Eggs egg is waiting');
    expect(m.html).toContain('https://www.fleggs.online/email-hero.jpg');
    expect(m.html).toContain('href="https://www.fleggs.online/"');
    expect(m.html).toContain('Play now');
    expect(m.html).toContain('lofi@snow.example');
    expect(m.text).toContain('https://www.fleggs.online/');
    expect(m.text).toContain('lofi@snow.example');
  });
  test('escapes anything odd in the address', () => {
    expect(approvalEmail({ email: '<b>x</b>@y.io' }).html).not.toContain('<b>x</b>');
  });
});

describe('sending', () => {
  test('posts to Resend with the key, sender and message', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'e1' }) });
    const r = await sendEmail({ apiKey: 'k', from: 'Flurry Eggs <hello@fleggs.online>', fetch: fetch as never }, { to: 'a@b.io', subject: 's', html: '<p>h</p>', text: 't' });
    expect(r).toEqual({ ok: true, id: 'e1' });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers.Authorization).toBe('Bearer k');
    expect(JSON.parse(init.body)).toEqual({ from: 'Flurry Eggs <hello@fleggs.online>', to: ['a@b.io'], subject: 's', html: '<p>h</p>', text: 't' });
  });
  test('a Resend error is reported, not thrown', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ message: 'domain not verified' }) });
    expect(await sendEmail({ apiKey: 'k', from: 'f', fetch: fetch as never }, { to: 'a@b.io', subject: 's', html: 'h', text: 't' })).toEqual({ ok: false, error: 'domain not verified' });
  });
});
