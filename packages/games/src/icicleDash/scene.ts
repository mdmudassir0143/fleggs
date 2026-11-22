import Phaser from 'phaser';
import { ID, IDRunner, type IDInput, type IDResult } from './sim';

export type IDSceneData = {
  seed: number;
  bonus?: number;
  /** The player's yeti as an SVG string (drawn as the runner). */
  yetiSvg?: string;
  onFinish(result: IDResult, inputs: IDInput[]): void;
};

/** Phaser's loader only accepts base64 data URIs. */
export function svgDataUri(svg: string) {
  const bytes = new TextEncoder().encode(svg);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return `data:image/svg+xml;base64,${btoa(bin)}`;
}

const INK = 0x14213d, SNOW = 0xffffff, ICE = 0xd6ebfa, STORM = 0x7a5bd6;
const W = 360, H = 560;
const STEP_MS = 1000 / 60;
// Lanes converge toward the top (gentle perspective).
const laneX = (lane: number, y: number) => W / 2 + (lane - 1) * (70 + 50 * y);
const yPx = (y: number) => 120 + y * (H - 210);

/** Icicle Dash: swipe (or tap a side, or ←/→) to dodge falling icicles across three lanes. */
export class IcicleDashScene extends Phaser.Scene {
  private runner!: IDRunner;
  private opts!: IDSceneData;
  private acc = 0;
  private started = false;
  private finished = false;
  private pending: -1 | 0 | 1 = 0;
  private g!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Text;
  private hearts!: Phaser.GameObjects.Text;
  private player!: Phaser.GameObjects.Image | Phaser.GameObjects.Arc;
  private flakes: Phaser.GameObjects.Arc[] = [];
  private lastHits = 0;

  constructor() { super('icicle-dash'); }

  init(data: IDSceneData) {
    this.opts = data;
    this.runner = new IDRunner(data.seed, data.bonus ?? 0);
    this.acc = 0; this.started = false; this.finished = false; this.pending = 0; this.lastHits = 0; this.flakes = [];
  }

  preload() {
    if (this.opts.yetiSvg) this.load.svg('runner', svgDataUri(this.opts.yetiSvg), { width: 120, height: 120 });
  }

  create() {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x3b3478, 0x3b3478, 0x9d8fe0, 0x9d8fe0, 1).fillRect(0, 0, W, H);
    // distant storm peaks
    bg.fillStyle(0x5a4fa3).fillTriangle(-20, 170, 90, 60, 200, 170).fillTriangle(140, 170, 260, 40, 380, 170);
    bg.fillStyle(0xe9e4ff).fillTriangle(70, 82, 90, 60, 110, 82).fillTriangle(238, 66, 260, 40, 282, 66);
    // snow slope with three lanes
    bg.fillStyle(ICE).fillPoints([{ x: W / 2 - 130, y: 120 }, { x: W / 2 + 130, y: 120 }, { x: W + 40, y: H }, { x: -40, y: H }], true);
    bg.lineStyle(4, INK).strokePoints([{ x: W / 2 - 130, y: 120 }, { x: -40, y: H }]).strokePoints([{ x: W / 2 + 130, y: 120 }, { x: W + 40, y: H }]);
    bg.lineStyle(3, 0xa9c6e6);
    for (const b of [0.5, 1.5]) for (let k = 0; k < 14; k++) {
      const y0 = k / 14, y1 = (k + 0.5) / 14;
      bg.lineBetween(laneX(b, y0), yPx(y0), laneX(b, y1), yPx(y1));
    }
    for (let i = 0; i < 40; i++) {
      const f = this.add.circle(Math.random() * W, Math.random() * H, 1 + Math.random() * 2, SNOW, 0.8);
      this.flakes.push(f);
    }
    this.g = this.add.graphics();
    this.player = this.opts.yetiSvg && this.textures.exists('runner')
      ? this.add.image(laneX(1, ID.PLAYER_Y), yPx(ID.PLAYER_Y) - 10, 'runner').setDisplaySize(96, 96)
      : this.add.circle(laneX(1, ID.PLAYER_Y), yPx(ID.PLAYER_Y), 26, SNOW).setStrokeStyle(4, INK);
    const font = { fontFamily: 'Fredoka, sans-serif', color: '#14213d', fontStyle: '600' };
    const pill = this.add.graphics();
    pill.fillStyle(SNOW).fillRoundedRect(16, 16, 96, 40, 20).lineStyle(3, INK).strokeRoundedRect(16, 16, 96, 40, 20);
    pill.fillStyle(SNOW).fillRoundedRect(W - 112, 16, 96, 40, 20).lineStyle(3, INK).strokeRoundedRect(W - 112, 16, 96, 40, 20);
    this.hearts = this.add.text(64, 36, '', { ...font, fontSize: '20px', color: '#e8642c' }).setOrigin(0.5);
    this.hud = this.add.text(W - 64, 36, '', { ...font, fontSize: '20px' }).setOrigin(0.5);

    // Swipe, or tap the left/right half; arrow keys / A-D on desktop.
    let downX = 0;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { downX = p.x; });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const dx = p.x - downX;
      this.pending = Math.abs(dx) > 24 ? (dx > 0 ? 1 : -1) : p.x > W / 2 ? 1 : -1;
    });
    this.input.keyboard?.on('keydown-LEFT', () => { this.pending = -1; });
    this.input.keyboard?.on('keydown-A', () => { this.pending = -1; });
    this.input.keyboard?.on('keydown-RIGHT', () => { this.pending = 1; });
    this.input.keyboard?.on('keydown-D', () => { this.pending = 1; });

    const count = this.add.text(W / 2, H * 0.42, '3', { ...font, fontSize: '84px', stroke: '#ffffff', strokeThickness: 10 }).setOrigin(0.5);
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
    const speed = 1 + this.runner.tick / ID.TICKS * 2;
    for (const f of this.flakes) { f.y += (1.2 + f.radius) * speed; if (f.y > H) { f.y = -4; f.x = Math.random() * W; } }
    if (!this.started || this.finished) return;
    this.acc += Math.min(delta, 250);
    while (this.acc >= STEP_MS && !this.runner.done) {
      this.runner.step(this.pending);
      this.pending = 0;
      this.acc -= STEP_MS;
    }
    if (this.runner.hits > this.lastHits) {
      this.lastHits = this.runner.hits;
      this.cameras.main.shake(180, 0.012);
      this.cameras.main.flash(120, 255, 255, 255);
      this.tweens.add({ targets: this.player, alpha: 0.3, yoyo: true, repeat: 3, duration: 80 });
    }
    this.draw();
    if (this.runner.done) this.finish();
  }

  private finish() {
    this.finished = true;
    const r = this.runner.result();
    const font = { fontFamily: 'Fredoka, sans-serif', color: '#14213d', fontStyle: '700', stroke: '#ffffff', strokeThickness: 8 };
    this.add.text(W / 2, H * 0.42, this.runner.lives > 0 ? 'Made it!' : 'Bonk!', { ...font, fontSize: '56px' }).setOrigin(0.5);
    this.time.delayedCall(900, () => this.opts.onFinish(r, [...this.runner.inputs]));
  }

  private draw() {
    const r = this.runner;
    const g = this.g.clear();
    for (const ic of r.icicles) {
      if (ic.resolved || ic.y < 0) continue;
      const x = laneX(ic.lane, ic.y), y = yPx(ic.y), s = 0.55 + ic.y * 0.7;
      // warning shimmer on the lane while it falls
      g.fillStyle(STORM, 0.12 + 0.25 * ic.y).fillEllipse(laneX(ic.lane, ID.PLAYER_Y), yPx(ID.PLAYER_Y) + 30, 60 * s, 14 * s);
      g.fillStyle(0xbfe3fb).lineStyle(4, INK);
      g.beginPath(); g.moveTo(x - 16 * s, y - 40 * s); g.lineTo(x + 16 * s, y - 40 * s); g.lineTo(x, y + 18 * s); g.closePath(); g.fillPath(); g.strokePath();
      g.lineStyle(3, SNOW, 0.9).lineBetween(x - 6 * s, y - 32 * s, x - 1 * s, y + 4 * s);
    }
    this.player.setPosition(laneX(r.pos, ID.PLAYER_Y), yPx(ID.PLAYER_Y) - 10);
    this.player.setAngle(r.moving ? (r.lane > r.pos ? 8 : -8) : 0);
    this.hearts.setText('♥'.repeat(Math.max(0, r.lives)) + '♡'.repeat(Math.max(0, ID.LIVES - r.lives)));
    this.hud.setText(`${Math.max(0, Math.ceil((ID.TICKS - r.tick) / 60))}s`);
  }
}

export function icicleDashConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return { type: Phaser.AUTO, parent, width: W, height: H, backgroundColor: '#3b3478', scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, audio: { noAudio: true }, scene: [] };
}
