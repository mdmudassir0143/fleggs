import { useReducer, useState } from 'react';
import { AVATAR_PRESETS, ELEMENT_COLORS, ELEMENT_NAMES, avatarSvg, yetiFaceAvatar } from '@flurry/art';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { run } from '../lib/api';
import { buildCreateProfile, buildSetIdentity, getMyProfile } from '../lib/flurry';
import { initialSetup, setupReducer, suggestNickname } from '../lib/keeper';
import { pollUntil } from '../lib/poll';
import { dAppKit } from '../dappKit';
import type { Snapshot } from '../lib/progress';

/**
 * "Make your keeper": nickname, avatar, home element (new players), then one tap to start.
 * New players: create profile + free egg, then save nickname/avatar. Existing players skip step 3.
 */
export function KeeperSetup({ address, profileId, refresh }: {
  address: string; profileId: string | null; refresh: (until?: (s: Snapshot) => boolean) => Promise<void>;
}) {
  const needsProfile = !profileId;
  const [s, dispatch] = useReducer(setupReducer, { needsProfile }, initialSetup);
  const [step, setStep] = useState(0);
  const steps = needsProfile ? 3 : 2;
  const saving = s.phase === 'creating' || s.phase === 'naming';

  async function start() {
    dispatch({ type: 'SUBMIT' });
    try {
      let id = profileId;
      if (!id) {
        const r = await run(buildCreateProfile(s.element!), address);
        if (!r.ok) throw new Error('Your egg could not be created. Try again.');
        const p = await pollUntil(() => getMyProfile(dAppKit.getClient('testnet'), address), (x) => !!x);
        if (!p) throw new Error('Your egg is on its way. Try again in a moment.');
        id = p.id;
        dispatch({ type: 'CREATED' });
      }
      const r2 = await run(buildSetIdentity(id, { nickname: s.nickname, avatar: { kind: 'preset', preset: s.preset } }), address);
      if (!r2.ok) throw new Error('Your nickname could not be saved. Try again.');
      dispatch({ type: 'DONE' });
      await refresh((snap) => snap.identity?.nickname === s.nickname);
    } catch (e) {
      dispatch({ type: 'FAIL', error: (e as Error).message });
    }
  }

  const stepOk = [s.nickname !== '' && !s.nicknameError, true, s.element !== null][step];

  return (
    <section className="keeper" aria-labelledby="keeper-title">
      <div className="keeper-card">
        <Avatar avatar={{ kind: 'preset', preset: s.preset }} size={104} />
        <p className="keeper-name">{s.nickname || 'Your nickname'}</p>
        {s.element !== null && <span className="chip" style={{ background: ELEMENT_COLORS[s.element], color: '#fff' }}>{ELEMENT_NAMES[s.element]}</span>}
      </div>

      <ol className="step-dots" aria-label={`Step ${step + 1} of ${steps}`}>
        {Array.from({ length: steps }, (_, i) => <li key={i} data-on={i <= step} />)}
      </ol>

      {step === 0 && (
        <div className="keeper-step">
          <h2 id="keeper-title">What should Lofi call you?</h2>
          <label className="field">
            <span className="sr-only">Nickname</span>
            <input
              id="nickname" value={s.nickname} maxLength={20} autoComplete="nickname" placeholder="Snowy Keeper"
              aria-invalid={!!s.nicknameError} aria-describedby="nick-help"
              onChange={(e) => dispatch({ type: 'SET', nickname: e.target.value })}
            />
            <span className="field-count">{s.nickname.length}/20</span>
          </label>
          <p id="nick-help" className={s.nicknameError ? 'field-error' : 'hint'}>{s.nicknameError ?? 'Letters, numbers, spaces, _ or -.'}</p>
          <Button variant="ghost" onClick={() => dispatch({ type: 'SET', nickname: suggestNickname() })}>Suggest one</Button>
        </div>
      )}

      {step === 1 && (
        <div className="keeper-step">
          <h2 id="keeper-title">Pick your look</h2>
          <div className="avatar-grid" role="radiogroup" aria-label="Avatar">
            {AVATAR_PRESETS.map((a) => (
              <button key={a.id} role="radio" aria-checked={s.preset === a.id} aria-label={a.label} className="avatar-option"
                onClick={() => dispatch({ type: 'SET', preset: a.id })}
                dangerouslySetInnerHTML={{ __html: avatarSvg(a.id, 64) }} />
            ))}
          </div>
        </div>
      )}

      {step === 2 && needsProfile && (
        <div className="keeper-step">
          <h2 id="keeper-title">Choose your home element</h2>
          <div className="element-grid" role="radiogroup" aria-label="Home element">
            {ELEMENT_NAMES.map((name, i) => (
              <button key={name} role="radio" aria-checked={s.element === i} className="element-option" onClick={() => dispatch({ type: 'SET', element: i })}>
                <span dangerouslySetInnerHTML={{ __html: yetiFaceAvatar({ level: 1, elements: [i], variants: [0, 0, 0] }, 56) }} />
                {name}
              </button>
            ))}
          </div>
          <p className="hint">Your first yeti hatches with this element.</p>
        </div>
      )}

      {s.error && <p className="error" role="alert">{s.error}</p>}

      <div className="keeper-nav">
        {step > 0 && <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={saving}>Back</Button>}
        {step < steps - 1
          ? <Button variant="primary" size="lg" onClick={() => setStep(step + 1)} disabled={!stepOk}>Next</Button>
          : <Button variant="primary" size="lg" onClick={start} disabled={!s.canSubmit} loading={saving}>
              {s.phase === 'creating' ? 'Getting your egg…' : s.phase === 'naming' ? 'Saving your keeper…' : needsProfile ? 'Start my egg' : 'Save my keeper'}
            </Button>}
      </div>
    </section>
  );
}
