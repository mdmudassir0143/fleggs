import { ELEMENT_COLORS } from '@flurry/art';

/**
 * The glowing orb two yetis fuse into. Split into top/bottom halves with the same class names as
 * the egg, so the hatch reveal timeline cracks it open exactly the same way.
 */
export function MergeOrb({ elements }: { elements: number[] }) {
  const a = ELEMENT_COLORS[elements[0] ?? 0], b = ELEMENT_COLORS[elements[1] ?? elements[0] ?? 0];
  const body = (
    <>
      <circle cx="140" cy="150" r="100" fill="url(#orb-g)" stroke="#14213D" strokeWidth="7" />
      <path d="M86,104 C98,80 120,66 146,62" fill="none" stroke="#fff" strokeWidth="10" strokeLinecap="round" opacity=".85" />
      <circle cx="176" cy="186" r="10" fill="#fff" opacity=".5" />
    </>
  );
  return (
    <svg viewBox="0 0 280 290" className="egg-art merge-orb" role="img" aria-label="Two yetis fusing">
      <defs>
        <radialGradient id="orb-g" cx="40%" cy="35%" r="75%"><stop offset="0" stopColor="#FFFFFF" /><stop offset=".45" stopColor={a} /><stop offset="1" stopColor={b} /></radialGradient>
        <clipPath id="orb-top"><path d="M0,0 H280 V150 L240,136 L200,156 L160,134 L120,158 L80,136 L40,156 L0,140 Z" /></clipPath>
        <clipPath id="orb-bottom"><path d="M0,290 H280 V150 L240,136 L200,156 L160,134 L120,158 L80,136 L40,156 L0,140 Z" /></clipPath>
      </defs>
      <ellipse cx="140" cy="270" rx="78" ry="10" fill="#14213D" opacity="0.12" />
      <g className="egg-half egg-top" clipPath="url(#orb-top)">{body}</g>
      <g className="egg-half egg-bottom" clipPath="url(#orb-bottom)">{body}</g>
    </svg>
  );
}
