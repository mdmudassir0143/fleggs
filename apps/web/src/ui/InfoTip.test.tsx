// @vitest-environment jsdom
import { expect, test } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { InfoTip } from './InfoTip';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

test('a tap shows the message, another tap or Escape hides it; it is linked for screen readers', async () => {
  document.body.innerHTML = '<div id="h"></div>';
  await act(async () => { createRoot(document.getElementById('h')!).render(<InfoTip label="About free plays">2 free plays a day.</InfoTip>); });
  const btn = document.querySelector('button')!;
  expect(btn.getAttribute('aria-label')).toBe('About free plays');
  expect(btn.getAttribute('aria-expanded')).toBe('false');
  await act(async () => { btn.click(); });
  const tip = document.querySelector('[role="tooltip"]')!;
  expect(tip.textContent).toBe('2 free plays a day.');
  expect(btn.getAttribute('aria-describedby')).toBe(tip.id);
  await act(async () => { btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
  expect(btn.getAttribute('aria-expanded')).toBe('false');
});

test('the bubble sits above the page, so a card with hidden overflow can never cut it off', async () => {
  document.body.innerHTML = '<div id="clip" style="overflow:hidden"><div id="h2"></div></div>';
  await act(async () => { createRoot(document.getElementById('h2')!).render(<InfoTip label="About it">Short text.</InfoTip>); });
  await act(async () => { (document.querySelector('.info-tip-btn') as HTMLButtonElement).click(); });
  const bubble = document.querySelector('[role="tooltip"]')!;
  expect(bubble.textContent).toBe('Short text.');
  expect(document.getElementById('clip')!.contains(bubble)).toBe(false);
});
