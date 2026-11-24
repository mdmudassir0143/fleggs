/** The game's loader: a little egg wobbling while snowflakes drift past. Announces its label once. */
export function SnowLoader({ label, size = 'md', className = '' }: { label: string; size?: 'sm' | 'md'; className?: string }) {
  return (
    <div className={`snow-loader snow-loader-${size} ${className}`} role="status">
      <span className="sl-scene" aria-hidden="true">
        <svg className="sl-egg" viewBox="0 0 40 48">
          <ellipse cx="20" cy="45" rx="11" ry="2.5" fill="#14213D" opacity=".15" />
          <path d="M20 3c9 0 16 15 16 25s-7 16-16 16S4 38 4 28C4 18 11 3 20 3z" fill="#EAF4FB" stroke="#14213D" strokeWidth="3" />
          <circle cx="26" cy="22" r="3" fill="#9CC3E6" /><circle cx="14" cy="31" r="4" fill="#9CC3E6" />
          <path d="M12 12c2-4 5-6 8-6" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" />
        </svg>
        {[0, 1, 2].map((i) => (
          <svg key={i} className={`sl-flake sl-flake-${i}`} viewBox="0 0 12 12"><path d="M6 1v10M1.7 3.5l8.6 5M1.7 8.5l8.6-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" /></svg>
        ))}
      </span>
      <span className="sl-label">{label}</span>
    </div>
  );
}
