import { useEffect, useMemo } from 'react';
import { landscape, pine, sparkle } from '@flurry/art';
import { skyFor, type Sky } from './nav';

const HILL: Record<Sky['mood'], [string, string]> = {
  dawn: ['#F6F2FB', '#D9D5EE'], day: ['#F0F6FC', '#CFDFF1'], dusk: ['#EAE6F5', '#C3BCE0'], night: ['#CFDCEE', '#A2B9D8'],
};

/** Our own sky: time-of-day gradient, faceted ranges, snowy pines, clouds (day) or stars (night), snow floor. */
export function SkyBackdrop({ hour = new Date().getHours() }: { hour?: number }) {
  const sky = skyFor(hour);
  const art = useMemo(() => {
    const hill = HILL[sky.mood];
    const world = `<g transform="translate(0 -60)">${landscape(sky.mood, { idPrefix: 'camp' })}</g>`;
    const pinesBack = [[250, 712, 95], [300, 726, 78], [1280, 716, 92], [1330, 730, 74]].map(([x, y, h]) => pine(x, y, h, true)).join('');
    const pinesFront = [[90, 812, 190], [175, 800, 150], [40, 838, 120], [1500, 808, 190], [1420, 796, 145], [1565, 836, 120]].map(([x, y, h]) => pine(x, y, h)).join('');
    const sparkles = [[380, 850, 7], [1180, 830, 6], [700, 870, 5], [1000, 860, 6]].map(([x, y, s], i) => sparkle(x, y, s)).join('');
    return { __html:
      `<defs><linearGradient id="camp-hill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hill[0]}"/><stop offset="1" stop-color="${hill[1]}"/></linearGradient>` +
      `<linearGradient id="camp-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#DCE9F6"/></linearGradient>` +
      `<radialGradient id="camp-moon"><stop offset="0" stop-color="#FFF6D8" stop-opacity="0.5"/><stop offset="1" stop-color="#FFF6D8" stop-opacity="0"/></radialGradient></defs>` +
      world +
      `<path fill="url(#camp-hill)" stroke="#14213D" stroke-width="5" stroke-linejoin="round" d="M-40,770 Q200,690 460,720 Q620,736 800,712 Q1000,690 1180,722 Q1400,750 1640,700 L1640,900 L-40,900 Z"/>` +
      pinesBack +
      `<path fill="url(#camp-floor)" stroke="#14213D" stroke-width="5" stroke-linejoin="round" d="M-40,820 Q260,770 560,800 Q860,830 1160,790 Q1420,760 1640,800 L1640,900 L-40,900 Z"/>` +
      pinesFront + sparkles };
  }, [sky.mood]);
  // Share the sky colours with the rest of the page (the phone top bar fades into the sky).
  useEffect(() => {
    const r = document.documentElement.style;
    r.setProperty('--sky-top', sky.top); r.setProperty('--sky-bottom', sky.bottom);
  }, [sky.top, sky.bottom]);
  const stars = useMemo(() => Array.from({ length: 44 }, (_, i) => [(i * 73) % 100, (i * 37) % 45, 0.6 + ((i * 13) % 10) / 10]), []);
  return (
    <div className={`sky sky-${sky.mood}`} aria-hidden="true" style={{ ['--sky-top' as string]: sky.top, ['--sky-bottom' as string]: sky.bottom, ['--sky-ink' as string]: sky.ink }}>
      <svg className="sky-art" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice">
        {sky.mood === 'night'
          ? stars.map(([x, y, r], i) => <circle key={i} cx={x * 16} cy={y * 10} r={r * 1.8} fill="#fff" opacity={0.75} />)
          : [[220, 150, 1.2], [1180, 110, 1], [760, 210, 0.8]].map(([x, y, s], i) => (
              <path key={i} className="cloud" transform={`translate(${x} ${y}) scale(${s})`} fill="#fff" opacity="0.9"
                d="M0,40 c10,-28 52,-34 70,-8 c22,-24 66,-12 64,18 c28,2 28,34 0,34 l-136,0 c-28,0 -30,-38 2,-44 Z" />
            ))}
        {(sky.mood === 'night' || sky.mood === 'dusk') && <g><circle cx="1290" cy="170" r="150" fill="url(#camp-moon)" /><circle cx="1290" cy="170" r="54" fill="#FFF6D8" opacity="0.95" /></g>}
        <g dangerouslySetInnerHTML={art} />
      </svg>
    </div>
  );
}
