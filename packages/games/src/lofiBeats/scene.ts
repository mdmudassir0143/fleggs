import Phaser from 'phaser';
import { LB, LBRunner, type LBInput, type LBResult } from './sim';

export type LBSceneData = {
  seed: number;
  bonus?: number;
  onFinish(result: LBResult, inputs: LBInput[]): void;
};

const INK = 0x14213d, SNOW = 0xffffff;
const W = 360, H = 560;
const STEP_MS = 1000 / 60;
const HIT_Y = 452;
const SPEED = 4.4; // px per tick
const LANE_COLORS = [0x5ee6c0, 0x9b7bf0, 0x7fb7ff];
const LANE_HEX = ['#5ee6c0', '#9b7bf0', '#7fb7ff'];
const laneX = (l: number) => 72 + l * 108;
const PENTA = [523.25, 659.25, 783.99]; // C5 E5 G5 — each lane its own chime

/** Lofi Beats: tap each lane as its snowflake reaches the line, in time with a soft lofi beat. */
export class LofiBeatsScene extends Phaser.Scene {
  private runner!: LBRunner;
  private opts!: LBSceneData;
  private acc = 0;
  private started = false;
  private finished = false;
  private pending = -1;
  private g!: Phaser.GameObjects.Graphics;
  private combo!: Phaser.GameObjects.Text;
  private timer!: Phaser.GameObjects.Text;
  private judgeText: Phaser.GameObjects.Text[] = [];
  private pads: Phaser.GameObjects.Arc[] = [];
  private audio: AudioContext | null = null;
  private nextBeat = 0;
  private lastJudged: object | null = null;

  constructor() { super('lofi-beats'); }

  init(data: LBSceneData) {
    this.opts = data;
    this.runner = new LBRunner(data.seed, data.bonus ?? 0);
    this.acc = 0; this.started = false; this.finished = false; this.pending = -1; this.nextBeat = 0; this.lastJudged = null;
    this.judgeText = []; this.pads = [];
  }

  create() {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0e1a33, 0x0e1a33, 0x1c2e57, 0x1c2e57, 1).fillRect(0, 0, W, H);
    // soft aurora ribbons
    for (const [c, y, a] of [[0x5ee6c0, 120, 0.22], [0x9b7bf0, 160, 0.18]] as const) {
      bg.fillStyle(c, a);
      bg.beginPath(); bg.moveTo(-20, y);
      for (let x = 0; x <= W + 20; x += 20) bg.lineTo(x, y + Math.sin(x / 45) * 18);
      bg.lineTo(W + 20, y + 40); bg.lineTo(-20, y + 40); bg.closePath(); bg.fillPath();
    }
    for (let i = 0; i < 40; i++) this.add.circle(Math.random() * W, Math.random() * 300, 1 + Math.random(), SNOW, 0.6);
    // lanes
    for (let l = 0; l < 3; l++) {
      bg.fillStyle(LANE_COLORS[l], 0.08).fillRoundedRect(laneX(l) - 44, 60, 88, HIT_Y - 20, 30);
    }
    bg.lineStyle(4, SNOW, 0.85).lineBetween(20, HIT_Y, W - 20, HIT_Y);
    this.g = this.add.graphics();
    for (let l = 0; l < 3; l++) {
      this.pads.push(this.add.circle(laneX(l), HIT_Y, 30, LANE_COLORS[l], 0.35).setStrokeStyle(4, SNOW));
      this.judgeText.push(this.add.text(laneX(l), HIT_Y - 60, '', { fontFamily: 'Fredoka, sans-serif', fontSize: '18px', fontStyle: '700', color: '#ffffff', stroke: '#14213d', strokeThickness: 5 }).setOrigin(0.5).setAlpha(0));
    }
    const font = { fontFamily: 'Fredoka, sans-serif', color: '#14213d', fontStyle: '600' };
    const pill = this.add.graphics();
    pill.fillStyle(SNOW).fillRoundedRect(W - 96, 16, 80, 40, 20).lineStyle(3, INK).strokeRoundedRect(W - 96, 16, 80, 40, 20);
    this.timer = this.add.text(W - 56, 36, '', { ...font, fontSize: '20px' }).setOrigin(0.5);
    this.combo = this.add.text(W / 2, 36, '', { fontFamily: 'Fredoka, sans-serif', fontSize: '24px', fontStyle: '700', color: '#ffffff' }).setOrigin(0.5);
    this.add.text(W / 2, H - 40, 'Tap the lanes, or J · K · L', { fontFamily: 'Figtree, sans-serif', fontSize: '14px', color: '#cfe0f5' }).setOrigin(0.5);

    const tap = (l: number) => { this.pending = l; this.flashPad(l); };
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => tap(Math.max(0, Math.min(2, Math.floor(p.x / (W / 3))))));
    const keys: Record<string, number> = { J: 0, K: 1, L: 2, LEFT: 0, DOWN: 1, RIGHT: 2, ONE: 0, TWO: 1, THREE: 2 };
    for (const [k, l] of Object.entries(keys)) this.input.keyboard?.on(`keydown-${k}`, () => tap(l));

    const count = this.add.text(W / 2, H * 0.42, '3', { ...font, fontSize: '84px', color: '#ffffff', stroke: '#14213d', strokeThickness: 10 }).setOrigin(0.5);
    const pop = () => this.tweens.add({ targets: count, scale: { from: 1.6, to: 1 }, alpha: { from: 0.2, to: 1 }, duration: 380, ease: 'Back.out' });
    pop();
    [2, 1].forEach((n, i) => this.time.delayedCall(700 * (i + 1), () => { count.setText(String(n)); pop(); }));
    this.time.delayedCall(2100, () => {
      count.setText('Go!'); pop();
      this.tweens.add({ targets: count, alpha: 0, delay: 350, duration: 250, onComplete: () => count.destroy() });
      this.started = true;
      try { this.audio = new AudioContext(); } catch { this.audio = null; }
      this.events.once('shutdown', () => { void this.audio?.close(); this.audio = null; });
      this.events.once('destroy', () => { void this.audio?.close(); this.audio = null; });
    });
    this.draw();
  }

  private tone(f: number, at: number, len: number, peak: number, type: OscillatorType = 'sine') {
    const c = this.audio; if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, at);
    g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(peak, at + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    o.connect(g).connect(c.destination); o.start(at); o.stop(at + len + 0.05);
  }

  private flashPad(l: number) {
    this.tweens.add({ targets: this.pads[l], scale: { from: 1.25, to: 1 }, duration: 160, ease: 'Quad.out' });
  }

  update(_t: number, delta: number) {
    if (!this.started || this.finished) return;
    this.acc += Math.min(delta, 250);
    while (this.acc >= STEP_MS && !this.runner.done) {
      // soft beat: a round low "kick" on each beat, a whisper on the off-beat
      const beatTicks = (60 * 60) / LB.BPM;
      if (this.runner.tick >= this.nextBeat * beatTicks / 2 && this.audio) {
        const on = this.nextBeat % 2 === 0;
        this.tone(on ? 70 : 2200, this.audio.currentTime, on ? 0.22 : 0.04, on ? 0.18 : 0.012, on ? 'sine' : 'triangle');
        this.nextBeat++;
      }
      this.runner.step(this.pending);
      this.pending = -1;
      this.acc -= STEP_MS;
    }
    const last = this.runner.last;
    if (last && last !== this.lastJudged) {
      this.lastJudged = last;
      const t = this.judgeText[last.lane];
      t.setText(last.judgement === 'perfect' ? 'Perfect!' : last.judgement === 'good' ? 'Good' : 'Miss').setColor(last.judgement === 'miss' ? '#cfd8e8' : LANE_HEX[last.lane]);
      this.tweens.killTweensOf(t);
      t.setAlpha(1).setY(HIT_Y - 60);
      this.tweens.add({ targets: t, y: HIT_Y - 90, alpha: 0, duration: 520, ease: 'Quad.out' });
      if (last.judgement !== 'miss' && this.audio) this.tone(PENTA[last.lane] * (last.judgement === 'perfect' ? 1 : 0.5), this.audio.currentTime, 0.6, 0.06);
    }
    this.draw();
    if (this.runner.done) this.finish();
  }

  private finish() {
    this.finished = true;
    const r = this.runner.result();
    this.add.text(W / 2, H * 0.4, `${r.perfect} perfect`, { fontFamily: 'Fredoka, sans-serif', fontSize: '40px', fontStyle: '700', color: '#ffffff', stroke: '#14213d', strokeThickness: 8 }).setOrigin(0.5);
    this.time.delayedCall(900, () => this.opts.onFinish(r, [...this.runner.inputs]));
  }

  private draw() {
    const r = this.runner;
    const g = this.g.clear();
    for (const n of r.notes) {
      const y = HIT_Y - (n.tick - r.tick) * SPEED;
      if (y < 40 || n.judged === 'perfect' || n.judged === 'good' || y > H) continue;
      const x = laneX(n.lane), c = LANE_COLORS[n.lane];
      g.fillStyle(c, 0.25).fillCircle(x, y, 22);
      // six-armed snowflake
      g.lineStyle(4, n.judged === 'miss' ? 0x6b7591 : SNOW, 1);
      for (let k = 0; k < 3; k++) {
        const a = (Math.PI / 3) * k + r.tick * 0.02;
        g.lineBetween(x - Math.cos(a) * 14, y - Math.sin(a) * 14, x + Math.cos(a) * 14, y + Math.sin(a) * 14);
      }
      g.fillStyle(SNOW).fillCircle(x, y, 4);
    }
    this.combo.setText(r.combo >= 3 ? `${r.combo} combo` : '');
    this.timer.setText(`${Math.max(0, Math.ceil((LB.TICKS - r.tick) / 60))}s`);
  }
}

export function lofiBeatsConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return { type: Phaser.AUTO, parent, width: W, height: H, backgroundColor: '#0e1a33', scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, audio: { noAudio: true }, scene: [] };
}
