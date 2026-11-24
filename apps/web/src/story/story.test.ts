// @vitest-environment jsdom
import { beforeAll, describe, expect, test, vi } from 'vitest';
import { storySceneBack, storySceneFront } from '@flurry/art';
import { STORY_COPY, buildStoryTimeline } from './story.timeline';

beforeAll(() => {
  window.matchMedia = vi.fn((q: string) => ({ matches: false, media: q, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() })) as never;
});

function mount() {
  document.body.innerHTML = `<section id="s"><div class="scene-back">${storySceneBack()}</div><div class="story-title">FLURRY</div><div class="scene-front">${storySceneFront()}</div><a class="skip-story" href="#start">Skip story</a><article id="start"></article></section>`;
  return document.getElementById('s')!;
}

describe('story', () => {
  test('STORY_COPY matches spec', () => {
    expect(STORY_COPY).toEqual([
      'Long ago, a yeti froze in time.',
      'The Sui legends woke him up.',
      'He found a nest of frozen eggs.',
      'One of them is yours.',
    ]);
  });

  test('timeline has labels ch1–ch5 in order', () => {
    const tl = buildStoryTimeline(mount(), false);
    const labels = Object.entries(tl.labels).sort((a, b) => a[1] - b[1]).map(([k]) => k);
    expect(labels).toEqual(['ch1', 'ch2', 'ch3', 'ch4', 'ch5']);
  });

  test('each chapter plays while its own text card scrolls in', () => {
    const tl = buildStoryTimeline(mount(), false);
    const at = (l: string) => tl.labels[l] / tl.duration();
    // 5 full-height sections → 4 screens of scroll; chapter k's card arrives around k/4.
    expect(at('ch1')).toBeCloseTo(0, 2);
    expect(at('ch2')).toBeCloseTo(0.1, 2);
    expect(at('ch3')).toBeCloseTo(0.35, 2);
    expect(at('ch4')).toBeCloseTo(0.6, 2);
    expect(at('ch5')).toBeCloseTo(0.85, 2);
  });

  test('reduced motion settles on the final frame: Lofi awake and waving, egg out of the nest', () => {
    const root = mount();
    buildStoryTimeline(root, true);
    expect(getComputedStyle(root.querySelector('#lofi-wave')!).opacity).toBe('1');
    expect(getComputedStyle(root.querySelector('#aurora')!).opacity).toBe('0');
    expect(getComputedStyle(root.querySelector('#lofi-sleep')!).opacity).toBe('0');
    expect(getComputedStyle(root.querySelector('#egg-hero')!).opacity).toBe('1');
  });

  test('skip link jumps to the CTA', () => {
    const root = mount();
    expect(root.querySelector('.skip-story')!.getAttribute('href')).toBe('#start');
    expect(root.querySelector('#start')).not.toBeNull();
  });
});
