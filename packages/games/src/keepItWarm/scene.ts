import Phaser from 'phaser';
import { KIW, KIWRunner, type KIWInput, type KIWLive } from './sim';

export type KIWSceneData = {
  seed: number;
  warmth?: number;
  /** Egg stage (0 calm, 1 wind gusts, 2 blizzard); decided by the Worker. */
  stage?: 0 | 1 | 2;
  /** Live progress for the page around the game (about 10 times a second). */
  onFrame?(f: KIWLive): void;
  onFinish(result: { score: number; cracked: boolean; endTick: number }, inputs: KIWInput[]): void;
};

const INK = 0x14213d, SNOW = 0xffffff, ICE = 0xe3f0f9, SKY = 0x86c3e8, EMBER = 0xf07a3a, LOFI = 0x5e8fd3;
const W = 360, H = 560;
const BAR = { x: 286, top: 70, bottom: 470, w: 34 };
const STEP_MS = 1000 / 60;

/**
 * Keep It Warm, played live. Hold anywhere (or Space) to heat the egg, let go to cool.
 * Keep the needle inside the moving warm band; reach the top and the egg cracks.
 * All scoring happens in KIWRunner so the Worker can replay the exact same run.
 */
export class KeepItWarmScene extends Phaser.Scene {
  private runner!: KIWRunner;
  private opts!: KIWSceneData;
  private held = false;
  private acc = 0;
  private started = false;
  private finished = false;
  private g!: Phaser.GameObjects.Graphics;
  private glow!: Phaser.GameObjects.Graphics;
  private eggG!: Phaser.GameObjects.Graphics;
  private label!: Phaser.GameObjects.Text;
  private timer!: Phaser.GameObjects.Text;
  private wind!: Phaser.GameObjects.Graphics;
  private gustPill!: Phaser.GameObjects.Container;
  private comboText!: Phaser.GameObjects.Text;
  private lastComboStep = 0;

  constructor() { super('keep-it-warm'); }

  init(data: KIWSceneData) {
    this.opts = data;
    this.runner = new KIWRunner(data.seed, data.warmth ?? 0, data.stage ?? 0);
    this.held = false; this.acc = 0; this.started = false; this.finished = false;
  }

  create() {
    // Backdrop: soft sky gradient, rounded snow hills, a few drifting flakes.
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x6fa7dd, 0x6fa7dd, 0xcfe6f7, 0xcfe6f7, 1).fillRect(0, 0, W, H);
    bg.fillStyle(0xb8d6ef).fillEllipse(70, H * 0.74, 360, 170).fillEllipse(320, H * 0.76, 340, 150);
    bg.fillStyle(ICE).fillRect(0, H * 0.74, W, H);
    bg.fillStyle(SNOW).fillEllipse(W / 2, H * 0.8, W * 1.5, 110);
    bg.lineStyle(4, INK).beginPath();
    bg.arc(W / 2, H * 0.8 + 420, 470, Math.PI * 1.32, Math.PI * 1.68).strokePath();
    const flakes = this.runner.stage === 2 ? 70 : 26; // decoration only; the blizzard looks the part
    for (let i = 0; i < flakes; i++) {
      const f = this.add.circle(Math.random() * W, Math.random() * H, 1.5 + Math.random() * 2.5, SNOW, 0.85);
      this.tweens.add({ targets: f, y: H + 10, x: f.x + (Math.random() * 40 - 20), duration: 5000 + Math.random() * 5000, repeat: -1, delay: -Math.random() * 6000, onRepeat: () => { f.y = -10; } });
    }
    this.glow = this.add.graphics();
    this.g = this.add.graphics();
    this.eggG = this.add.graphics();
    this.wind = this.add.graphics();
    const font = { fontFamily: 'Fredoka, sans-serif', color: '#14213d', fontStyle: '600' };
    // Wind gusts: a warning pill (shown from the runner's frames, so it matches the scoring exactly).
    const pg = this.add.graphics().fillStyle(SNOW).fillRoundedRect(-62, -20, 124, 40, 20).lineStyle(3, INK).strokeRoundedRect(-62, -20, 124, 40, 20);
    this.gustPill = this.add.container(140, 92, [pg, this.add.text(0, 0, 'Gust!', { ...font, fontSize: '22px' }).setOrigin(0.5)]).setAlpha(0);
    this.comboText = this.add.text(BAR.x + BAR.w / 2, BAR.top - 30, '', { ...font, fontSize: '22px', stroke: '#ffffff', strokeThickness: 6 }).setOrigin(0.5);
    const pill = this.add.graphics();
    pill.fillStyle(SNOW).fillRoundedRect(16, 16, 78, 40, 20).lineStyle(3, INK).strokeRoundedRect(16, 16, 78, 40, 20);
    this.timer = this.add.text(55, 36, '', { ...font, fontSize: '22px' }).setOrigin(0.5);
    this.label = this.add.text(W / 2 - 24, H - 52, 'Hold to warm', { ...font, fontSize: '22px' }).setOrigin(0.5);
    this.tweens.add({ targets: this.label, scale: 1.06, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    const down = () => {
      this.held = true;
      if (this.started && this.label.alpha === 1 && !this.finished) this.tweens.add({ targets: this.label, alpha: 0, duration: 300 });
    };
    const up = () => { this.held = false; };
    this.input.on('pointerdown', down);
    this.input.on('pointerup', up);
    this.input.on('pointerupoutside', up);
    this.input.keyboard?.on('keydown-SPACE', down);
    this.input.keyboard?.on('keyup-SPACE', up);

    const count = this.add.text(W / 2 - 24, H * 0.4, '3', { ...font, fontSize: '84px', stroke: '#ffffff', strokeThickness: 10 }).setOrigin(0.5);
    const pop = () => this.tweens.add({ targets: count, scale: { from: 1.6, to: 1 }, alpha: { from: 0.2, to: 1 }, duration: 380, ease: 'Back.out' });
    pop();
    [2, 1].forEach((n, i) => this.time.delayedCall(700 * (i + 1), () => { count.setText(String(n)); pop(); }));
    this.time.delayedCall(2100, () => {
      count.setText('Go!'); pop();
      this.tweens.add({ targets: count, alpha: 0, delay: 350, duration: 250, onComplete: () => count.destroy() });
      this.started = true;
    });
    this.draw();
  }

  update(_t: number, delta: number) {
    if (!this.started || this.finished) return;
    this.acc += Math.min(delta, 250);
    while (this.acc >= STEP_MS && !this.runner.done) {
      this.runner.step(this.held);
      this.acc -= STEP_MS;
    }
    this.draw();
    const r = this.runner;
    if (this.opts.onFrame && (r.tick % 6 === 0 || r.done)) {
      this.opts.onFrame({ tick: r.tick, score: r.liveScore(), inZone: r.inZone, gust: r.gustAtTick(Math.max(0, r.tick - 1)), combo: r.combo, done: r.done });
    }
    if (this.runner.done) this.finish();
  }

  private finish() {
    this.finished = true;
    const r = this.runner.result();
    this.label.setAlpha(1).setText(r.cracked ? 'Too hot! The shell cracked.' : 'Nice and warm!');
    this.cameras.main.flash(250, 255, 232, 194);
    this.time.delayedCall(900, () => this.opts.onFinish(r, [...this.runner.inputs]));
  }

  private draw() {
    const r = this.runner;
    const y = (v: number) => BAR.bottom - v * (BAR.bottom - BAR.top);
    const g = this.g.clear();
    // Thermometer: snow tube with a bulb, glowing warm band, heat fill, rounded needle.
    const bulbY = BAR.bottom + 22, cxBar = BAR.x + BAR.w / 2;
    g.fillStyle(SNOW).fillRoundedRect(BAR.x, BAR.top, BAR.w, BAR.bottom - BAR.top + 10, 17).fillCircle(cxBar, bulbY, 27);
    const bandTop = y(Math.min(1, r.center + r.zoneWidth / 2)), bandBottom = y(Math.max(0, r.center - r.zoneWidth / 2));
    if (r.inZone) g.fillStyle(EMBER, 0.25).fillRoundedRect(BAR.x - 8, bandTop - 6, BAR.w + 16, bandBottom - bandTop + 12, 12);
    g.fillStyle(0xffc9a3).fillRect(BAR.x + 3, bandTop, BAR.w - 6, bandBottom - bandTop);
    g.lineStyle(3, EMBER).lineBetween(BAR.x + 3, bandTop, BAR.x + BAR.w - 3, bandTop).lineBetween(BAR.x + 3, bandBottom, BAR.x + BAR.w - 3, bandBottom);
    const fill = r.heat > 0.85 ? EMBER : LOFI;
    g.fillStyle(fill).fillRoundedRect(BAR.x + 10, y(r.heat), BAR.w - 20, BAR.bottom - y(r.heat) + 12, 7).fillCircle(cxBar, bulbY, 19);
    g.lineStyle(4, INK).strokeRoundedRect(BAR.x, BAR.top, BAR.w, BAR.bottom - BAR.top + 4, 17).strokeCircle(cxBar, bulbY, 27);
    g.fillStyle(SNOW).fillRect(BAR.x + 2, BAR.bottom - 2, BAR.w - 4, 10).fillStyle(fill).fillRect(BAR.x + 10, BAR.bottom - 4, BAR.w - 20, 14);
    const ny = y(r.heat);
    g.fillStyle(INK).fillTriangle(BAR.x - 18, ny - 9, BAR.x - 18, ny + 9, BAR.x - 3, ny).fillRoundedRect(BAR.x - 26, ny - 3, 12, 6, 3);

    // Egg: our ink-outline egg; soft warm glow pulses in the band, shakes and cracks when too hot.
    const shake = (r.heat > 0.85 ? Math.sin(r.tick * 1.7) * 4 * (r.heat - 0.85) / 0.15 : 0) + (r.gustAtTick(Math.max(0, r.tick - 1)) === 'on' ? Math.sin(r.tick * 0.9) * 2.5 : 0);
    const cx = 140 + shake, cy = 300;
    const gl = this.glow.clear();
    if (r.inZone) {
      const p = 0.5 + 0.5 * Math.sin(r.tick / 8);
      gl.fillStyle(0xffd2a8, 0.25 + 0.15 * p).fillEllipse(cx, cy + 6, 220 + 16 * p, 260 + 16 * p);
      gl.fillStyle(0xffb27a, 0.22).fillEllipse(cx, cy + 6, 180, 220);
    }
    const e = this.eggG.clear();
    e.fillStyle(INK, 0.12).fillEllipse(cx, cy + 102, 130, 22);
    const warm = Math.min(1, r.heat);
    const shell = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(0xeaf4fb), Phaser.Display.Color.ValueToColor(0xffe6d1), 100, Math.round(warm * 100));
    e.fillStyle(Phaser.Display.Color.GetColor(shell.r, shell.g, shell.b));
    eggPath(e, cx, cy); e.fillPath();
    e.fillStyle(LOFI, 0.35).fillCircle(cx + 28, cy - 22, 12).fillCircle(cx - 30, cy + 30, 16).fillCircle(cx + 18, cy + 52, 8);
    e.fillStyle(SNOW, 0.9).fillEllipse(cx - 34, cy - 50, 18, 34);
    e.lineStyle(5, INK); eggPath(e, cx, cy); e.strokePath();
    if (r.heat > 0.9 || r.cracked) {
      e.lineStyle(4, INK).beginPath();
      e.moveTo(cx - 40, cy - 10); e.lineTo(cx - 18, cy - 24); e.lineTo(cx - 4, cy - 6); e.lineTo(cx + 16, cy - 28);
      e.strokePath();
    }
    // Stage twists, drawn from the runner so what you see is what's scored.
    const gust = r.gustAtTick(Math.max(0, r.tick - 1));
    const w = this.wind.clear();
    if (gust) {
      const strong = gust === 'on';
      w.lineStyle(strong ? 4 : 2, SNOW, strong ? 0.9 : 0.5);
      for (let i = 0; i < (strong ? 9 : 4); i++) {
        const yy = 120 + ((i * 53) % 330), xx = W - ((r.tick * (strong ? 9 : 4) + i * 97) % (W + 120));
        w.lineBetween(xx, yy, xx + 60, yy - 6);
      }
      this.gustPill.setAlpha(gust === 'warn' ? 0.6 + 0.4 * Math.sin(r.tick / 4) : 1).setScale(strong ? 1.08 : 1);
    } else this.gustPill.setAlpha(0);
    if (r.stage === 2) {
      const step = Math.floor((r.combo - 1) * 10 + 1e-9);
      this.comboText.setText(r.combo > 1.001 ? `×${r.combo.toFixed(1)}` : '');
      if (step > this.lastComboStep) this.tweens.add({ targets: this.comboText, scale: { from: 1.5, to: 1 }, duration: 260, ease: 'Back.out' });
      this.lastComboStep = step;
    }
    const left = Math.max(0, Math.ceil((KIW.TICKS - r.tick) / 60));
    this.timer.setText(`${left}s`);
  }
}

/** Egg outline: narrower at the top, round at the bottom (matches EggArt). */
function eggPath(g: Phaser.GameObjects.Graphics, cx: number, cy: number) {
  const pts: Phaser.Math.Vector2[] = [];
  for (let i = 0; i <= 48; i++) {
    const t = (i / 48) * Math.PI * 2;
    const yy = Math.cos(t);
    const w = 76 * (1 - 0.18 * yy);
    pts.push(new Phaser.Math.Vector2(cx + Math.sin(t) * w, cy - yy * 98));
  }
  g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
  for (const p of pts.slice(1)) g.lineTo(p.x, p.y);
  g.closePath();
}

export function keepItWarmConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: W,
    height: H,
    backgroundColor: '#6fa7dd',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    audio: { noAudio: true }, // games make their own sound; Phaser's context errors when a game is torn down
    scene: [],
  };
}
