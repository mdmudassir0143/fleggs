import { describe, expect, test } from 'vitest';
import { activeEgg, eggChip, eggHint, journey, nestOrder, shownStage, stageCopy, stageIntro, stageReward, waitsFor } from './journey';

describe('the thaw journey', () => {
  test('each stage decides one trait: done shows its score and tier, the next one is up, the rest wait', () => {
    expect(journey([812, 455])).toEqual([
      { trait: 'Fur', state: 'done', score: 812, rating: 'Perfect', stars: 3 },
      { trait: 'Horns', state: 'done', score: 455, rating: 'Toasty', stars: 2 },
      { trait: 'Power', state: 'next' },
    ]);
    expect(journey([]).map((s) => s.state)).toEqual(['next', 'locked', 'locked']);
    expect(journey([100, 200, 300]).map((s) => (s.state === 'done' ? s.stars : 0))).toEqual([1, 1, 1]);
  });

  test('the fill goes from −40°C to 0°C as stages finish', () => {
    expect(stageCopy(0)).toMatchObject({ temp: '−40°C', title: 'Warm its fur', fill: 0 });
    expect(stageCopy(1)).toMatchObject({ temp: '−25°C', title: 'Warm its horns' });
    expect(stageCopy(2)).toMatchObject({ temp: '−10°C', title: 'Warm its power' });
    expect(stageCopy('hatch')).toMatchObject({ temp: '0°C', title: 'It’s wiggling! Ready to hatch', fill: 100 });
    expect(stageCopy(0).line).toContain('700');
  });
});

describe('the nest', () => {
  test('each egg says its element and how warm it is', () => {
    expect(eggChip({ id: 'a', element: 3, stageScores: [1] })).toEqual({ name: 'Ember egg', status: '1 of 3 warm', ready: false });
    expect(eggChip({ id: 'b', element: 0, stageScores: [1, 2, 3] })).toEqual({ name: 'Frost egg', status: 'Ready to hatch', ready: true });
    expect(eggChip({ id: 'c', element: 1, stageScores: [] })).toEqual({ name: 'Storm egg', status: 'Not warmed yet', ready: false });
  });
});

describe('stage rewards, intros and hints', () => {
  test('the reward names the trait and the tier the chain will roll (700 Rare, 400 Fine)', () => {
    expect(stageReward(0, 399)).toEqual({ trait: 'Fur', tier: 'Common' });
    expect(stageReward(0, 400)).toEqual({ trait: 'Fur', tier: 'Fine' });
    expect(stageReward(1, 699)).toEqual({ trait: 'Horns', tier: 'Fine' });
    expect(stageReward(2, 700)).toEqual({ trait: 'Power', tier: 'Rare' });
    expect(stageReward(2, 1000)).toEqual({ trait: 'Power', tier: 'Rare' });
  });
  test('each stage has a name and a one-line rule', () => {
    expect(stageIntro(0).name).toBe('First warmth');
    expect(stageIntro(1).name).toBe('Wind gusts');
    expect(stageIntro(2)).toMatchObject({ name: 'Blizzard' });
    expect(stageIntro(2).rule).toContain('combo');
  });
  test('the egg drops a hint once two stages are done', () => {
    expect(eggHint(0)).toBeNull();
    expect(eggHint(1)).toBeNull();
    expect(eggHint(2)).toBe('Something fluffy is stirring…');
    expect(eggHint(3)).toBe('It’s knocking from the inside!');
  });
});

describe('the stage shown while the chain catches up', () => {
  test('right after finishing a stage, the next one shows even if the egg has not refreshed yet', () => {
    expect(shownStage(0, 0)).toBe(1);
    expect(shownStage(1, 1)).toBe(2);
    expect(shownStage(2, 2)).toBe('hatch');
  });
  test('without a just-finished stage (or once the egg caught up) it follows the egg', () => {
    expect(shownStage(0, null)).toBe(0);
    expect(shownStage(2, 0)).toBe(2);
    expect(shownStage(3, null)).toBe('hatch');
  });
});

describe('one egg at a time', () => {
  const E = (id: string, element: number, n: number) => ({ id, element, stageScores: Array(n).fill(500) });
  test('the started egg (furthest along) is the one in progress; fresh eggs wait for it', () => {
    const eggs = [E('a', 1, 0), E('b', 0, 1), E('c', 2, 2)];
    expect(activeEgg(eggs)?.id).toBe('c');
    expect(waitsFor(eggs, eggs[0])).toEqual({ id: 'c', name: 'Aurora egg' });
    expect(waitsFor(eggs, eggs[1])).toBeNull(); // already started: may carry on
    expect(waitsFor(eggs, eggs[2])).toBeNull();
  });
  test('an egg ready to hatch still holds the line', () => {
    const eggs = [E('a', 1, 0), E('b', 0, 3)];
    expect(waitsFor(eggs, eggs[0])).toEqual({ id: 'b', name: 'Frost egg' });
  });
  test('with nothing started, every egg is free and none is active', () => {
    const eggs = [E('a', 1, 0), E('b', 0, 0)];
    expect(activeEgg(eggs)).toBeNull();
    expect(waitsFor(eggs, eggs[1])).toBeNull();
  });
  test('the nest lists the egg in progress first, then the rest in order', () => {
    expect(nestOrder([E('a', 1, 0), E('b', 0, 1), E('c', 2, 0)]).map((e) => e.id)).toEqual(['b', 'a', 'c']);
  });
});
