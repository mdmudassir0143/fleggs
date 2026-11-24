import { WORKER_URL } from '../config';

/** Chain-ish time: the Worker's clock (Cloudflare) minus ours, so countdowns don't trust the phone clock. */
export let clockOffset = 0;
let synced = false;
export async function syncClock() {
  if (synced) return;
  try {
    const t0 = Date.now();
    const { now } = await (await fetch(`${WORKER_URL}/health`)).json() as { now?: number };
    if (typeof now === 'number') { clockOffset = now - (t0 + Date.now()) / 2; synced = true; }
  } catch { /* keep 0 */ }
}
