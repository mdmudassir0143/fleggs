// @vitest-environment jsdom
import { expect, test, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

const motionContext = vi.fn(() => ({ revert: () => {} }));
vi.mock('../motion/gsap', () => ({ motionContext, gsap: { from: vi.fn() }, MOTION: { enter: {}, ui: {} } }));
const { Sheet } = await import('./Sheet');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

test('an open sheet does not replay its entrance when its parent re-renders (new onClose each time)', async () => {
  document.body.innerHTML = '<div id="h"></div>';
  const root = createRoot(document.getElementById('h')!);
  const last = vi.fn();
  for (let i = 0; i < 5; i++) {
    const onClose = i === 4 ? last : () => {};
    await act(async () => { root.render(<Sheet open title="Confirm purchase" onClose={onClose}><button>Buy</button></Sheet>); });
  }
  expect(motionContext).toHaveBeenCalledTimes(1);
  await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
  expect(last).toHaveBeenCalled(); // Escape still uses the latest onClose
});

test('the dialog variant renders as a centred popup', async () => {
  document.body.innerHTML = '<div id="h"></div>';
  await act(async () => { createRoot(document.getElementById('h')!).render(<Sheet open variant="dialog" title="Confirm purchase" onClose={() => {}}>x</Sheet>); });
  expect(document.querySelector('.sheet')!.classList.contains('is-dialog')).toBe(true);
});
