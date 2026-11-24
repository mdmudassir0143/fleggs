import { useEffect, useRef } from 'react';
import { composeYeti } from '@flurry/art';
import { bringToLife } from '../motion/life';
import type { Yeti } from '../lib/flurry';

/** Draws a yeti from its on-chain traits (same composer the Worker uses for the card). */
export function YetiArt({ yeti, size, className = '' }: { yeti: Pick<Yeti, 'level' | 'elements' | 'variants'> & { name?: string }; size?: number; className?: string }) {
  // composeYeti only emits numbers and fixed markup — no player text — so injecting it is safe.
  const svg = composeYeti({ level: yeti.level, elements: yeti.elements, variants: yeti.variants }, { size });
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => (ref.current ? bringToLife(ref.current, { track: true }) : undefined), [svg]);
  // The SVG itself is decorative; the wrapper carries the name for screen readers.
  return <div ref={ref} className={`yeti-art ${className}`} role="img" aria-label={`${yeti.name || 'Yeti'}, level ${yeti.level}`} dangerouslySetInnerHTML={{ __html: svg }} />;
}
