import { useSiteMode } from '../lib/site';
import { useState } from 'react';
import { useDAppKit, useWallets } from '@mysten/dapp-kit-react';
import { isGoogleWallet } from '@mysten/enoki';
import { ELEMENT } from '@flurry/shared';
import { buildCreateProfile } from '../lib/flurry';
import { run } from '../lib/api';

const ELEMENTS = [
  { code: ELEMENT.Frost, name: 'Frost', color: '#5e8fd3' },
  { code: ELEMENT.Storm, name: 'Storm', color: '#7a5bd6' },
  { code: ELEMENT.Aurora, name: 'Aurora', color: '#2bb393' },
  { code: ELEMENT.Ember, name: 'Ember', color: '#f07a3a' },
];

/** Sign in with Google (Enoki zkLogin). Copy defaults fit the story's last chapter. */
export function SignIn({ label = 'Hatch my egg', note = 'Sign in to keep it safe. Free to play, no wallet needed.' }: { label?: string; note?: string }) {
  const dAppKit = useDAppKit();
  const google = useWallets().find(isGoogleWallet);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mode = useSiteMode();

  async function signIn() {
    if (!google) return;
    setBusy(true);
    setError(null);
    try {
      await dAppKit.connectWallet({ wallet: google });
    } catch (e) {
      console.error('[flurry] Google sign-in failed', e);
      const err = e as Error & { cause?: Error; code?: string };
      const reason = [err?.message, err?.cause?.message].filter(Boolean).join(': ') || String(e);
      setError(/closed|cancel/i.test(reason)
        ? 'Google sign-in was closed before it finished. Try again.'
        : `Google sign-in failed: ${reason}`);
    } finally {
      setBusy(false);
    }
  }

  // Waitlist mode (set by the admin): the big button goes to the waitlist; players can still sign in.
  if (mode === 'waitlist') {
    return (
      <div className="signin">
        <a className="btn warm big signin-btn" href="#waitlist">Join waitlist</a>
        <p className="signin-note">Invite-only for now.</p>
        <button className="link-btn signin-existing" onClick={signIn} disabled={busy || !google}>{busy ? 'Opening Google…' : 'Got an invite? Sign in'}</button>
        {error && <p className="error" role="alert">{error}</p>}
      </div>
    );
  }
  return (
    <div className="signin">
      <button className="btn warm big signin-btn" onClick={signIn} disabled={busy || !google}>
        {busy ? 'Opening Google…' : label}
      </button>
      <p className="signin-note">{note}</p>
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}

export function PickElement({ address, onCreated }: { address: string; onCreated: () => void }) {
  const [pick, setPick] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (pick === null) return;
    setBusy(true);
    setError(null);
    try {
      const res = await run(buildCreateProfile(pick), address);
      if (!res.ok) throw new Error('Your egg could not be created. Try again.');
      onCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2>Pick your home element</h2>
      <p className="hint">Your first yeti hatches with this element.</p>
      <div className="elements" role="group" aria-label="Element">
        {ELEMENTS.map((el) => (
          <button key={el.code} className="element" aria-pressed={pick === el.code} onClick={() => setPick(el.code)}>
            <span className="dot" style={{ background: el.color }} />
            {el.name}
          </button>
        ))}
      </div>
      <button className="btn warm" onClick={create} disabled={pick === null || busy}>
        {busy ? 'Getting your egg…' : pick === null ? 'Choose an element' : `Get my ${ELEMENTS[pick].name} egg`}
      </button>
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
