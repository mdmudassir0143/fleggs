// @vitest-environment jsdom
import { beforeAll, describe, expect, test, vi } from 'vitest';
import { buildRevealTimeline, REVEAL_LABELS } from './reveal.timeline';

beforeAll(() => {
  window.matchMedia = vi.fn((q: string) => ({ matches: false, media: q, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() })) as never;
});

function mount() {
  document.body.innerHTML = `<section id="r">
    <div class="reveal-burst"></div>
    <div class="reveal-egg"><svg><g class="egg-top"></g><g class="egg-bottom"></g><path class="reveal-crack" d="M0,0 L10,10"/></svg></div>
    <div class="reveal-yeti"></div>
    <canvas class="reveal-confetti"></canvas>
  </section>`;
  return document.getElementById('r')!;
}

describe('reveal timeline', () => {
  test('timeline labels in order', () => {
    const tl = buildRevealTimeline(mount(), false, { onRise: () => {} });
    const labels = Object.entries(tl.labels).sort((a, b) => a[1] - b[1]).map(([k]) => k);
    expect(labels).toEqual([...REVEAL_LABELS]);
    expect(REVEAL_LABELS).toEqual(['shake', 'crack', 'split', 'rise', 'name', 'story', 'confetti']);
  });

  test('reduce=true jumps to final state', () => {
    const root = mount();
    const onRise = vi.fn();
    buildRevealTimeline(root, true, { onRise });
    expect(getComputedStyle(root.querySelector('.reveal-yeti')!).opacity).toBe('1');
    expect(getComputedStyle(root.querySelector('.egg-top')!).opacity).toBe('0');
    expect(onRise).toHaveBeenCalledTimes(1);
  });

  test('CRACK_DONE dispatched at rise label', () => {
    const onRise = vi.fn();
    const tl = buildRevealTimeline(mount(), false, { onRise });
    tl.pause();
    tl.seek(tl.labels.rise - 0.01, false);
    expect(onRise).not.toHaveBeenCalled();
    tl.seek(tl.labels.rise + 0.01, false);
    expect(onRise).toHaveBeenCalledTimes(1);
  });
});
