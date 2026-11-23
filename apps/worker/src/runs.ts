import type { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { toBase64 } from '@mysten/sui/utils';
import { signAttestation, ATTESTATION_TTL_MS, GAME, PURPOSE, GAME_SLOT, dailyGame, dayIndex, trainSnowflakes, playsLeft } from '@flurry/shared';
import { KIW, ID, LB, IS, simulateKeepItWarm, simulateIcicleDash, simulateLofiBeats, simulateIglooStack } from '@flurry/games';

/** The slice of Workers KV the run service needs (so tests can use MemoryKV). */
export interface KVLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

export class MemoryKV implements KVLike {
  private m = new Map<string, string>();
  async get(k: string) { return this.m.get(k) ?? null; }
  async put(k: string, v: string) { this.m.set(k, v); }
}

/** A rejection the client caused; routes turn it into HTTP 400. */
export class RunError extends Error {}

export type RunDeps = {
  kv: KVLike;
  chain: {
    getNonce(profileId: string): Promise<bigint>;
    getProfileOwner?(profileId: string): Promise<string>;
    getYeti?(yetiId: string): Promise<{ owner: string; points: number[] }>;
    /** Every egg the address owns, with how many stages each has been warmed. */
    getEggs?(owner: string): Promise<{ id: string; stages: number }[]>;
    getPlays?(profileId: string, game: number): Promise<{ day: number; used: number; credits: number } | null>;
  };
  signer: Ed25519Keypair;
  now(): number;
  /** Waitlist gate: may this address play right now? (absent = everyone) */
  allowed?(address: string): Promise<boolean>;
  randomSeed(): number;
};

type RunRecord = {
  /** Keep It Warm egg stage (0–2), read from the egg on chain at start. */
  stage?: 0 | 1 | 2;
  profileId: string;
  purpose: number;
  game: number;
  seed: number;
  startedAt: number;
  /** Trait points read from chain for the game's slot (0 without a yeti). */
  bonus?: number;
  score?: number;
};

export type FinishResult = { score: number; snowflakes: bigint; expiresMs: bigint; signature: string; nonce: bigint };

const RUN_TTL_S = 600;
const MAX_RUNS_PER_HOUR = 20;
const CLOCK_SLACK_MS = 2_000;
/**
 * Each game: how long a run lasts, what one logged input looks like, and how to replay it.
 * The score always comes from this replay with the chain-read bonus, never from the client.
 */
const GAMES: Record<number, { ticks: number; valid(i: any): boolean; replay(seed: number, inputs: any[], bonus: number, stage: 0 | 1 | 2): { score: number; endTick: number } }> = {
  [GAME.KeepItWarm]: { ticks: KIW.TICKS, valid: (i) => typeof i.down === 'boolean', replay: (s, i, b, st) => simulateKeepItWarm(s, i, b, { stage: st }) },
  [GAME.IcicleDash]: { ticks: ID.TICKS, valid: (i) => i.dir === 1 || i.dir === -1, replay: (s, i, b) => simulateIcicleDash(s, i, b) },
  [GAME.LofiBeats]: { ticks: LB.TICKS, valid: (i) => Number.isInteger(i.lane) && i.lane >= 0 && i.lane < LB.LANES, replay: (s, i, b) => simulateLofiBeats(s, i, b) },
  [GAME.IglooStack]: { ticks: IS.TICKS, valid: () => true, replay: (s, i, b) => simulateIglooStack(s, i, b) },
};
const sameAddress = (a: string, b: string) => a.toLowerCase().replace(/^0x0*/, '') === b.toLowerCase().replace(/^0x0*/, '');

export function createRunService(deps: RunDeps) {
  const key = (id: string) => `run:${id}`;

  async function load(runId: string): Promise<RunRecord> {
    const raw = await deps.kv.get(key(runId));
    if (!raw) throw new RunError('unknown or expired run');
    return JSON.parse(raw);
  }

  async function attest(run: RunRecord, score: number): Promise<FinishResult> {
    const nonce = await deps.chain.getNonce(run.profileId);
    const snowflakes = BigInt(run.purpose === PURPOSE.EggStage ? Math.floor(score / 10) : trainSnowflakes(score));
    const expiresMs = BigInt(deps.now() + ATTESTATION_TTL_MS);
    const { signature } = await signAttestation(
      { profileId: run.profileId, nonce, purpose: run.purpose, game: run.game, score, snowflakes, expiresMs },
      deps.signer,
    );
    return { score, snowflakes, expiresMs, signature: toBase64(signature), nonce };
  }

  return {
    async start(req: { profileId: string; purpose: number; game: number; yetiId?: string; eggId?: string }) {
      if (!GAMES[req.game]) throw new RunError('unsupported game');
      if (deps.allowed && deps.chain.getProfileOwner && !(await deps.allowed(await deps.chain.getProfileOwner(req.profileId)))) throw new RunError('Your account is waiting for approval.');
      if (![PURPOSE.EggStage, PURPOSE.Training, PURPOSE.Daily].includes(req.purpose as 0 | 1 | 2)) throw new RunError('unsupported purpose');
      if (req.purpose === PURPOSE.EggStage && req.game !== GAME.KeepItWarm) throw new RunError('egg stages use the Keep It Warm game');
      if (req.purpose === PURPOSE.Daily && req.game !== dailyGame(dayIndex(deps.now()))) throw new RunError("that is not today's game");
      // Egg stages: the stage (calm, wind, blizzard) comes from the egg on chain, never the client.
      let stage: 0 | 1 | 2 = 0;
      if (req.purpose === PURPOSE.EggStage) {
        if (!req.eggId) throw new RunError('egg stages need the egg');
        if (!deps.chain.getEggs || !deps.chain.getProfileOwner) throw new RunError('egg lookups unavailable');
        const eggs = await deps.chain.getEggs(await deps.chain.getProfileOwner(req.profileId));
        const egg = eggs.find((e) => sameAddress(e.id, req.eggId!));
        if (!egg) throw new RunError('not your egg');
        if (egg.stages >= 3) throw new RunError('this egg is ready to hatch');
        // One egg at a time: once an egg is started, it has to be warmed and hatched before another begins.
        if (egg.stages === 0 && eggs.some((e) => e.stages > 0)) throw new RunError('Finish warming and hatch the egg you started first.');
        stage = egg.stages as 0 | 1 | 2;
      }
      // Training plays: two free per game per UTC day, then bought credits (enforced on chain too).
      if (req.purpose === PURPOSE.Training && deps.chain.getPlays) {
        const left = playsLeft(await deps.chain.getPlays(req.profileId, req.game), dayIndex(deps.now()));
        if (left.total === 0) throw new RunError("You've used today's 2 free plays of this game. Buy an extra play in the Shop, or come back tomorrow.");
      }
      // Stat bonus: the yeti's points for this game's trait slot, read from chain (only your own yeti).
      let bonus = 0;
      if (req.yetiId && req.purpose !== PURPOSE.EggStage) {
        if (!deps.chain.getYeti || !deps.chain.getProfileOwner) throw new RunError('yeti lookups unavailable');
        const [yeti, owner] = await Promise.all([deps.chain.getYeti(req.yetiId), deps.chain.getProfileOwner(req.profileId)]);
        if (!sameAddress(yeti.owner, owner)) throw new RunError('not your yeti');
        bonus = yeti.points[GAME_SLOT[req.game]] ?? 0;
      }
      const bucket = `rate:${req.profileId}:${Math.floor(deps.now() / 3_600_000)}`;
      const count = Number((await deps.kv.get(bucket)) ?? 0);
      if (count >= MAX_RUNS_PER_HOUR) throw new RunError('too many runs this hour');
      await deps.kv.put(bucket, String(count + 1), { expirationTtl: 3_600 });

      const runId = crypto.randomUUID();
      const run: RunRecord = { profileId: req.profileId, purpose: req.purpose, game: req.game, bonus, stage, seed: deps.randomSeed() >>> 0, startedAt: deps.now() };
      await deps.kv.put(key(runId), JSON.stringify(run), { expirationTtl: RUN_TTL_S });
      return { runId, seed: run.seed, startedAt: run.startedAt, bonus, stage }; // the client plays with the same bonus the replay uses
    },

    /** Replays the input log; the score is computed here, never taken from the client. */
    async finish(req: { runId: string; inputs: unknown[] }): Promise<FinishResult> {
      const run = await load(req.runId);
      if (run.score !== undefined) throw new RunError('run already finished');
      const game = GAMES[run.game];
      if (!Array.isArray(req.inputs) || req.inputs.length > 4000) throw new RunError('invalid input log');
      let last = -1;
      for (const i of req.inputs as any[]) {
        if (!i || !Number.isInteger(i.tick) || i.tick <= last || i.tick >= game.ticks || !game.valid(i)) throw new RunError('invalid input ticks');
        last = i.tick;
      }
      const result = game.replay(run.seed, req.inputs as any[], run.bonus ?? 0, run.stage ?? 0);
      const minElapsed = (result.endTick / 60) * 1000 - CLOCK_SLACK_MS;
      if (deps.now() - run.startedAt < minElapsed) throw new RunError('run finished too fast');
      run.score = result.score;
      await deps.kv.put(key(req.runId), JSON.stringify(run), { expirationTtl: RUN_TTL_S });
      return attest(run, result.score);
    },

    /** Fresh signature for an already-finished run (expired attestation or nonce moved). */
    async reattest(req: { runId: string }): Promise<FinishResult> {
      const run = await load(req.runId);
      if (run.score === undefined) throw new RunError('run not finished');
      return attest(run, run.score);
    },
  };
}
