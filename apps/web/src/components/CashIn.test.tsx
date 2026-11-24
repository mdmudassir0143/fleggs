// @vitest-environment jsdom
import { expect, test, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { CashIn } from './CashIn';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const T = { reserve: 100_000_000_000n, pot: 23_000_000_000n, split: [5000, 3000] as [number, number], prices: [0n, 0n, 600_000_000n, 1_400_000_000n, 3_000_000_000n, 6_500_000_000n], capBps: 200 };
const L = { totalWeight: 20, acc: 0n, weights: [0, 0, 1, 3, 8, 20], unstakeMs: 86_400_000, rewards: 0n, count: 1, carry: 0n };
const y = (id: string, level: number, name: string) => ({ id, level, elements: [0], variants: [1, 2, 3], name, cardUrl: '', named: true, points: [0, 0, 0], training: null });

async function render(onSell = vi.fn(), onList = vi.fn(), onStake = vi.fn(), mode?: 'sell' | 'list' | 'stake') {
  window.matchMedia = vi.fn((q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() })) as never;
  document.body.innerHTML = '<div id="h"></div>';
  await act(async () => {
    createRoot(document.getElementById('h')!).render(
      <CashIn yetis={[y('a', 3, 'Chill'), y('b', 1, 'Pip')]} treasury={T} lodge={L} pot={23_000_000_000n} listings={[]} sales={[]} mode={mode}
        onSell={onSell} onList={onList} onStake={onStake} />,
    );
  });
  return { onSell, onList, onStake };
}
const btn = (label: RegExp) => Array.from(document.querySelectorAll('button')).find((b) => label.test(b.textContent ?? '')) as HTMLButtonElement;
const pick = async (name: string) => { await act(async () => { btn(new RegExp(name)).click(); }); };

test('choosing a yeti shows the three ways to cash in, with real numbers', async () => {
  await render();
  await pick('Chill');
  const text = document.body.textContent!;
  expect(text).toContain('Sell now');
  expect(text).toContain('1.4 SUI');         // treasury price for L3
  expect(text).toContain('List');
  expect(text).toContain('Stake');
  expect(text).toContain('×3');              // Lodge weight
  expect(text).toContain('≈ 3 SUI a week');   // 3/(20+3) of a 23 SUI week
});

test('Sell now asks first, stating the price and that the yeti is gone; then sells', async () => {
  const { onSell } = await render();
  await pick('Chill');
  await act(async () => { btn(/^Sell for/).click(); });
  const dialog = document.querySelector('[role="dialog"]')!;
  expect(dialog.textContent).toContain('1.4 SUI');
  expect(dialog.textContent).toMatch(/burned|gone for good/);
  expect(onSell).not.toHaveBeenCalled();
  await act(async () => { (Array.from(dialog.querySelectorAll('button')).find((b) => /^Sell/.test(b.textContent ?? '')) as HTMLButtonElement).click(); });
  expect(onSell).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }), 1_400_000_000n);
});

test('List needs a real price', async () => {
  await render();
  await pick('Chill');
  const list = btn(/^List for|^Enter a price/);
  expect(list.disabled).toBe(true);
});

test('a Level 1 yeti explains it must reach Level 2', async () => {
  await render();
  await pick('Pip');
  expect(document.body.textContent).toContain('Level 2+');
  expect(btn(/^Sell for/)).toBeUndefined();
});

test('with a mode (Earn tabs) only that way shows, and the first eligible yeti is picked', async () => {
  await render(vi.fn(), vi.fn(), vi.fn(), 'stake');
  expect(document.querySelector('.cash-yeti.is-on')?.textContent).toContain('Chill');
  expect(document.querySelector('.cash-card.is-stake')).not.toBeNull();
  expect(document.querySelector('.cash-card.is-sell')).toBeNull();
  expect(document.querySelector('.cash-card.is-list')).toBeNull();
});
