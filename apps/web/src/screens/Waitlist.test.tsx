// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ComingSoon, Waitlist } from './Waitlist';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => vi.unstubAllGlobals());

async function render(el: JSX.Element) {
  document.body.innerHTML = '<div id="h"></div>';
  await act(async () => { createRoot(document.getElementById('h')!).render(el); });
}
const type = async (v: string) => {
  const i = document.querySelector('input[type="email"]') as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(i, v);
    i.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const submit = async () => { await act(async () => { (document.querySelector('form') as HTMLFormElement).requestSubmit(); }); await act(async () => {}); };

test('joining the waitlist thanks you, and says so if you were already on it', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, already: false }) }));
  await render(<Waitlist />);
  expect(document.querySelector('h1')!.textContent).toBe('Join the waitlist');
  await type('lofi@yeti.example');
  await submit();
  expect(document.body.textContent).toContain('You’re on the list!');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, already: true }) }));
  await render(<Waitlist />);
  await type('lofi@yeti.example');
  await submit();
  expect(document.body.textContent).toContain('You’re already on the list.');
});

test('a refused email shows why, in an alert', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'That email doesn’t look right.' }) }));
  await render(<Waitlist />);
  await type('lofi@yeti.example');
  await submit();
  expect(document.querySelector('[role="alert"]')!.textContent).toBe('That email doesn’t look right.');
});

test('coming soon points to the waitlist and X', async () => {
  await render(<ComingSoon />);
  expect(document.querySelector('h1')!.textContent).toBe('Coming soon');
  expect(document.querySelector('a[href="#waitlist"]')).toBeTruthy();
  expect(document.querySelector('a[href="https://x.com/Flurry_eggs"]')).toBeTruthy();
});
