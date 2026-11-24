// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { HOW_STEPS, HowLink, HowToPlay, howSeen, markHowSeen } from './HowToPlay';
import { parseRoute } from '../shell/nav';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function render(el: JSX.Element) {
  window.matchMedia = vi.fn((q: string) => ({ matches: q.includes('reduce'), media: q, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() })) as never;
  document.body.innerHTML = '<div id="h"></div>';
  await act(async () => { createRoot(document.getElementById('h')!).render(el); });
  return document.body;
}

describe('How to play', () => {
  beforeEach(() => localStorage.clear());

  test('seven steps in order, ending with Earn', async () => {
    expect(HOW_STEPS.map((s) => s.title)).toEqual(['Warm your egg', 'Hatch your yeti', 'Play and train', 'Daily streak', 'Ways to get eggs', 'Merge and level up', 'Earn real SUI']);
    const body = await render(<HowToPlay onDone={() => {}} />);
    expect(Array.from(body.querySelectorAll('.how-step h3')).map((h) => h.textContent)).toEqual(HOW_STEPS.map((s) => s.title));
  });

  test('shows once after keeper setup', () => {
    expect(howSeen()).toBe(false);
    markHowSeen();
    expect(howSeen()).toBe(true);
  });

  test('storage errors never block the guide', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(howSeen()).toBe(true); // can't remember → don't nag every visit
    get.mockRestore();
  });

  test('reachable from the profile sheet and rail via a link to #how', async () => {
    const body = await render(<HowLink />);
    expect(body.querySelector('a')!.getAttribute('href')).toBe('#how');
    expect(parseRoute('#how')).toBe('how');
  });

  test('arrow keys move between steps', async () => {
    const body = await render(<HowToPlay onDone={() => {}} />);
    const region = body.querySelector('.how') as HTMLElement;
    await act(async () => { region.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); });
    expect(body.querySelector('.how-dots [aria-current="step"]')!.getAttribute('data-i')).toBe('1');
    await act(async () => { region.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })); });
    expect(body.querySelector('.how-dots [aria-current="step"]')!.getAttribute('data-i')).toBe('0');
  });

  test('swiping left moves to the next card; a vertical scroll does not', async () => {
    const body = await render(<HowToPlay onDone={() => {}} />);
    const vp = body.querySelector('.how-viewport')!;
    const fire = (type: string, x: number, y = 100) => vp.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }));
    const current = () => body.querySelector('.how-step.is-on h3')!.textContent;
    await act(async () => { fire('pointerdown', 300); fire('pointermove', 260); fire('pointermove', 120); fire('pointerup', 120); });
    expect(current()).toBe('Hatch your yeti');
    await act(async () => { fire('pointerdown', 200, 100); fire('pointermove', 190, 300); fire('pointerup', 190, 300); });
    expect(current()).toBe('Hatch your yeti');
    await act(async () => { fire('pointerdown', 100); fire('pointermove', 140); fire('pointermove', 260); fire('pointerup', 260); });
    expect(current()).toBe('Warm your egg');
  });
});

import { takeAutoHow } from './HowToPlay';
test('the guide opens by itself only once, even if it is never finished', () => {
  localStorage.clear();
  expect(takeAutoHow()).toBe(true);   // first visit: show it
  expect(takeAutoHow()).toBe(false);  // every visit after: don't, even without pressing "Let's play"
});
