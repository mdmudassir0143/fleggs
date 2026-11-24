import { EggArt } from '../components/EggArt';
import { SkyPage } from './Waitlist';

/** Signed in, but the game is invite-only and this account isn't approved yet. */
export function Pending({ email, resign, onRecheck, onSignOut }: { email: string | null; resign: boolean; onRecheck: () => void; onSignOut: () => void }) {
  if (resign) {
    return (
      <SkyPage>
        <span className="sky-egg" aria-hidden="true"><EggArt stage={0} /></span>
        <h1>Sign in again</h1>
        <p>We need a fresh Google sign-in to check your spot on the waitlist. Sign out, then sign in again.</p>
        <button className="btn warm" onClick={onSignOut}>Sign out</button>
      </SkyPage>
    );
  }
  return (
    <SkyPage>
      <span className="sky-egg is-wobble" aria-hidden="true"><EggArt stage={1} /></span>
      <h1>You’re on the waitlist</h1>
      {email && <p className="pending-email">{email}</p>}
      <p className="pending-status"><span className="pending-dot" aria-hidden="true" />Waiting for approval</p>
      <p>We’re letting players in a few at a time. Once you’re approved, sign in here and your egg will be waiting.</p>
      <div className="pending-actions">
        <button className="btn warm" onClick={onRecheck}>Check again</button>
        <button className="btn ghost" onClick={onSignOut}>Sign out</button>
      </div>
      <p className="sky-note">Follow <a href="https://x.com/Flurry_eggs" target="_blank" rel="noopener noreferrer">@Flurry_eggs</a> for news.</p>
    </SkyPage>
  );
}
