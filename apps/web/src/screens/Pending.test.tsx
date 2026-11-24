// @vitest-environment jsdom
import { expect, test, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Pending } from './Pending';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
async function render(el: JSX.Element) { document.body.innerHTML = '<div id="h"></div>'; await act(async () => { createRoot(document.getElementById('h')!).render(el); }); }
const btn = (t: RegExp) => Array.from(document.querySelectorAll('button')).find((b) => t.test(b.textContent ?? '')) as HTMLButtonElement;

test('waiting for approval shows the email and offers to check again or sign out', async () => {
  const recheck = vi.fn(), signOut = vi.fn();
  await render(<Pending email="lofi@snow.example" resign={false} onRecheck={recheck} onSignOut={signOut} />);
  expect(document.querySelector('h1')!.textContent).toBe('You’re on the waitlist');
  expect(document.body.textContent).toContain('lofi@snow.example');
  expect(document.body.textContent).toContain('Waiting for approval');
  await act(async () => { btn(/Check again/).click(); });
  await act(async () => { btn(/Sign out/).click(); });
  expect(recheck).toHaveBeenCalledOnce();
  expect(signOut).toHaveBeenCalledOnce();
});

test('an old session is asked to sign in again', async () => {
  await render(<Pending email={null} resign onRecheck={vi.fn()} onSignOut={vi.fn()} />);
  expect(document.querySelector('h1')!.textContent).toBe('Sign in again');
  expect(btn(/Sign out/)).toBeTruthy();
});
