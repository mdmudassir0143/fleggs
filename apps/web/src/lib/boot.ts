/** Where the wallet library keeps the last connected wallet (a returning player). */
export const SAVED_SESSION_KEY = 'mysten-dapp-kit:selected-wallet-and-address';
const GRACE_MS = 5000;

type Wallet = 'disconnected' | 'connecting' | 'reconnecting' | 'connected';

/**
 * The first screen: the loader while a returning player's session restores (so the story never
 * flashes for them), the story for new visitors, and the app once the game is loading.
 */
export function bootView(s: { game: 'signed-out' | 'loading' | 'ready'; wallet: Wallet; savedSession: boolean; waitedMs: number }): 'loader' | 'landing' | 'app' {
  if (s.game !== 'signed-out') return 'app';
  if (s.wallet !== 'disconnected') return 'loader';
  if (s.savedSession && s.waitedMs <= GRACE_MS) return 'loader';
  return 'landing';
}

export function hasSavedSession(): boolean {
  try { return !!localStorage.getItem(SAVED_SESSION_KEY); } catch { return false; }
}
