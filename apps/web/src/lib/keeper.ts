import { validateNickname, type PlayerAvatar, type PlayerIdentity } from '@flurry/shared';
import type { Yeti } from './flurry';

/** Identity always comes from chain (follows the player across devices). */
export async function loadIdentity(profileId: string, read: (id: string) => Promise<PlayerIdentity>): Promise<PlayerIdentity> {
  return read(profileId);
}

export type ShownAvatar = { kind: 'preset'; preset: number } | { kind: 'yeti'; yeti: Yeti };

/** A yeti avatar only shows while the player still owns that yeti; otherwise preset 0. */
export function resolveAvatar(a: PlayerAvatar | null, yetis: Yeti[]): ShownAvatar {
  if (a?.kind === 'preset') return a;
  if (a?.kind === 'yeti') {
    const yeti = yetis.find((y) => y.id === a.yetiId);
    if (yeti) return { kind: 'yeti', yeti };
  }
  return { kind: 'preset', preset: 0 };
}

const NAMES = ['Snowy', 'Pebble', 'Frosty', 'Mochi', 'Puff', 'Drift', 'Nimbus', 'Sleet', 'Maple', 'Juniper', 'Cocoa', 'Pip'];
const TAILS = ['Keeper', 'Paws', 'Snowhum', 'Glow', 'Fluff', 'Tundra'];

export function suggestNickname(seed = Math.floor(Math.random() * 1e6)): string {
  return `${NAMES[seed % NAMES.length]} ${TAILS[Math.floor(seed / NAMES.length) % TAILS.length]}`;
}

export const NICK_ERRORS = {
  length: 'Use 2–20 letters, numbers, spaces, _ or -.',
  chars: 'Use 2–20 letters, numbers, spaces, _ or -.',
  blocked: "That nickname can't be used. Try another.",
} as const;

export type SetupState = {
  needsProfile: boolean;
  phase: 'editing' | 'creating' | 'naming' | 'done';
  nickname: string;
  preset: number;
  element: number | null;
  nicknameError: string | null;
  canSubmit: boolean;
  error: string | null;
};

export type SetupEvent =
  | { type: 'SET'; nickname?: string; preset?: number; element?: number | null }
  | { type: 'SUBMIT' }
  | { type: 'CREATED' }
  | { type: 'DONE' }
  | { type: 'FAIL'; error: string };

function check(s: SetupState): SetupState {
  const v = validateNickname(s.nickname);
  const nicknameError = s.nickname && !v.ok ? NICK_ERRORS[v.reason] : null;
  const ready = v.ok && (!s.needsProfile || s.element !== null);
  return { ...s, nicknameError, canSubmit: s.phase === 'editing' && ready };
}

export function initialSetup({ needsProfile }: { needsProfile: boolean }): SetupState {
  return check({ needsProfile, phase: 'editing', nickname: '', preset: 0, element: null, nicknameError: null, canSubmit: false, error: null });
}

/** Keeper setup: create the profile (new players), then write nickname + avatar in one transaction. */
export function setupReducer(s: SetupState, e: SetupEvent): SetupState {
  switch (e.type) {
    case 'SET':
      if (s.phase !== 'editing') return s;
      return check({
        ...s,
        nickname: e.nickname ?? s.nickname,
        preset: e.preset ?? s.preset,
        element: e.element === undefined ? s.element : e.element,
      });
    case 'SUBMIT':
      if (!s.canSubmit) return s;
      return { ...s, phase: s.needsProfile ? 'creating' : 'naming', canSubmit: false, error: null };
    case 'CREATED':
      return { ...s, phase: 'naming' };
    case 'DONE':
      return { ...s, phase: 'done' };
    case 'FAIL':
      return check({ ...s, phase: 'editing', error: e.error, needsProfile: s.needsProfile });
  }
}
