import { GAME } from '@flurry/shared';

const INK = '#14213D';

/** A tiny picture of how each game is played (used on the Train tiles and in How to play). */
export function GameDiagram({ game }: { game: number }) {
  const s = { stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  return (
    <svg className="game-diagram" viewBox="0 0 120 80" aria-hidden="true">
      {game === GAME.KeepItWarm && (
        <>
          <ellipse cx="34" cy="70" rx="20" ry="4" fill={INK} opacity=".12" />
          <path d="M34 14c11 0 18 18 18 30s-8 23-18 23-18-11-18-23 7-30 18-30z" fill="#FFE6D1" {...s} />
          <circle cx="34" cy="42" r="22" fill="#F07A3A" opacity=".18" />
          <rect x="82" y="10" width="14" height="52" rx="7" fill="#fff" {...s} />
          <rect x="84" y="26" width="10" height="14" fill="#FFC9A3" />
          <rect x="85" y="34" width="8" height="26" rx="4" fill="#5E8FD3" />
          <circle cx="89" cy="66" r="8" fill="#5E8FD3" {...s} />
          <path d="M70 37h10" {...s} /><path d="M74 33l6 4-6 4" fill={INK} {...s} />
        </>
      )}
      {game === GAME.IcicleDash && (
        <>
          <path d="M40 6L16 76M80 6l24 70" {...s} />
          <path d="M60 10v60" stroke="#A9C6E6" strokeWidth="3" strokeDasharray="5 5" />
          <path d="M36 14h12l-6 18z" fill="#BFE3FB" {...s} />
          <path d="M72 30h12l-6 18z" fill="#BFE3FB" {...s} />
          <circle cx="48" cy="64" r="9" fill="#fff" {...s} />
          <circle cx="48" cy="64" r="5" fill="#7A5BD6" />
          <path d="M60 64h14M68 59l6 5-6 5" fill="none" {...s} />
        </>
      )}
      {game === GAME.LofiBeats && (
        <>
          {[28, 60, 92].map((x, i) => <rect key={x} x={x - 13} y="6" width="26" height="70" rx="12" fill={['#5EE6C0', '#9B7BF0', '#7FB7FF'][i]} opacity=".18" />)}
          <path d="M10 60h100" stroke={INK} strokeWidth="3" />
          {[[28, 22], [60, 40], [92, 14]].map(([x, y]) => (
            <g key={x} {...s} strokeWidth={2.5}>
              <path d={`M${x - 7} ${y}h14M${x} ${y - 7}v14M${x - 5} ${y - 5}l10 10M${x + 5} ${y - 5}l-10 10`} />
            </g>
          ))}
          {[28, 60, 92].map((x) => <circle key={x} cx={x} cy="60" r="9" fill="#fff" {...s} />)}
        </>
      )}
      {game === GAME.IglooStack && (
        <>
          <path d="M8 74h104" {...s} />
          {[[30, 60, 60], [34, 46, 52], [38, 32, 44]].map(([x, y, w]) => <rect key={y} x={x} y={y} width={w} height="13" rx="4" fill="#CFE8F8" {...s} />)}
          <path d="M84 4v12" stroke={INK} strokeWidth="2" opacity=".5" />
          <rect x="70" y="16" width="30" height="12" rx="4" fill="#CFE8F8" {...s} />
          <path d="M58 22h8M62 18l-4 4 4 4" fill="none" {...s} />
        </>
      )}
    </svg>
  );
}
