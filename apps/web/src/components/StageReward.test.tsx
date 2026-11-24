// @vitest-environment jsdom
import { expect, test, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { StageReward } from './StageReward';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function mount(stage: 0 | 1 | 2, score: number, onNext = vi.fn()) {
  window.matchMedia = vi.fn((q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() })) as never;
  document.body.innerHTML = '<div id="h"></div>';
  await act(async () => { createRoot(document.getElementById('h')!).render(<StageReward stage={stage} score={score} onNext={onNext} />); });
  return onNext;
}

test('shows the unlocked trait with its tier and score', async () => {
  await mount(1, 712);
  const t = document.body.textContent!;
  expect(t).toContain('Trait unlocked');
  expect(t).toContain('Horns');
  expect(t).toContain('Rare');
  expect(t).toContain('712');
});

test('offers the next stage, or hatching after the last one', async () => {
  const next = await mount(0, 420);
  const btn = document.querySelector('button')!;
  expect(btn.textContent).toBe('Warm the next stage');
  await act(async () => { btn.click(); });
  expect(next).toHaveBeenCalledTimes(1);
  await mount(2, 120);
  expect(document.querySelector('button')!.textContent).toBe('Get ready to hatch');
  expect(document.body.textContent).toContain('Common');
});

test('keyboard focus lands on the next action', async () => {
  await mount(0, 500);
  expect(document.activeElement?.textContent).toBe('Warm the next stage');
});
