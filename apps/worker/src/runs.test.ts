import { beforeEach, describe, expect, test } from 'vitest';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromBase64 } from '@mysten/sui/utils';
import { encodeAttestation, PURPOSE, GAME, ATTESTATION_TTL_MS } from '@flurry/shared';
import { simulateKeepItWarm, type KIWInput } from '@flurry/games';
import { createRunService, MemoryKV, RunError } from './runs';

const PROFILE = '0x' + 'ab'.repeat(32);
const OWNER = '0x' + 'cd'.repeat(32);
const EGG = '0x' + 'ee'.repeat(32);
const signer = Ed25519Keypair.fromSecretKey(new Uint8Array(32).fill(9));
const held: KIWInput[] = [{ tick: 0, down: true }, { tick: 40, down: false }, { tick: 90, down: true }, { tick: 120, down: false }];

function setup(nonce = 3n) {
  let now = 1_000_000;
  const chain = {
    nonce, getNonce: async () => chain.nonce,
    eggOwner: OWNER, eggStages: 0, others: [] as { id: string; stages: number }[],
    getProfileOwner: async () => OWNER,
    // The profile owner's eggs (EGG is theirs unless eggOwner says otherwise).
    getEggs: async (owner: string) => [...(chain.eggOwner === owner ? [{ id: EGG, stages: chain.eggStages }] : []), ...chain.others],
  };
  const svc = createRunService({
    kv: new MemoryKV(),
    chain,
    signer,
    now: () => now,
    randomSeed: () => 1234,
  });
  return { svc, chain, advance: (ms: number) => (now += ms), nowRef: () => now };
}

describe('run service', () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => { ctx = setup(); });

  test('finish signs the replayed score, not a client value', async () => {
    const { runId, seed } = await ctx.svc.start({ profileId: PROFILE, purpose: PURPOSE.EggStage, game: GAME.KeepItWarm, eggId: EGG });
    ctx.advance(46_000);
    const res = await ctx.svc.finish({ runId, inputs: held, score: 1000 } as never);
    const expected = simulateKeepItWarm(seed, held).score;
    expect(res.score).toBe(expected);
    expect(res.snowflakes).toBe(BigInt(Math.floor(expected / 10)));
    expect(res.nonce).toBe(3n);
    expect(res.expiresMs).toBe(BigInt(ctx.nowRef() + ATTESTATION_TTL_MS));
    const msg = encodeAttestation({
      profileId: PROFILE, nonce: 3n, purpose: PURPOSE.EggStage, game: GAME.KeepItWarm,
      score: expected, snowflakes: res.snowflakes, expiresMs: res.expiresMs,
    });
    expect(await signer.getPublicKey().verify(msg, fromBase64(res.signature))).toBe(true);
  });

  test('finish twice for one run is rejected', async () => {
    const { runId } = await ctx.svc.start({ profileId: PROFILE, purpose: 0, game: 0, eggId: EGG });
    ctx.advance(46_000);
    await ctx.svc.finish({ runId, inputs: held });
    await expect(ctx.svc.finish({ runId, inputs: held })).rejects.toThrow(RunError);
  });

  test('finishing faster than the replayed game length is rejected', async () => {
    const { runId } = await ctx.svc.start({ profileId: PROFILE, purpose: 0, game: 0, eggId: EGG });
    ctx.advance(10_000); // the replay lasts 30 s (no crack), so 10 s is impossible
    await expect(ctx.svc.finish({ runId, inputs: held })).rejects.toThrow(/too fast/);
  });

  test('an early crack may finish early', async () => {
    const { runId } = await ctx.svc.start({ profileId: PROFILE, purpose: 0, game: 0, eggId: EGG });
    ctx.advance(2_000); // holding from tick 0 cracks after ~1.3 s
    const res = await ctx.svc.finish({ runId, inputs: [{ tick: 0, down: true }] });
    expect(res.score).toBeGreaterThanOrEqual(0);
  });

  test('non-increasing ticks are rejected', async () => {
    const { runId } = await ctx.svc.start({ profileId: PROFILE, purpose: 0, game: 0, eggId: EGG });
    ctx.advance(46_000);
    await expect(ctx.svc.finish({ runId, inputs: [{ tick: 5, down: true }, { tick: 5, down: false }] })).rejects.toThrow(/ticks/);
  });

  test('ticks beyond the game length are rejected', async () => {
    const { runId } = await ctx.svc.start({ profileId: PROFILE, purpose: 0, game: 0, eggId: EGG });
    ctx.advance(46_000);
    await expect(ctx.svc.finish({ runId, inputs: [{ tick: 1800, down: true }] })).rejects.toThrow(/ticks/);
  });

  test('unknown run is rejected', async () => {
    await expect(ctx.svc.finish({ runId: 'nope', inputs: [] })).rejects.toThrow(/unknown/);
  });

  test('reattest returns fresh expiry and current nonce', async () => {
    const { runId } = await ctx.svc.start({ profileId: PROFILE, purpose: 0, game: 0, eggId: EGG });
    ctx.advance(46_000);
    const first = await ctx.svc.finish({ runId, inputs: held });
    ctx.advance(60_000);
    ctx.chain.nonce = 4n;
    const again = await ctx.svc.reattest({ runId });
    expect(again.score).toBe(first.score);
    expect(again.nonce).toBe(4n);
    expect(again.expiresMs).toBe(first.expiresMs + 60_000n);
  });

  test('21st run in an hour is rejected', async () => {
    for (let i = 0; i < 20; i++) await ctx.svc.start({ profileId: PROFILE, purpose: 0, game: 0, eggId: EGG });
    await expect(ctx.svc.start({ profileId: PROFILE, purpose: 0, game: 0, eggId: EGG })).rejects.toThrow(/too many/);
  });

  test('unsupported game is rejected at start', async () => {
    await expect(ctx.svc.start({ profileId: PROFILE, purpose: 0, game: 1 })).rejects.toThrow(/game/);
  });
});

describe('egg stages are chosen by the Worker', () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => { ctx = setup(); });
  const start = (extra: object = {}) => ctx.svc.start({ profileId: PROFILE, purpose: PURPOSE.EggStage, game: GAME.KeepItWarm, eggId: EGG, ...extra } as never);

  test('an egg stage needs the egg', async () => {
    await expect(ctx.svc.start({ profileId: PROFILE, purpose: PURPOSE.EggStage, game: GAME.KeepItWarm })).rejects.toThrow('egg stages need the egg');
  });
  test("someone else's egg is refused", async () => {
    ctx.chain.eggOwner = '0x' + '11'.repeat(32);
    await expect(start()).rejects.toThrow('not your egg');
  });
  test('a fully warmed egg is refused', async () => {
    ctx.chain.eggStages = 3;
    await expect(start()).rejects.toThrow('this egg is ready to hatch');
  });
  test('the stage comes from the chain and the replay uses it (a client stage is ignored)', async () => {
    ctx.chain.eggStages = 1;
    const r = await start({ stage: 0 });
    expect(r.stage).toBe(1);
    // A log that idles: stage 1 gusts change nothing for an empty log, so use one that scores differently.
    let log: KIWInput[] = [];
    for (let k = 0; k < 40; k++) {
      const l = [{ tick: 0, down: true }, { tick: 50 + k, down: false }, { tick: 400 + k * 7, down: true }, { tick: 470 + k * 7, down: false }];
      if (simulateKeepItWarm(r.seed, l, 0, { stage: 1 }).score !== simulateKeepItWarm(r.seed, l, 0, { stage: 0 }).score) { log = l; break; }
    }
    expect(log.length).toBeGreaterThan(0);
    ctx.advance(60_000);
    const f = await ctx.svc.finish({ runId: r.runId, inputs: log });
    expect(f.score).toBe(simulateKeepItWarm(r.seed, log, 0, { stage: 1 }).score);
  });
});

describe('one egg at a time', () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => { ctx = setup(); });
  const start = () => ctx.svc.start({ profileId: PROFILE, purpose: PURPOSE.EggStage, game: GAME.KeepItWarm, eggId: EGG } as never);
  const OTHER = '0x' + '77'.repeat(32);

  test('a new egg waits while another one is part-warmed', async () => {
    ctx.chain.others = [{ id: OTHER, stages: 1 }];
    await expect(start()).rejects.toThrow('Finish warming and hatch the egg you started first.');
  });
  test('a new egg waits while another one is ready to hatch', async () => {
    ctx.chain.others = [{ id: OTHER, stages: 3 }];
    await expect(start()).rejects.toThrow('Finish warming and hatch the egg you started first.');
  });
  test('the started egg can carry on, and untouched eggs never block', async () => {
    ctx.chain.eggStages = 1;
    ctx.chain.others = [{ id: OTHER, stages: 0 }];
    expect((await start()).stage).toBe(1);
  });
  test('with nothing started, any egg can begin', async () => {
    ctx.chain.others = [{ id: OTHER, stages: 0 }];
    expect((await start()).stage).toBe(0);
  });
});

describe('waitlist gate', () => {
  test('a run is refused while the account is waiting for approval', async () => {
    let now = 1_000_000;
    const chain = { getNonce: async () => 3n, getProfileOwner: async () => OWNER, getEggs: async () => [{ id: EGG, stages: 0 }] };
    const mk = (ok: boolean) => createRunService({ kv: new MemoryKV(), chain, signer, now: () => now, randomSeed: () => 1, allowed: async () => ok });
    await expect(mk(false).start({ profileId: PROFILE, purpose: PURPOSE.EggStage, game: GAME.KeepItWarm, eggId: EGG } as never)).rejects.toThrow('Your account is waiting for approval.');
    expect((await mk(true).start({ profileId: PROFILE, purpose: PURPOSE.EggStage, game: GAME.KeepItWarm, eggId: EGG } as never)).stage).toBe(0);
  });
});
