/** Little marks for the four traits: Fur, Horns, Power, Build. */
export function TraitGlyph({ slot, size = 22 }: { slot: number; size?: number }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const s = { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': true };
  if (slot === 0) return <svg {...s}><path {...p} d="M5 15c1-4 2-6 3-6s1 4 2 4 1-6 2-6 1 6 2 6 1-4 2-4 2 2 3 6" /><path {...p} d="M4 19h16" /></svg>;
  if (slot === 1) return <svg {...s}><path {...p} d="M7 19c-2-4-2-9 1-13 0 4 2 7 4 8" /><path {...p} d="M17 19c2-4 2-9-1-13 0 4-2 7-4 8" /></svg>;
  if (slot === 2) return <svg {...s}><path {...p} d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" /></svg>;
  return <svg {...s}><rect {...p} x="4" y="13" width="16" height="6" rx="1.5" /><rect {...p} x="7" y="7" width="10" height="6" rx="1.5" /><path {...p} d="M12 13v6M9.5 7v6M14.5 7v6" /></svg>;
}
