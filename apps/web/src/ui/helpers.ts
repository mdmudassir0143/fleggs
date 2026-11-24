/** Integer frames from `from` to `to` with ease-out, for number count-ups. */
export function countSteps(from: number, to: number, frames: number): number[] {
  if (from === to) return [to];
  const out: number[] = [];
  for (let i = 1; i <= frames; i++) {
    const t = 1 - (1 - i / frames) ** 3;
    out.push(Math.round(from + (to - from) * t));
  }
  return out;
}

const TABBABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function focusables(root: Element): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(TABBABLE));
}

/** Where focus should go to stay inside `root`, or null to let the browser move it. */
export function nextFocus(root: Element, current: Element, shift: boolean): HTMLElement | null {
  const list = focusables(root);
  if (list.length === 0) return null;
  if (!shift && current === list[list.length - 1]) return list[0];
  if (shift && current === list[0]) return list[list.length - 1];
  return null;
}
