import { Footer } from './Footer';
import type { ReactNode } from 'react';
import { SkyBackdrop } from '../shell/SkyBackdrop';

/** Lofi's world around every screen: flat sky and clouds, an ice floor, wordmark + profile on top. */
export function AppShell({ right, children }: { right?: ReactNode; children: ReactNode }) {
  return (
    <div className="shell">
      <SkyBackdrop />
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="Flurry Eggs home">Flurry Eggs</a>
        {right}
      </header>
      <main className="stage">{children}</main>
      <Footer />
    </div>
  );
}
