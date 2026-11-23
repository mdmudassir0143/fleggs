import { describe, expect, test } from 'vitest';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { DAY_MS, GAME, PURPOSE, dailyGame, trainSnowflakes } from '@flurry/shared';
import { chartFor, simulateIcicleDash, simulateIglooStack, simulateLofiBeats, simulateKeepItWarm } from '@flurry/games';
import { createRunService, MemoryKV, RunError } from './runs';

const PROFILE = '0x' + 'ab'.repeat(32), OWNER = '0x' + 'cd'.repeat(32), YETI = '0x' + 'ef'.repeat(32);
const signer = Ed25519Keypair.fromSecretKey(new Uint8Array(32).fill(9));
const DAY = 20_001; // dailyGame(20001) === 1 (Icicle Dash)

function setup(points = [1, 3, 2], plays: { day: number; used: number; credits: number } | null = null) {
  let now = DAY * DAY_MS + 3_600_000;
  const chain = {
    getPlays: async () => plays,
    getNonce: async () => 0n,
    getProfileOwner: async () => OWNER,
    getYeti: async (id: string) => (id === YETI ? { owner: OWNER, points } : { owner: '0x' + '99'.repeat(32), points: [9, 9, 9] }),
  };
  const svc = createRunService({ kv: new MemoryKV(), chain, signer, now: () => now, randomSeed: () => 4321 });
  return { svc, advance: (ms: number) => (now += ms) };
}

const LOGS: Record<number, unknown[]> = {
  [GAME.KeepItWarm]: [{ tick: 0, down: true }, { tick: 50, down: false }],
  [GAME.IcicleDash]: [{ tick: 100, dir: 1 }, { tick: 300, dir: -1 }],
  [GAME.LofiBeats]: chartFor(4321).slice(0, 10).map((n) => ({ tick: n.tick, lane: n.lane })),
  [GAME.IglooStack]: [{ tick: 60 }, { tick: 130 }, { tick: 210 }],
};

describe('run service: all games, training and daily', () => {
  test('replays each of the four games with the bonus read from chain', async () => {
    const sims = {
      [GAME.KeepItWarm]: (s: number, i: never[], b: number) => simulateKeepItWarm(s, i, b).score,
      [GAME.IcicleDash]: (s: number, i: never[], b: number) => simulateIcicleDash(s, i, b).score,
      [GAME.LofiBeats]: (s: number, i: never[], b: number) => simulateLofiBeats(s, i, b).score,
      [GAME.IglooStack]: (s: number, i: never[], b: number) => simulateIglooStack(s, i, b).score,
    } as Record<number, (s: number, i: never[], b: number) => number>;
    const points = [1, 3, 2];
    for (const game of [GAME.KeepItWarm, GAME.IcicleDash, GAME.LofiBeats, GAME.IglooStack]) {
      const ctx = setup(points);
      const { runId, seed, bonus: told } = await ctx.svc.start({ profileId: PROFILE, purpose: PURPOSE.Training, game, yetiId: YETI });
      expect(told).toBe(points[game] ?? 0); // the client plays with the bonus the replay will use
      ctx.advance(61_000);
      const res = await ctx.svc.finish({ runId, inputs: LOGS[game] });
      const bonus = points[game] ?? 0; // slot 3 missing on an L1 yeti → no Strength bonus
      expect(res.score).toBe(sims[game](seed, LOGS[game] as never[], bonus));
      expect(res.snowflakes).toBe(BigInt(trainSnowflakes(res.score)));
    }
  });

  test('bonus comes from chain, not the client', async () => {
    const ctx = setup([0, 0, 0]);
    const { runId, seed } = await ctx.svc.start({ profileId: PROFILE, purpose: PURPOSE.Training, game: GAME.IcicleDash, yetiId: YETI, bonus: 10 } as never);
    ctx.advance(61_000);
    const res = await ctx.svc.finish({ runId, inputs: LOGS[GAME.IcicleDash] });
    expect(res.score).toBe(simulateIcicleDash(seed, LOGS[GAME.IcicleDash] as never, 0).score);
  });

  test("a yeti owned by someone else can't lend its stats", async () => {
    const ctx = setup();
    await expect(ctx.svc.start({ profileId: PROFILE, purpose: PURPOSE.Training, game: 1, yetiId: '0x' + '12'.repeat(32) })).rejects.toThrow(/not your yeti/);
  });

  test('rejects a daily run with the wrong game', async () => {
    const ctx = setup();
    expect(dailyGame(DAY)).toBe(GAME.IcicleDash);
    await expect(ctx.svc.start({ profileId: PROFILE, purpose: PURPOSE.Daily, game: GAME.LofiBeats })).rejects.toThrow(/today's game/);
    await expect(ctx.svc.start({ profileId: PROFILE, purpose: PURPOSE.Daily, game: GAME.IcicleDash })).resolves.toBeTruthy();
  });

  test('egg stages are Keep It Warm only', async () => {
    const ctx = setup();
    await expect(ctx.svc.start({ profileId: PROFILE, purpose: PURPOSE.EggStage, game: GAME.LofiBeats })).rejects.toThrow(RunError);
  });

  test('too-fast finish is rejected per game duration', async () => {
    const ctx = setup();
    const { runId } = await ctx.svc.start({ profileId: PROFILE, purpose: PURPOSE.Training, game: GAME.LofiBeats });
    ctx.advance(5_000); // Lofi Beats always runs 40 s
    await expect(ctx.svc.finish({ runId, inputs: LOGS[GAME.LofiBeats] })).rejects.toThrow(/too fast/);
  });

  test('malformed inputs for a game are rejected', async () => {
    const ctx = setup();
    const { runId } = await ctx.svc.start({ profileId: PROFILE, purpose: PURPOSE.Training, game: GAME.IcicleDash });
    ctx.advance(61_000);
    await expect(ctx.svc.finish({ runId, inputs: [{ tick: 5, dir: 7 }] })).rejects.toThrow(/invalid input/);
  });

  test('start refuses a training run when no plays are left today', async () => {
    const ctx = setup([1, 3, 2], { day: DAY, used: 2, credits: 0 });
    await expect(ctx.svc.start({ profileId: PROFILE, purpose: PURPOSE.Training, game: GAME.IcicleDash })).rejects.toThrow(/free plays/);
  });

  test('a bought play (or a new day) lets the run start', async () => {
    await expect(setup([1, 3, 2], { day: DAY, used: 2, credits: 1 }).svc.start({ profileId: PROFILE, purpose: PURPOSE.Training, game: 1 })).resolves.toBeTruthy();
    await expect(setup([1, 3, 2], { day: DAY - 1, used: 2, credits: 0 }).svc.start({ profileId: PROFILE, purpose: PURPOSE.Training, game: 1 })).resolves.toBeTruthy();
  });

  test('daily runs are not counted against training plays', async () => {
    const ctx = setup([1, 3, 2], { day: DAY, used: 2, credits: 0 });
    await expect(ctx.svc.start({ profileId: PROFILE, purpose: PURPOSE.Daily, game: GAME.IcicleDash })).resolves.toBeTruthy();
  });
});

