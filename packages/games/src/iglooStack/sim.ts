import { mulberry32 } from '../rng';

/** A drop at a 60 Hz tick. */
export type ISInput = { tick: number };
export type Block = { center: number; width: number; perfect: boolean };
export type ISResult = { score: number; endTick: number; placed: number; perfect: number; width: number };

export const IS = {
  TICKS: 3600, // 60 s cap
  BLOCKS: 20,
  MAX_SCORE: 1000,
  AMPLITUDE: 1.2, // in base-block widths — wider than a block, so a full miss is possible
  BONUS_PER_POINT: 0.05,
  OMEGA: 0.04, // rad per tick at level 0
  OMEGA_PER_LEVEL: 0.002,
  PERFECT: 0.05, // > half the fastest per-tick movement, so a perfect drop is always reachable
  GAP_TICKS: 24, // pause after a drop while the block settles
} as const;

/**
 * Igloo Stack one tick at a time: an ice block swings over the igloo; tap to drop it. Whatever
 * hangs over the edge is trimmed; a near-perfect drop snaps into place and keeps its width.
 * The browser drives it live; `simulateIglooStack` replays the drops so the Worker gets the same score.
 */
export class ISRunner {
  tick = 0;
  done = false;
  /** Current centre of the swinging block (base widths; the base sits at 0). */
  x = 0;
  swinging = false;
  readonly amplitude: number;
  readonly tower: Block[] = [{ center: 0, width: 1, perfect: true }];
  readonly inputs: ISInput[] = [];
  private level = 0;
  private swingStart = 0;
  private phase = 0;
  private omega: number = IS.OMEGA;
  private rng: () => number;
  private perfects = 0;

  constructor(seed: number, strengthBonus = 0) {
    this.rng = mulberry32(seed);
    this.amplitude = IS.AMPLITUDE * (1 - IS.BONUS_PER_POINT * Math.min(strengthBonus, 10));
    this.newBlock(0);
    this.refresh();
  }

  get top(): Block { return this.tower[this.tower.length - 1]; }
  get placed() { return this.tower.length - 1; }

  private newBlock(at: number) {
    this.swingStart = at;
    this.phase = this.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2; // start at one edge, either side
    this.omega = IS.OMEGA + IS.OMEGA_PER_LEVEL * this.level + this.rng() * 0.006;
    this.swinging = false;
  }

  /** Where the swinging block is at tick `t` (null while the last drop settles). */
  private posAt(t: number): number | null {
    if (t < this.swingStart + IS.GAP_TICKS) return null;
    return this.top.center + this.amplitude * Math.sin(this.phase + (t - this.swingStart - IS.GAP_TICKS) * this.omega);
  }

  /** Shows the block where a drop on the coming tick will be judged, so what you see is what lands. */
  private refresh() {
    const p = this.posAt(this.tick);
    this.swinging = p !== null;
    if (p !== null) this.x = p;
  }

  step(drop: boolean) {
    if (this.done) return;
    const t = this.tick;
    if (drop && this.swinging) {
      this.inputs.push({ tick: t });
      const below = this.top;
      const offset = this.x - below.center;
      const overlap = below.width - Math.abs(offset);
      if (overlap <= 0) { this.done = true; }
      else if (Math.abs(offset) <= IS.PERFECT) {
        this.tower.push({ center: below.center, width: below.width, perfect: true });
        this.perfects++;
      } else {
        this.tower.push({ center: below.center + offset / 2, width: overlap, perfect: false });
      }
      this.level++;
      if (!this.done) {
        if (this.placed >= IS.BLOCKS) this.done = true;
        else this.newBlock(t + 1);
      }
    }
    this.tick = t + 1;
    if (this.tick >= IS.TICKS) this.done = true;
    this.refresh();
  }

  result(): ISResult {
    const score = Math.floor(IS.MAX_SCORE * (0.65 * (this.placed / IS.BLOCKS) + 0.35 * (this.perfects / IS.BLOCKS)));
    return { score: Math.max(0, Math.min(IS.MAX_SCORE, score)), endTick: this.tick, placed: this.placed, perfect: this.perfects, width: this.top.width };
  }
}

/** Replays a recorded drop log (the Worker uses this to verify a run). */
export function simulateIglooStack(seed: number, inputs: ISInput[], strengthBonus = 0): ISResult {
  const r = new ISRunner(seed, strengthBonus);
  const ticks = new Set(inputs.map((i) => i.tick));
  while (!r.done) r.step(ticks.has(r.tick));
  return r.result();
}
