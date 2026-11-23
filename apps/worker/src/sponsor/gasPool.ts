export const LEASE_MS = 60_000;

export type Lease = { leaseId: string; coinId: string; until: number; txBytes?: string; sponsorSignature?: string };

/**
 * Hands out one sponsor gas coin per in-flight transaction so two transactions never
 * use the same coin at once (which would lock it on Sui). Pure logic; the Durable
 * Object below wraps it so every request sees one shared, serialized pool.
 */
export class GasPoolCore {
  private leases = new Map<string, Lease>();
  private next = 0;

  constructor(private coins: string[]) {}

  setCoins(coins: string[]) { this.coins = coins; }

  lease(now: number): Lease | null {
    for (const [id, l] of this.leases) if (l.until <= now) this.leases.delete(id);
    const busy = new Set([...this.leases.values()].map((l) => l.coinId));
    // Round-robin so wear spreads over every coin instead of draining the first one.
    let coinId: string | undefined;
    for (let k = 0; k < this.coins.length; k++) {
      const c = this.coins[(this.next + k) % this.coins.length];
      if (!busy.has(c)) { coinId = c; this.next = (this.next + k + 1) % this.coins.length; break; }
    }
    if (!coinId) return null;
    const lease = { leaseId: crypto.randomUUID(), coinId, until: now + LEASE_MS };
    this.leases.set(lease.leaseId, lease);
    return lease;
  }

  attach(leaseId: string, data: { txBytes: string; sponsorSignature: string }) {
    const l = this.leases.get(leaseId);
    if (l) Object.assign(l, data);
  }

  get(leaseId: string, now: number): Lease | null {
    const l = this.leases.get(leaseId);
    return l && l.until > now ? l : null;
  }

  release(leaseId: string) { this.leases.delete(leaseId); }

  /** Takes a coin out of rotation (its balance can no longer cover the gas budget). */
  retire(coinId: string) {
    this.coins = this.coins.filter((c) => c !== coinId);
    for (const [id, l] of this.leases) if (l.coinId === coinId) this.leases.delete(id);
  }

  coinsLeft() { return this.coins.length; }
  coinList() { return [...this.coins]; }
}
