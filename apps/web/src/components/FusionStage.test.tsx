// @vitest-environment jsdom
import { expect, test, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { FusionStage } from './FusionStage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const y = (id: string, el: number) => ({ id, level: 1, elements: [el], variants: [1, 2, 3], name: id, cardUrl: '', named: true, points: [0, 0, 0], training: null });

async function mount(done: boolean, onFused: () => void, root?: Root) {
  window.matchMedia = vi.fn((q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() })) as never;
  if (!root) { document.body.innerHTML = '<div id="h"></div>'; root = createRoot(document.getElementById('h')!); }
  await act(async () => { root!.render(<FusionStage a={y('a', 0) as never} b={y('b', 1) as never} done={done} onFused={onFused} />); });
  return root;
}

test('shows both yetis and a status while the merge is pending', async () => {
  const onFused = vi.fn();
  await mount(false, onFused);
  expect(document.body.textContent).toContain('Fusing your yetis…');
  expect(document.querySelectorAll('.fs-yeti').length).toBe(2);
  expect(onFused).not.toHaveBeenCalled();
});

test('hands over to the reveal once the merge is done (at once with reduced motion), only once', async () => {
  const onFused = vi.fn();
  const root = await mount(false, onFused);
  await mount(true, onFused, root);
  await mount(true, onFused, root);
  expect(onFused).toHaveBeenCalledTimes(1);
});
