import { mulberry32 } from '../rng';

/** A tap on a lane at a 60 Hz tick. */
export type LBInput = { tick: number; lane: number };
export type Note = { tick: number; lane: number; judged: 'perfect' | 'good' | 'miss' | null };
export type Judgement = 'perfect' | 'good' | 'miss';
export type LBResult = { score: number; endTick: number; perfect: number; good: number; missed: number; maxCombo: number };

export const LB = {
  TICKS: 2400, // 40 s
  BPM: 84,
  LANES: 3,
  MAX_SCORE: 1000,
  PERFECT: 3,
  GOOD: 7,
  BONUS_PER_POINT: 0.5,
  LEAD_IN_BEATS: 4,
} as const;

const EIGHTH = (60 * 60) / LB.BPM / 2; // ticks per eighth note

/** The note chart for a seed: eighth-note grid, denser later, never two notes closer than 8 ticks. */
export function chartFor(seed: number): { tick: number; lane: number }[] {
  const rng = mulberry32(seed ^ 0x5eed);
  const out: { tick: number; lane: number }[] = [];
  let lane = 1;
  const last = Math.floor((LB.TICKS - 90) / EIGHTH);
  for (let i = LB.LEAD_IN_BEATS * 2; i < last; i++) {
    const tick = Math.round(i * EIGHTH);
    const p = tick / LB.TICKS;
    const onBeat = i % 2 === 0;
    const chance = (onBeat ? 0.55 : 0.2) + 0.3 * p;
    if (rng() < chance) {
      lane = Math.max(0, Math.min(LB.LANES - 1, lane + Math.floor(rng() * 3) - 1));
      if (!out.length || tick - out[out.length - 1].tick >= 8) out.push({ tick, lane });
    }
  }
  return out;
}

/**
 * Lofi Beats one tick at a time: tap a lane as a glowing snowflake reaches the line.
 * Perfect within ±3 ticks (wider with the Magic bonus), Good within ±7. The browser drives it
 * live; `simulateLofiBeats` replays a log so the Worker gets the same score.
 */
export class LBRunner {
  tick = 0;
  done = false;
  perfect = 0;
  good = 0;
  missed = 0;
  combo = 0;
  maxCombo = 0;
  last: { judgement: Judgement; lane: number; tick: number } | null = null;
  readonly notes: Note[];
  readonly perfectWindow: number;
  readonly inputs: LBInput[] = [];

  constructor(seed: number, magicBonus = 0) {
    this.notes = chartFor(seed).map((n) => ({ ...n, judged: null }));
    this.perfectWindow = LB.PERFECT + LB.BONUS_PER_POINT * magicBonus;
  }

  private judge(note: Note | undefined, j: Judgement, lane: number) {
    if (note) note.judged = j;
    if (j === 'miss') { this.combo = 0; if (note) this.missed++; }
    else { this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo); j === 'perfect' ? this.perfect++ : this.good++; }
    this.last = { judgement: j, lane, tick: this.tick };
  }

  /** `lane` is -1 for no tap this tick. */
  step(lane: number) {
    if (this.done) return;
    const t = this.tick;
    if (lane >= 0 && lane < LB.LANES) {
      this.inputs.push({ tick: t, lane });
      let best: Note | undefined;
      for (const n of this.notes) {
        if (n.judged || n.lane !== lane || Math.abs(n.tick - t) > LB.GOOD) continue;
        if (!best || Math.abs(n.tick - t) < Math.abs(best.tick - t)) best = n;
      }
      if (best) this.judge(best, Math.abs(best.tick - t) <= this.perfectWindow ? 'perfect' : 'good', lane);
      else this.judge(undefined, 'miss', lane); // a tap on nothing breaks the combo
    }
    for (const n of this.notes) if (!n.judged && t - n.tick > LB.GOOD) this.judge(n, 'miss', n.lane);
    this.tick = t + 1;
    if (this.tick >= LB.TICKS) this.done = true;
  }

  result(): LBResult {
    const total = this.notes.length || 1;
    const accuracy = (this.perfect + 0.5 * this.good) / total;
    const score = Math.floor(LB.MAX_SCORE * (0.9 * accuracy + 0.1 * (this.maxCombo / total)));
    return { score: Math.max(0, Math.min(LB.MAX_SCORE, score)), endTick: this.tick, perfect: this.perfect, good: this.good, missed: this.missed, maxCombo: this.maxCombo };
  }
}

/** Replays a recorded tap log (the Worker uses this to verify a run). */
export function simulateLofiBeats(seed: number, inputs: LBInput[], magicBonus = 0): LBResult {
  const r = new LBRunner(seed, magicBonus);
  const sorted = [...inputs].sort((a, b) => a.tick - b.tick);
  let next = 0;
  while (!r.done) {
    let lane = -1;
    while (next < sorted.length && sorted[next].tick < r.tick) next++;
    if (next < sorted.length && sorted[next].tick === r.tick) lane = sorted[next++].lane;
    r.step(lane); // one tap per tick, exactly as the live scene sends them; extras are ignored
  }
  return r.result();
}
