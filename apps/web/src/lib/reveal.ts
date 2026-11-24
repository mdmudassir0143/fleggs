/** What /lore returns (bigints as strings). */
export type LoreResult = {
  yetiId: string;
  name: string;
  story: string;
  loreBlob: string;
  cardBlob: string;
  cardUrl: string;
  expiresMs: string;
  signature: string;
};

export type RevealStep = 'cracking' | 'naming' | 'saving' | 'revealed' | 'failed';

export type RevealState = {
  step: RevealStep;
  digest: string;
  crackDone: boolean;
  lore?: LoreResult;
  error?: string;
  retryable?: boolean;
  pendingFail?: { error: string; retryable: boolean };
};

export type RevealEvent =
  | { type: 'CRACK_DONE' }
  | { type: 'LORE_OK'; lore: LoreResult }
  | { type: 'LORE_FAIL'; error: string; retryable: boolean }
  | { type: 'SAVED' }
  | { type: 'SAVE_FAIL'; error: string }
  | { type: 'RETRY' };

/** The reveal starts the moment the hatch transaction lands: the shell is already cracking. */
export function initialReveal(digest: string): RevealState {
  return { step: 'cracking', digest, crackDone: false };
}

/**
 * Crack animation and the /lore request run in parallel. Whichever finishes first waits
 * for the other, so the name never appears before the yeti does.
 */
export function revealReducer(s: RevealState, e: RevealEvent): RevealState {
  switch (e.type) {
    case 'CRACK_DONE': {
      const base = { ...s, crackDone: true };
      if (s.pendingFail) return { ...base, step: 'failed', ...s.pendingFail, pendingFail: undefined };
      return { ...base, step: s.lore ? 'saving' : 'naming' };
    }
    case 'LORE_OK':
      return { ...s, lore: e.lore, step: s.crackDone ? 'saving' : s.step };
    case 'LORE_FAIL':
      if (!s.crackDone) return { ...s, pendingFail: { error: e.error, retryable: e.retryable } };
      return { ...s, step: 'failed', error: e.error, retryable: e.retryable };
    case 'SAVED':
      return { ...s, step: 'revealed', error: undefined };
    case 'SAVE_FAIL':
      return { ...s, step: 'failed', error: e.error, retryable: true };
    case 'RETRY':
      if (s.step !== 'failed') return s;
      return { ...s, step: s.lore ? 'saving' : 'naming', error: undefined, retryable: undefined };
  }
}
