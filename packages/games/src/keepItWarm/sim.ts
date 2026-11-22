import { mulberry32 } from '../rng';

/** One button change at a 60 Hz tick. */
export type KIWInput = { tick: number; down: boolean };
export type KIWStage = 0 | 1 | 2;
/** What the page around the game sees while it runs (about 10 times a second). */
export type KIWLive = { tick: number; score: number; inZone: boolean; gust: 'warn' | 'on' | null; combo: number; done: boolean };
export type KIWGust = 'warn' | 'on' | null;
export type KIWFrame = { heat: number; zoneCenter: number; zoneWidth: number; inZone: boolean; down: boolean; gust: KIWGust; combo: number };

/** The three egg stages. Stage 0 is the original game; tuned so a typical player scores about the same on each. */
export const KIW_STAGES = [
  { name: 'First warmth', rule: 'Hold to warm, let go to cool. Keep the needle in the glow.', zoneBonus: 0, gusts: false, follow: 1, combo: false, comboStep: 0, comboMax: 1 },
  { name: 'Wind gusts', rule: 'Gusts blow the heat away. Watch for the warning and hold through it.', zoneBonus: 0.03, gusts: true, follow: 1, combo: false, comboStep: 0, comboMax: 1 },
  { name: 'Blizzard', rule: 'The glow moves fast. Stay in it to build a combo up to ×1.5.', zoneBonus: 0.02, gusts: false, follow: 1.6, combo: true, comboStep: 0.002, comboMax: 1.5 },
] as const;
const GUST = { WARN: 60, ON: 90, COOL_PER_S: 0.5, GAP: 300, FIRST: 240 } as const;
export type KIWResult = { score: number; cracked: boolean; endTick: number; frames?: KIWFrame[] };

export const KIW = {
  TICKS: 1800, // 30 s at 60 Hz
  MAX_SCORE: 1000,
  START_HEAT: 0.3,
  HEAT_UP_PER_S: 0.55,
  COOL_PER_S: 0.35,
  BASE_ZONE: 0.18,
  ZONE_PER_WARMTH: 0.02,
  RETARGET_EVERY: 90,
  ZONE_FOLLOW: 0.02,
  ZONE_MIN: 0.2,
  ZONE_SPAN: 0.6,
} as const;

/**
 * Steps Keep It Warm one 60 Hz tick at a time. The browser drives it live; `simulateKeepItWarm`
 * drives the same class from a recorded log, so both always compute the same score.
 */
export class KIWRunner {
  tick = 0;
  done = false;
  cracked = false;
  heat: number = KIW.START_HEAT;
  center = 0.5;
  readonly zoneWidth: number;
  readonly inputs: KIWInput[] = [];
  private target = 0.5;
  private down = false;
  private inZoneTicks = 0;
  private weighted = 0;
  private rng: () => number;
  private readonly rules: (typeof KIW_STAGES)[number];
  private readonly gustAt: number[] = [];
  combo = 1;

  constructor(seed: number, warmth = 0, readonly stage: KIWStage = 0) {
    this.rng = mulberry32(seed);
    this.rules = KIW_STAGES[stage];
    this.zoneWidth = KIW.BASE_ZONE + KIW.ZONE_PER_WARMTH * warmth + this.rules.zoneBonus;
    if (this.rules.gusts) {
      // A separate stream so the zone path stays the same as stage 0's for this seed.
      const g = mulberry32((seed ^ 0x9e3779b9) >>> 0);
      for (let t = GUST.FIRST + Math.floor(g() * 120); t + GUST.ON < KIW.TICKS; t += GUST.GAP + Math.floor(g() * 240)) this.gustAt.push(t);
    }
  }

  /** Whether a gust is coming (`warn`), blowing (`on`) or not, at tick `t`. */
  gustAtTick(t: number): KIWGust {
    for (const s of this.gustAt) {
      if (t >= s && t < s + GUST.ON) return 'on';
      if (t >= s - GUST.WARN && t < s) return 'warn';
    }
    return null;
  }

  get inZone() { return Math.abs(this.heat - this.center) <= this.zoneWidth / 2; }

  step(down: boolean): KIWFrame | null {
    if (this.done) return null;
    const t = this.tick;
    if (down !== this.down) { this.down = down; this.inputs.push({ tick: t, down }); }
    if (t % KIW.RETARGET_EVERY === 0) this.target = KIW.ZONE_MIN + this.rng() * KIW.ZONE_SPAN;
    this.center += (this.target - this.center) * KIW.ZONE_FOLLOW * this.rules.follow;
    const gust = this.gustAtTick(t);
    this.heat = Math.min(1, Math.max(0, this.heat + ((down ? KIW.HEAT_UP_PER_S : -KIW.COOL_PER_S) - (gust === 'on' ? GUST.COOL_PER_S : 0)) / 60));
    const inZone = this.inZone;
    if (inZone) this.inZoneTicks++;
    if (this.rules.combo) this.combo = inZone ? Math.min(this.rules.comboMax, this.combo + this.rules.comboStep) : 1;
    if (inZone) this.weighted += this.combo;
    this.tick = t + 1;
    if (this.heat >= 1) { this.cracked = true; this.done = true; }
    if (this.tick >= KIW.TICKS) this.done = true;
    return { heat: this.heat, zoneCenter: this.center, zoneWidth: this.zoneWidth, inZone, down, gust, combo: this.combo };
  }

  /** The score banked so far (it only grows; equals the final score when the run ends). */
  liveScore() {
    const ticks = this.rules.combo ? this.weighted : this.inZoneTicks;
    return Math.min(KIW.MAX_SCORE, Math.floor((ticks * KIW.MAX_SCORE) / KIW.TICKS));
  }

  result() {
    return { score: this.liveScore(), cracked: this.cracked, endTick: this.tick };
  }
}

/** Replays a recorded input log (used by the Worker to verify a run). */
export function simulateKeepItWarm(
  seed: number,
  inputs: KIWInput[],
  warmth = 0,
  opts: { record?: boolean; stage?: KIWStage } = {},
): KIWResult {
  const r = new KIWRunner(seed, warmth, opts.stage ?? 0);
  const frames: KIWFrame[] | undefined = opts.record ? [] : undefined;
  let next = 0;
  let down = false;
  while (!r.done) {
    while (next < inputs.length && inputs[next].tick <= r.tick) down = inputs[next++].down;
    const f = r.step(down);
    if (f) frames?.push(f);
  }
  return { ...r.result(), frames };
}
