import { useState, type FormEvent } from 'react';
import { EggArt } from '../components/EggArt';
import { Footer } from '../components/Footer';
import { joinWaitlist } from '../lib/site';

/** A calm sky page with one card in the middle (waitlist, coming soon). */
export function SkyPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="sky-page">
      <a className="sky-logo" href="#">Flurry Eggs</a>
      <main className="sky-card">{children}</main>
      <Footer className="sky-footer" />
    </div>
  );
}

export function Waitlist() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'joined' | 'already'>('idle');
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setState('busy'); setError(null);
    try { setState((await joinWaitlist(email)).already ? 'already' : 'joined'); }
    catch (err) { setError((err as Error).message); setState('idle'); }
  }
  const done = state === 'joined' || state === 'already';
  return (
    <SkyPage>
      <span className="sky-egg" aria-hidden="true"><EggArt stage={done ? 2 : 0} /></span>
      <h1>{done ? (state === 'joined' ? 'You’re on the list!' : 'You’re already on the list.') : 'Join the waitlist'}</h1>
      {done ? (
        <p>Once you’re approved, sign in with this Google account and your egg will be waiting. Follow <a href="https://x.com/Flurry_eggs" target="_blank" rel="noopener noreferrer">@Flurry_eggs</a> for news.</p>
      ) : (
        <>
          <p>Invite-only for now. Use the Google email you’ll play with. Once it’s approved, signing in with it lets you straight in.</p>
          <form className="sky-form" onSubmit={submit}>
            <label className="sr-only" htmlFor="wl-email">Email address</label>
            <input id="wl-email" type="email" required autoComplete="email" placeholder="you@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="btn warm" type="submit" disabled={state === 'busy'}>{state === 'busy' ? 'Joining…' : 'Join waitlist'}</button>
          </form>
          {error && <p className="error" role="alert">{error}</p>}
          <p className="sky-note">We only use your email for your invite. <a href="/privacy.html">Privacy</a></p>
        </>
      )}
    </SkyPage>
  );
}

export function ComingSoon() {
  return (
    <SkyPage>
      <span className="sky-egg is-wobble" aria-hidden="true"><EggArt stage={1} /></span>
      <h1>Coming soon</h1>
      <p>A frozen egg is waiting for you. Warm it, hatch a one-of-a-kind yeti on Sui, train it and earn.</p>
      <a className="btn warm" href="#waitlist">Join the waitlist</a>
      <p className="sky-note">Follow <a href="https://x.com/Flurry_eggs" target="_blank" rel="noopener noreferrer">@Flurry_eggs</a> for the launch.</p>
    </SkyPage>
  );
}
