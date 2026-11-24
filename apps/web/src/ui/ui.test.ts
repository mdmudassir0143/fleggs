// @vitest-environment jsdom
import { describe, expect, test } from 'vitest';
import { countSteps, focusables, nextFocus } from './helpers';

describe('countSteps', () => {
  test('monotonic and ends at the target', () => {
    const s = countSteps(0, 297, 30);
    expect(s.at(-1)).toBe(297);
    for (let i = 1; i < s.length; i++) expect(s[i]).toBeGreaterThanOrEqual(s[i - 1]);
  });
  test('counting down works', () => {
    const s = countSteps(50, 10, 10);
    expect(s.at(-1)).toBe(10);
    expect(s[0]).toBeLessThanOrEqual(50);
  });
  test('no change gives one step', () => expect(countSteps(5, 5, 20)).toEqual([5]));
});

describe('focus trap helpers', () => {
  const html = '<div id="s"><button id="a">a</button><a id="b" href="#">b</a><button disabled>x</button><input id="c"/></div>';
  test('focusables lists enabled tabbables in order', () => {
    document.body.innerHTML = html;
    expect(focusables(document.getElementById('s')!).map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });
  test('Tab on the last wraps to the first, Shift+Tab on the first wraps to the last', () => {
    document.body.innerHTML = html;
    const root = document.getElementById('s')!;
    expect(nextFocus(root, document.getElementById('c')!, false)?.id).toBe('a');
    expect(nextFocus(root, document.getElementById('a')!, true)?.id).toBe('c');
    expect(nextFocus(root, document.getElementById('a')!, false)).toBeNull();
  });
});
