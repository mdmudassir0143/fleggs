import { Suspense, lazy, useEffect, useState } from 'react';
import { useDAppKit, useWalletConnection } from '@mysten/dapp-kit-react';
import { useAccess } from './lib/access';
import { Pending } from './screens/Pending';
import { useGame } from './lib/useGame';
import { bootView, hasSavedSession } from './lib/boot';
import { Landing } from './screens/Landing';
import { BootLoader } from './components/BootLoader';
import { ComingSoon, Waitlist } from './screens/Waitlist';

// Signed-out visitors only download the story; base camp loads after sign-in.
const SignedIn = lazy(() => import('./SignedIn'));

/** Pages anyone can open by link, signed in or not. */
function usePublicPage(): 'waitlist' | 'soon' | null {
  const read = (): 'waitlist' | 'soon' | null => (location.hash === '#waitlist' ? 'waitlist' : location.hash === '#soon' ? 'soon' : null);
  const [p, setP] = useState(read);
  useEffect(() => { const on = () => setP(read()); addEventListener('hashchange', on); return () => removeEventListener('hashchange', on); }, []);
  return p;
}

export function App() {
  const game = useGame();
  const publicPage = usePublicPage();
  const wallet = useWalletConnection();
  const dAppKit = useDAppKit();
  // Invite-only mode: the server says whether this account may play (it also enforces it).
  const [access, recheck] = useAccess(wallet.account?.address ?? null);
  const [savedSession] = useState(hasSavedSession);
  const [waitedMs, setWaited] = useState(0);
  // A returning player gets the egg loader (not the story) while their session restores.
  useEffect(() => {
    if (!savedSession) return;
    const t0 = Date.now();
    const id = setInterval(() => setWaited(Date.now() - t0), 250);
    const stop = setTimeout(() => clearInterval(id), 6000);
    return () => { clearInterval(id); clearTimeout(stop); };
  }, [savedSession]);

  if (publicPage === 'waitlist') return <Waitlist />;
  if (publicPage === 'soon') return <ComingSoon />;
  const view = bootView({ game: game.state.status, wallet: wallet.status, savedSession, waitedMs });
  if (view === 'loader') return <BootLoader label="Warming up…" />;
  if (view === 'landing') return <Landing />;
  if (access.kind === 'checking') return <BootLoader label="Checking your invite…" />;
  if (access.kind === 'pending' || access.kind === 'resign') {
    return <Pending email={access.kind === 'pending' ? access.email : null} resign={access.kind === 'resign'} onRecheck={recheck} onSignOut={() => void dAppKit.disconnectWallet()} />;
  }
  return (
    <Suspense fallback={<BootLoader label="Finding your eggs…" />}>
      <SignedIn {...game} />
    </Suspense>
  );
}
