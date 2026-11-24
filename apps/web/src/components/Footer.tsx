/** Site footer: the fan-game credit, a small X link, privacy and terms. */
export function Footer({ className = '' }: { className?: string }) {
  return (
    <footer className={`footer ${className}`}>
      <span>A fan-made game inspired by Lofi the Yeti</span>
      <span className="footer-links">
        <a className="footer-x" href="https://x.com/Flurry_eggs" target="_blank" rel="noopener noreferrer" aria-label="Flurry Eggs on X">
          <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.77L17.75 3zm-1.08 16.2h1.7L7.42 4.7H5.6l11.07 14.5z" /></svg>
        </a>
        <span aria-hidden="true">·</span><a href="/privacy.html">Privacy</a><span aria-hidden="true">·</span><a href="/terms.html">Terms</a>
      </span>
    </footer>
  );
}
