// @vitest-environment jsdom
import { expect, test } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { BootLoader } from './BootLoader';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

test('a full-screen egg loader that announces one status', async () => {
  document.body.innerHTML = '<div id="h"></div>';
  await act(async () => { createRoot(document.getElementById('h')!).render(<BootLoader label="Finding your eggs…" />); });
  const status = document.querySelector('[role="status"]')!;
  expect(status.textContent).toContain('Finding your eggs…');
  expect(document.querySelector('.boot-egg svg')).toBeTruthy();
  expect(document.querySelector('.boot-scene')!.getAttribute('aria-hidden')).toBe('true');
});
