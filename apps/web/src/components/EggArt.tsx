import { eggPalette } from './eggPalette';

const CRACKS = [
  'M96,150 l18,-12 l12,16 l16,-14',
  'M168,110 l10,16 l-8,10 l14,14',
  'M120,214 l16,-8 l8,14 l20,-10',
];

/**
 * The egg in Lofi's ink style. `split` opens it into two halves for the hatch reveal.
 * Top and bottom halves are separate groups so CSS can fling them apart. `element` tints the shell.
 */
export function EggArt({ stage, element, split = false, className = '' }: { stage: 0 | 1 | 2 | 3; element?: number; split?: boolean; className?: string }) {
  const p = eggPalette(stage, element);
  const outline = 'M140,24 C196,24 228,112 228,164 C228,222 190,262 140,262 C90,262 52,222 52,164 C52,112 84,24 140,24 Z';
  const body = (
    <>
      <path d={outline} fill={p.shell} stroke="#14213D" strokeWidth="7" strokeLinejoin="round" />
      <circle cx="174" cy="132" r="14" fill={p.spots} opacity="0.7" />
      <circle cx="104" cy="196" r="20" fill={p.spots} opacity="0.6" />
      <circle cx="170" cy="216" r="9" fill={p.spots} opacity="0.7" />
      <path d="M96,82 C108,58 124,46 140,44" fill="none" stroke="#FFFFFF" strokeWidth="9" strokeLinecap="round" opacity="0.8" />
      {CRACKS.slice(0, p.cracks).map((d) => (
        <path key={d} d={d} fill="none" stroke="#14213D" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </>
  );
  return (
    <svg viewBox="0 0 280 290" className={`egg-art ${split ? 'is-split' : ''} ${className}`} role="img" aria-label={`Egg at ${p.label}`}>
      <defs>
        <clipPath id="egg-top"><path d="M0,0 H280 V150 L240,136 L200,156 L160,134 L120,158 L80,136 L40,156 L0,140 Z" /></clipPath>
        <clipPath id="egg-bottom"><path d="M0,290 H280 V150 L240,136 L200,156 L160,134 L120,158 L80,136 L40,156 L0,140 Z" /></clipPath>
      </defs>
      <ellipse cx="140" cy="276" rx="78" ry="10" fill="#14213D" opacity="0.12" />
      <g className="egg-half egg-top" clipPath="url(#egg-top)">{body}</g>
      <g className="egg-half egg-bottom" clipPath="url(#egg-bottom)">{body}</g>
    </svg>
  );
}
