// @vitest-environment jsdom
import { expect, test, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { YetiSheet } from './YetiSheet';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function render(cardUrl: string) {
  window.matchMedia = vi.fn((q: string) => ({ matches: q.includes('reduce'), media: q, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() })) as never;
  document.body.innerHTML = '<div id="h"></div>';
  const yeti = { id: '0x1', level: 1, elements: [2], variants: [9, 6, 3], name: 'Moss', cardUrl, named: true };
  await act(async () => { createRoot(document.getElementById('h')!).render(<YetiSheet yeti={yeti} open onClose={() => {}} onSetAvatar={async () => {}} isAvatar={false} />); });
  return document.body;
}

test('the saved card replaces the art (shown once); art only when there is no card', async () => {
  const noCard = await render('');
  expect(noCard.querySelector('img.yeti-sheet-cardimg')).toBeNull();
  expect(noCard.querySelector('.yeti-sheet-holo .yeti-art')).not.toBeNull();
  const withCard = await render('https://example.com/c.png');
  expect(withCard.querySelectorAll('img').length).toBe(1);
  expect(withCard.querySelector('img.yeti-sheet-cardimg')?.getAttribute('src')).toBe('https://example.com/c.png');
  expect(withCard.querySelector('.yeti-sheet-holo .yeti-art')).toBeNull();
});

test('the card sheet is just the card and its actions (traits live on the yeti page)', async () => {
  const el = await render('');
  expect(el.querySelector('.trait-rows')).toBeNull();
  expect(el.querySelector('.merge-badge')).toBeNull();
  expect(el.textContent).toContain('Set as my avatar');
});
