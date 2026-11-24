import { useState } from 'react';
import { useDAppKit } from '@mysten/dapp-kit-react';
import { AVATAR_PRESETS, ELEMENT_COLORS, ELEMENT_NAMES, avatarSvg, yetiFaceAvatar } from '@flurry/art';
import { validateNickname, type PlayerAvatar } from '@flurry/shared';
import { Sheet } from '../ui/Sheet';
import { Avatar } from '../ui/Avatar';
import { useToast } from '../ui/Toast';
import { run } from '../lib/api';
import { buildSetIdentity } from '../lib/flurry';
import { sound } from '../lib/sound';
import { dailyState } from '../lib/daily';
import { music } from '../lib/music';
import { Icon } from '../ui/Icon';
import { PurchaseHistory } from '../components/PurchaseHistory';
import { NICK_ERRORS, resolveAvatar } from '../lib/keeper';
import type { Snapshot } from '../lib/progress';

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/** Who you are in Flurry Eggs: avatar, nickname, stats, wallet, purchase history, sign out. */
export function ProfileSheet({ open, onClose, snap, refresh }: {
  open: boolean; onClose: () => void; snap: Snapshot; refresh: (until?: (s: Snapshot) => boolean) => Promise<void>;
}) {
  const dAppKit = useDAppKit();
  const toast = useToast();
  const [soundOn, setSoundOn] = useState(sound.enabled);
  const [musicOn, setMusicOn] = useState(music.enabled);
  const [picking, setPicking] = useState(false);
  const [nick, setNick] = useState(snap.identity?.nickname ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shown = resolveAvatar(snap.identity?.avatar ?? null, snap.yetis);
  const element = snap.profile?.element ?? 0;
  const nickCheck = validateNickname(nick);

  async function save(v: { nickname?: string; avatar?: PlayerAvatar }, done: string) {
    if (!snap.profile) return;
    setBusy(true); setError(null);
    try {
      const r = await run(buildSetIdentity(snap.profile.id, v), snap.address);
      if (!r.ok) throw new Error('That change could not be saved. Try again.');
      await refresh((s) => (v.nickname === undefined || s.identity?.nickname === v.nickname));
      toast(done); setPicking(false);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  async function copy() {
    try { await navigator.clipboard.writeText(snap.address); toast('Address copied'); } catch { /* text is selectable */ }
  }

  const changed = nick !== (snap.identity?.nickname ?? '');
  const tint = ELEMENT_COLORS[element];

  return (
    <Sheet open={open} onClose={onClose} title="Your keeper">
      <section className="keeper-hero" style={{ ['--tint' as string]: tint }}>
        <button className="keeper-avatar" onClick={() => setPicking((p) => !p)} aria-expanded={picking} aria-label="Change avatar">
          <Avatar avatar={shown} size={96} />
          <span className="keeper-avatar-badge" aria-hidden="true"><Icon name="pencil" size={16} /></span>
        </button>
        <div className="keeper-id">
          <p className="keeper-name">{snap.identity?.nickname ?? 'Yeti keeper'}</p>
          {snap.profile && <span className="keeper-element">{ELEMENT_NAMES[element]} keeper</span>}
        </div>
        <dl className="keeper-stats">
          <div><dt><Icon name="snowflake" size={16} />Snowflakes</dt><dd>{snap.profile?.snowflakes.toString() ?? '0'}</dd></div>
          <div><dt><Icon name="flame" size={16} />Streak</dt><dd>{dailyState(snap.profile ?? {}, Date.now()).streak}<small>/7</small></dd></div>
          <div><dt><Icon name="den" size={16} />Yetis</dt><dd>{snap.yetis.length}</dd></div>
        </dl>
      </section>

      {picking && (
        <section className="keeper-section avatar-picker">
          <h3 className="keeper-label">Choose your look</h3>
          <div className="avatar-grid" role="radiogroup" aria-label="Avatar">
            {AVATAR_PRESETS.map((a) => (
              <button key={a.id} role="radio" aria-checked={shown.kind === 'preset' && shown.preset === a.id} aria-label={a.label}
                className="avatar-option" disabled={busy} onClick={() => save({ avatar: { kind: 'preset', preset: a.id } }, 'Avatar saved')}
                dangerouslySetInnerHTML={{ __html: avatarSvg(a.id, 56) }} />
            ))}
          </div>
          {snap.yetis.length > 0 && (
            <>
              <h3 className="keeper-label">Or a yeti from your den</h3>
              <div className="avatar-grid" role="radiogroup" aria-label="Den yetis">
                {snap.yetis.map((y) => (
                  <button key={y.id} role="radio" aria-checked={shown.kind === 'yeti' && shown.yeti.id === y.id} aria-label={y.name}
                    className="avatar-option" disabled={busy} onClick={() => save({ avatar: { kind: 'yeti', yetiId: y.id } }, 'Avatar saved')}
                    dangerouslySetInnerHTML={{ __html: yetiFaceAvatar({ level: y.level, elements: y.elements, variants: y.variants }, 56) }} />
                ))}
              </div>
            </>
          )}
        </section>
      )}

      <section className="keeper-section">
        <label className="keeper-label" htmlFor="profile-nickname">Nickname</label>
        <div className={`nick-field ${changed ? 'is-changed' : ''}`}>
          <input id="profile-nickname" value={nick} maxLength={20} onChange={(e) => setNick(e.target.value)} aria-invalid={!nickCheck.ok}
            onKeyDown={(e) => { if (e.key === 'Enter' && changed && nickCheck.ok) void save({ nickname: nick }, 'Nickname saved'); }} />
          {changed
            ? <button className="nick-save" disabled={!nickCheck.ok || busy} onClick={() => save({ nickname: nick }, 'Nickname saved')}>{busy ? 'Saving…' : 'Save'}</button>
            : <span className="nick-ok" aria-hidden="true"><Icon name="check" size={18} /></span>}
        </div>
        {!nickCheck.ok && nick.length > 0 && <p className="field-error">{NICK_ERRORS[nickCheck.reason]}</p>}
      </section>

      <section className="keeper-section">
        <span className="keeper-label">Your Sui wallet</span>
        <div className="wallet-pill">
          <code title={snap.address}>{short(snap.address)}</code>
          <button className="pill-action" onClick={copy} aria-label="Copy wallet address"><Icon name="copy" size={18} /></button>
          <a className="pill-action" href={`https://suiscan.xyz/testnet/account/${snap.address}`} target="_blank" rel="noreferrer" aria-label="See my wallet on Sui"><Icon name="link" size={18} /></a>
        </div>
      </section>

      <section className="keeper-section keeper-history" aria-labelledby="profile-history">
        <span className="keeper-label" id="profile-history">Purchase history</span>
        <PurchaseHistory address={snap.address} active={open} />
      </section>

      <section className="keeper-section">
        <span className="keeper-label">Settings</span>
        <a className="setting-row how-row" href="#how" onClick={onClose}>
          <span className="setting-icon"><Icon name="egg" size={20} /></span>
          <span className="setting-text"><b>How to play</b><small>Warm, hatch, train, streaks</small></span>
          <span aria-hidden="true" className="how-row-go">›</span>
        </a>
        <label className="setting-row">
          <span className="setting-icon"><Icon name={musicOn ? 'music-on' : 'music-off'} size={20} /></span>
          <span className="setting-text"><b>Music</b><small>A cosy lofi loop</small></span>
          <input type="checkbox" role="switch" className="switch" checked={musicOn}
            onChange={(e) => { music.setEnabled(e.target.checked); setMusicOn(e.target.checked); }} />
        </label>
        <label className="setting-row">
          <span className="setting-icon"><Icon name={soundOn ? 'sound-on' : 'sound-off'} size={20} /></span>
          <span className="setting-text"><b>Sound effects</b><small>Soft chimes and taps</small></span>
          <input type="checkbox" role="switch" className="switch" checked={soundOn}
            onChange={(e) => { sound.setEnabled(e.target.checked); setSoundOn(e.target.checked); sound.play('ding'); }} />
        </label>
      </section>

      {error && <p className="error" role="alert">{error}</p>}
      <button className="signout" onClick={() => { onClose(); dAppKit.disconnectWallet(); }}><Icon name="sign-out" size={18} />Sign out</button>
    </Sheet>
  );
}
