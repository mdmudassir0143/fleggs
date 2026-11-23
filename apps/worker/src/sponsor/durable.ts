import { DurableObject } from 'cloudflare:workers';
import { GasPoolCore, type Lease } from './gasPool';

/** One global pool instance; Durable Objects process calls one at a time, so leases never collide. */
export class GasPool extends DurableObject {
  private core = new GasPoolCore([]);
  private loaded = false;

  private async ready() {
    if (this.loaded) return;
    this.core.setCoins((await this.ctx.storage.get<string[]>('coins')) ?? []);
    this.loaded = true;
  }

  async seed(coins: string[]) {
    await this.ctx.storage.put('coins', coins);
    this.core.setCoins(coins);
    this.loaded = true;
    return coins.length;
  }

  async lease(): Promise<Lease | null> { await this.ready(); return this.core.lease(Date.now()); }
  async attach(leaseId: string, data: { txBytes: string; sponsorSignature: string }) { this.core.attach(leaseId, data); }
  async get(leaseId: string): Promise<Lease | null> { return this.core.get(leaseId, Date.now()); }
  async release(leaseId: string) { this.core.release(leaseId); }
  /** Add new coins to the rotation (deduplicated). */
  async addCoins(ids: string[]): Promise<number> {
    await this.ready();
    const next = [...new Set([...this.core.coinList(), ...ids])];
    await this.ctx.storage.put('coins', next);
    this.core.setCoins(next);
    return next.length;
  }

  /** Read-only: the coins currently in rotation (for the admin health view). */
  async coins(): Promise<string[]> { await this.ready(); return this.core.coinList(); }

  async retire(coinId: string) {
    await this.ready();
    this.core.retire(coinId);
    await this.ctx.storage.put('coins', this.core.coinList());
    return this.core.coinsLeft();
  }
}
