// @vitest-environment jsdom
import { expect, test, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfirmPurchase } from './ConfirmPurchase';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

test('confirm shows the item, price and balance after; cancel does nothing', async () => {
  window.matchMedia = vi.fn((q: string) => ({ matches: q.includes('reduce'), media: q, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() })) as never;
  document.body.innerHTML = '<div id="h"></div>';
  const onConfirm = vi.fn(), onClose = vi.fn();
  await act(async () => {
    createRoot(document.getElementById('h')!).render(
      <ConfirmPurchase open item="Frost egg" price={500_000_000n} currency="SUI" balance={993_000_000n} onConfirm={onConfirm} onClose={onClose} />,
    );
  });
  const text = document.body.textContent!;
  expect(text).toContain('Frost egg');
  expect(text).toContain('0.5 SUI');
  expect(text).toContain('0.993 SUI');
  expect(text).toContain('0.493 SUI'); // left after
  const cancel = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Cancel')!;
  await act(async () => { cancel.click(); });
  expect(onClose).toHaveBeenCalled();
  expect(onConfirm).not.toHaveBeenCalled();
  const buy = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.startsWith('Buy'))!;
  await act(async () => { buy.click(); });
  expect(onConfirm).toHaveBeenCalledTimes(1);
});

test('Snowflake purchases show Snowflakes, and buying is disabled when short', async () => {
  document.body.innerHTML = '<div id="h"></div>';
  await act(async () => {
    createRoot(document.getElementById('h')!).render(
      <ConfirmPurchase open item="Snowflake egg" price={400n} currency="Snowflakes" balance={399n} onConfirm={() => {}} onClose={() => {}} />,
    );
  });
  expect(document.body.textContent).toContain('400 Snowflakes');
  const buy = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.startsWith('Buy') || b.textContent?.startsWith('Not enough'))!;
  expect(buy.disabled).toBe(true);
});
