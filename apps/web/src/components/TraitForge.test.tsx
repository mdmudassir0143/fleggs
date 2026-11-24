// @vitest-environment jsdom
import { expect, test, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { TraitForge } from './TraitForge';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const live = (score: number, extra = {}) => ({ tick: 600, score, inZone: true, gust: null, combo: 1, done: false, ...extra });
let root: Root;
async function show(stage: 0 | 1 | 2, score: number, extra = {}) {
  window.matchMedia = vi.fn((q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() })) as never;
  if (!root) { document.body.innerHTML = '<div id="h"></div>'; root = createRoot(document.getElementById('h')!); }
  await act(async () => { root.render(<TraitForge stage={stage} live={live(score, extra) as never} />); });
}

test('names the trait being formed and its live score and tier', async () => {
  await show(0, 120);
  const t = document.body.textContent!;
  expect(t).toContain('Forming its fur');
  expect(t).toContain('120');
  expect(document.querySelector('.tf-tier')!.textContent).toBe('Common');
  await show(0, 400);
  expect(document.querySelector('.tf-tier')!.textContent).toBe('Fine');
  await show(0, 700);
  expect(document.querySelector('.tf-tier')!.textContent).toBe('Rare');
});

test('each stage draws its own trait', async () => {
  await show(1, 300);
  expect(document.querySelector('.tf-art.is-horns')).toBeTruthy();
  expect(document.body.textContent).toContain('Forming its horns');
  await show(2, 300, { combo: 1.3 });
  expect(document.querySelector('.tf-art.is-power')).toBeTruthy();
  expect(document.body.textContent).toContain('×1.3');
});

test('progress drives the drawing (0 at the start, full at 1000)', async () => {
  await show(0, 0);
  expect((document.querySelector('.tf-art') as HTMLElement).style.getPropertyValue('--p')).toBe('0');
  await show(0, 1000);
  expect((document.querySelector('.tf-art') as HTMLElement).style.getPropertyValue('--p')).toBe('1');
});
