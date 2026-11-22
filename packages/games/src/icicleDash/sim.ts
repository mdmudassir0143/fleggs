import { mulberry32 } from '../rng';

/** A lane change pressed at a 60 Hz tick. */
export type IDInput = { tick: number; dir: -1 | 1 };
export type Icicle = { wave: number; lane: number; spawnTick: number; fallTicks: number; y: number; resolved: boolean };
export type Wave = { id: number; free: number[]; impactTick: number };
export type IDResult = { score: number; endTick: number; dodged: number; hits: number };

export const ID = {
  TICKS: 2700, // 45 s
  LANES: 3,
  LIVES: 3,
  MAX_SCORE: 1000,
  CHANGE_TICKS: 12,
  CHANGE_MIN: 4,
  BONUS_PER_POINT: 0.06,
  INTERVAL_START: 86,
  INTERVAL_END: 26,
  FALL_START: 110,
  FALL_END: 58,
  PLAYER_Y: 0.86,
} as const;

/**
 * Icicle Dash, one 60 Hz tick at a time. Waves of icicles fall; each wave leaves one or two lanes
 * free, and the free lane only ever shifts by one lane between waves, so a perfect run always exists.
 * The browser drives it live; `simulateIcicleDash` replays a log so the Worker gets the same score.
 */
export class IDRunner {
  tick = 0;
  done = false;
  lives: number = ID.LIVES;
  lane = 1;
  /** Visual position (lane units), eases toward `lane` during a change. */
  pos = 1;
  moving = false;
  dodged = 0;
  hits = 0;
  survived = 0;
  readonly changeTicks: number;
  readonly inputs: IDInput[] = [];
  readonly icicles: Icicle[] = [];
  private waves: Wave[] = [];
  private from = 1;
  private moveStart = 0;
  private nextSpawn = 90;
  private safe = 1;
  private waveId = 0;
  private rng: () => number;

  constructor(seed: number, speedBonus = 0) {
    this.rng = mulberry32(seed);
    this.changeTicks = Math.max(ID.CHANGE_MIN, Math.round(ID.CHANGE_TICKS * (1 - ID.BONUS_PER_POINT * speedBonus)));
  }

  /** The next wave that has not reached the player yet (for UI hints and tests). */
  nextWave(): Wave | undefined {
    return this.waves.find((w) => w.impactTick >= this.tick);
  }

  private progress() { return Math.min(1, this.tick / ID.TICKS); }

  private spawn() {
    const p = this.progress();
    const fallTicks = Math.round(ID.FALL_START + (ID.FALL_END - ID.FALL_START) * p);
    // The safe lane drifts by at most one lane per wave.
    const drift = Math.floor(this.rng() * 3) - 1;
    this.safe = Math.max(0, Math.min(ID.LANES - 1, this.safe + drift));
    const double = this.rng() < 0.25 + 0.45 * p;
    let blocked: number[];
    if (double) blocked = [0, 1, 2].filter((l) => l !== this.safe);
    else { const others = [0, 1, 2].filter((l) => l !== this.safe); blocked = [others[Math.floor(this.rng() * others.length)]]; }
    const id = this.waveId++;
    for (const lane of blocked) this.icicles.push({ wave: id, lane, spawnTick: this.tick, fallTicks, y: 0, resolved: false });
    this.waves.push({ id, free: [0, 1, 2].filter((l) => !blocked.includes(l)), impactTick: this.tick + Math.round(fallTicks * ID.PLAYER_Y) });
    const interval = Math.round(ID.INTERVAL_START + (ID.INTERVAL_END - ID.INTERVAL_START) * p);
    this.nextSpawn = this.tick + interval;
  }

  step(dir: -1 | 0 | 1) {
    if (this.done) return;
    const t = this.tick;
    if (dir !== 0) {
      this.inputs.push({ tick: t, dir });
      const to = this.lane + dir;
      if (!this.moving && to >= 0 && to < ID.LANES) { this.from = this.lane; this.lane = to; this.moving = true; this.moveStart = t; }
    }
    if (this.moving) {
      const k = Math.min(1, (t - this.moveStart + 1) / this.changeTicks);
      this.pos = this.from + (this.lane - this.from) * k;
      if (k >= 1) this.moving = false;
    } else this.pos = this.lane;
    if (t >= this.nextSpawn && t < ID.TICKS - 60) this.spawn();
    const occupied = Math.round(this.pos);
    for (const ic of this.icicles) {
      if (ic.resolved) continue;
      ic.y = (t - ic.spawnTick) / ic.fallTicks;
      if (ic.y >= ID.PLAYER_Y) {
        ic.resolved = true;
        if (ic.lane === occupied) { this.hits++; this.lives--; } else this.dodged++;
      }
    }
    this.tick = t + 1;
    this.survived = this.tick;
    if (this.lives <= 0 || this.tick >= ID.TICKS) this.done = true;
  }

  result(): IDResult {
    const total = this.dodged + this.hits;
    const dodgeRate = total ? this.dodged / total : 0;
    // Survival scales everything (standing still dies early); clean dodging tops it up.
    const score = Math.floor(ID.MAX_SCORE * Math.pow(this.survived / ID.TICKS, 1.2) * (0.5 + 0.5 * dodgeRate));
    return { score: Math.max(0, Math.min(ID.MAX_SCORE, score)), endTick: this.tick, dodged: this.dodged, hits: this.hits };
  }
}

/** Replays a recorded input log (the Worker uses this to verify a run). */
export function simulateIcicleDash(seed: number, inputs: IDInput[], speedBonus = 0): IDResult {
  const r = new IDRunner(seed, speedBonus);
  let next = 0;
  while (!r.done) {
    let dir: -1 | 0 | 1 = 0;
    while (next < inputs.length && inputs[next].tick <= r.tick) { if (inputs[next].tick === r.tick) dir = inputs[next].dir; next++; }
    r.step(dir);
  }
  return r.result();
}
