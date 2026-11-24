// @vitest-environment jsdom
import { expect, test } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Footer } from './Footer';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

test('the footer credits the inspiration and links to X, privacy and terms', async () => {
  document.body.innerHTML = '<div id="h"></div>';
  await act(async () => { createRoot(document.getElementById('h')!).render(<Footer />); });
  expect(document.body.textContent).toContain('A fan-made game inspired by Lofi the Yeti');
  const x = document.querySelector('a[aria-label="Flurry Eggs on X"]') as HTMLAnchorElement;
  expect(x.href).toBe('https://x.com/Flurry_eggs');
  expect(x.target).toBe('_blank');
  expect(x.rel).toContain('noopener');
  expect(document.querySelector('a[href="/privacy.html"]')).toBeTruthy();
  expect(document.querySelector('a[href="/terms.html"]')).toBeTruthy();
});
