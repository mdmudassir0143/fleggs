// @vitest-environment jsdom
import { expect, test, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { LofiThinking } from './LofiThinking';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const mm = (reduce: boolean) => vi.fn((q: string) => ({ matches: reduce && q.includes('reduce'), media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() })) as never;

test('announces one steady status; the trial names are decoration; steps move on', async () => {
  vi.useFakeTimers();
  window.matchMedia = mm(false);
  document.body.innerHTML = '<div id="h"></div>';
  await act(async () => { createRoot(document.getElementById('h')!).render(<LofiThinking />); });
  const status = document.querySelector('[role="status"]')!;
  expect(status.textContent).toContain('Lofi is thinking of a name');
  expect(document.querySelector('.lt-bubble')!.getAttribute('aria-hidden')).toBe('true');
  expect(document.querySelector('.lt-step.is-on')!.textContent).toContain('Picking a name');
  await act(async () => { vi.advanceTimersByTime(4000); });
  expect(document.querySelector('.lt-step.is-on')!.textContent).toContain('Writing its story');
  vi.useRealTimers();
});

test('reduced motion: no names flicker in the bubble', async () => {
  window.matchMedia = mm(true);
  document.body.innerHTML = '<div id="h"></div>';
  await act(async () => { createRoot(document.getElementById('h')!).render(<LofiThinking />); });
  expect(document.querySelector('.lt-name')).toBeNull();
});

test('never shows a trial name: the bubble only thinks, the real name comes with the reveal', async () => {
  vi.useFakeTimers();
  window.matchMedia = mm(false);
  document.body.innerHTML = '<div id="h"></div>';
  await act(async () => { createRoot(document.getElementById('h')!).render(<LofiThinking />); });
  for (const t of [300, 1500, 4000]) {
    await act(async () => { vi.advanceTimersByTime(t); });
    expect(document.querySelector('.lt-name')).toBeNull();
    expect(document.querySelector('.lt-dots')).toBeTruthy();
  }
  vi.useRealTimers();
});
