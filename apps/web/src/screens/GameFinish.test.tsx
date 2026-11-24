// @vitest-environment jsdom
import { expect, test, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { GameFinish } from './GameFinish';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

test('finish announces score via aria-live', async () => {
  window.matchMedia = vi.fn((q: string) => ({ matches: q.includes('reduce'), media: q, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() })) as never;
  const host = document.createElement('div');
  document.body.appendChild(host);
  await act(async () => { createRoot(host).render(<GameFinish score={812} snowflakes={0} saving error={null} onRetry={() => {}} />); });
  const live = host.querySelector('[aria-live="polite"]')!;
  expect(live.textContent).toContain('812');
  expect(live.textContent).toContain('Perfect');
  expect(host.textContent).toContain('Saving');
});

import { snowflakeTarget } from './GameFinish';
test('snowflakes fly to the counter that is actually on screen', () => {
  document.body.innerHTML = '<span data-counter="snowflakes" id="top"></span><span data-counter="snowflakes-side" id="side"></span>';
  const rect = (w: number) => () => ({ width: w, height: w, left: 0, top: 0, right: w, bottom: w, x: 0, y: 0, toJSON: () => {} }) as DOMRect;
  document.getElementById('top')!.getBoundingClientRect = rect(0); // hidden top bar on desktop
  document.getElementById('side')!.getBoundingClientRect = rect(40);
  expect(snowflakeTarget()!.id).toBe('side');
});

test('the scoreboard animates in once, even when the saved Snowflakes arrive later', async () => {
  const gs = await import('../motion/gsap');
  const spy = vi.spyOn(gs, 'motionContext');
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(<GameFinish score={812} snowflakes={0} saving error={null} onRetry={() => {}} />); });
  await act(async () => { root.render(<GameFinish score={812} snowflakes={16} saving error={null} onRetry={() => {}} />); });
  await act(async () => { root.render(<GameFinish score={812} snowflakes={16} saving={false} error={null} onRetry={() => {}} />); });
  expect(spy).toHaveBeenCalledTimes(1);
});
