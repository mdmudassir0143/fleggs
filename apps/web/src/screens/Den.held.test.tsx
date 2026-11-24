// @vitest-environment jsdom
import { expect, test, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Den } from './Den';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

test('listed and staked yetis still show in the grid, with a badge, and open Earn', async () => {
  window.matchMedia = vi.fn((q: string) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() })) as never;
  document.body.innerHTML = '<div id="h"></div>';
  const y = (id: string, name: string) => ({ id, level: 2, elements: [0], variants: [1, 2, 3, 4], name, cardUrl: '', named: true });
  const onHeld = vi.fn();
  await act(async () => {
    createRoot(document.getElementById('h')!).render(
      <Den yetis={[y('w', 'Walker')]} held={[{ yeti: y('l', 'Lister'), where: 'listed', price: 200_000_000n }, { yeti: y('s', 'Stayer'), where: 'staked', weight: 1 }]}
        onOpen={() => {}} onOpenHeld={onHeld} />,
    );
  });
  const text = document.body.textContent!;
  expect(text).toContain('Listed · 0.2 SUI');
  expect(text).toContain('Staked');
  expect(text).toContain('3 yetis');
  const stayer = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('Stayer'))!;
  await act(async () => { stayer.click(); });
  expect(onHeld).toHaveBeenCalled();
});
