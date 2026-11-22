import Phaser from 'phaser';
import { IS, ISRunner, type ISInput, type ISResult } from './sim';

export type ISSceneData = {
  seed: number;
  bonus?: number;
  onFinish(result: ISResult, inputs: ISInput[]): void;
};

const INK = 0x14213d, SNOW = 0xffffff, ICE = 0xcfe8f8, ICE_SHADE = 0x9ccbea, EMBER = 0xe8642c;
const W = 360, H = 560;
const STEP_MS = 1000 / 60;
const UNIT = 150; // px per base-block width
const BH = 30; // block height
const BASE_Y = H - 90;
const cx = (x: number) => W / 2 + x * UNIT;

/** Igloo Stack: tap (or Space) to drop the swinging ice block; keep the igloo tall and straight. */
export class IglooStackScene extends Phaser.Scene {
  private runner!: ISRunner;
  private opts!: ISSceneData;
  private acc = 0;
  private started = false;
  private finished = false;
  private pending = false;
  private tower!: Phaser.GameObjects.Graphics;
  private swing!: Phaser.GameObjects.Graphics;
  private height!: Phaser.GameObjects.Text;
  private placedSeen = 0;
  private camY = 0;

  constructor() { super('igloo-stack'); }

  init(data: ISSceneData) {
    this.opts = data;
    this.runner = new ISRunner(data.seed, data.bonus ?? 0);
    this.acc = 0; this.started = false; this.finished = false; this.pending = false; this.placedSeen = 0; this.camY = 0;
  }

  create() {
    const bg = this.add.graphics().setScrollFactor(0);
    bg.fillGradientStyle(0x5e8fd3, 0x5e8fd3, 0xd6e8f8, 0xd6e8f8, 1).fillRect(0, 0, W, H);
    bg.fillStyle(0xfff3e2, 0.5).fillCircle(W - 70, 90, 34);
    const world = this.add.graphics();
    world.fillStyle(0xb9cfe8).fillTriangle(-40, BASE_Y + 20, 90, BASE_Y - 160, 220, BASE_Y + 20).fillTriangle(150, BASE_Y + 20, 300, BASE_Y - 200, 420, BASE_Y + 20);
    world.fillStyle(SNOW).fillTriangle(68, BASE_Y - 128, 90, BASE_Y - 160, 112, BASE_Y - 128).fillTriangle(274, BASE_Y - 164, 300, BASE_Y - 200, 326, BASE_Y - 164);
    world.fillStyle(0xf3f8fc).fillRect(-40, BASE_Y + BH / 2, W + 80, 200);
    world.lineStyle(4, INK).lineBetween(-40, BASE_Y + BH / 2, W + 80, BASE_Y + BH / 2);
    this.tower = this.add.graphics();
    this.swing = this.add.graphics();
    const font = { fontFamily: 'Fredoka, sans-serif', color: '#14213d', fontStyle: '600' };
    const pill = this.add.graphics().setScrollFactor(0);
    pill.fillStyle(SNOW).fillRoundedRect(16, 16, 110, 40, 20).lineStyle(3, INK).strokeRoundedRect(16, 16, 110, 40, 20);
    this.height = this.add.text(71, 36, '', { ...font, fontSize: '19px' }).setOrigin(0.5).setScrollFactor(0);
    this.add.text(W / 2, H - 30, 'Tap to drop', { fontFamily: 'Figtree, sans-serif', fontSize: '14px', color: '#3a4766' }).setOrigin(0.5).setScrollFactor(0);

    this.input.on('pointerdown', () => { this.pending = true; });
    this.input.keyboard?.on('keydown-SPACE', () => { this.pending = true; });

    const count = this.add.text(W / 2, H * 0.4, '3', { ...font, fontSize: '84px', stroke: '#ffffff', strokeThickness: 10 }).setOrigin(0.5).setScrollFactor(0);
    const pop = () => this.tweens.add({ targets: count, scale: { from: 1.6, to: 1 }, alpha: { from: 0.2, to: 1 }, duration: 380, ease: 'Back.out' });
    pop();
    [2, 1].forEach((n, i) => this.time.delayedCall(700 * (i + 1), () => { count.setText(String(n)); pop(); }));
    this.time.delayedCall(2100, () => {
      count.setText('Go!'); pop();
      this.tweens.add({ targets: count, alpha: 0, delay: 350, duration: 250, onComplete: () => count.destroy() });
      this.started = true;
    });
    this.drawTower();
  }

  private block(g: Phaser.GameObjects.Graphics, x: number, w: number, y: number, glow = false) {
    const px = cx(x) - (w * UNIT) / 2, pw = w * UNIT;
    if (glow) g.fillStyle(EMBER, 0.25).fillRoundedRect(px - 8, y - BH / 2 - 8, pw + 16, BH + 16, 14);
    g.fillStyle(ICE).fillRoundedRect(px, y - BH / 2, pw, BH, 9);
    g.fillStyle(ICE_SHADE).fillRoundedRect(px, y + 2, pw, BH / 2 - 2, { tl: 0, tr: 0, bl: 9, br: 9 });
    g.lineStyle(4, INK).strokeRoundedRect(px, y - BH / 2, pw, BH, 9);
    if (pw > 26) g.lineStyle(4, SNOW, 0.9).lineBetween(px + 10, y - BH / 2 + 7, px + Math.min(pw - 10, 50), y - BH / 2 + 7);
  }

  private drawTower() {
    const g = this.tower.clear();
    this.runner.tower.forEach((b, i) => this.block(g, b.center, b.width, BASE_Y - i * BH));
  }

  update(_t: number, delta: number) {
    if (!this.started || this.finished) return;
    this.acc += Math.min(delta, 250);
    while (this.acc >= STEP_MS && !this.runner.done) {
      this.runner.step(this.pending);
      this.pending = false;
      this.acc -= STEP_MS;
    }
    const r = this.runner;
    if (r.placed > this.placedSeen) {
      const below = r.tower[r.tower.length - 2], top = r.top;
      this.placedSeen = r.placed;
      this.drawTower();
      const y = BASE_Y - r.placed * BH;
      if (top.perfect) {
        const ring = this.add.graphics(); this.block(ring, top.center, top.width, y, true);
        this.tweens.add({ targets: ring, alpha: 0, duration: 500, onComplete: () => ring.destroy() });
        const t = this.add.text(cx(top.center), y - 34, 'Perfect!', { fontFamily: 'Fredoka, sans-serif', fontSize: '22px', fontStyle: '700', color: '#e8642c', stroke: '#ffffff', strokeThickness: 6 }).setOrigin(0.5);
        this.tweens.add({ targets: t, y: y - 70, alpha: 0, duration: 700, onComplete: () => t.destroy() });
      } else {
        // the trimmed overhang breaks off and tumbles away
        const lost = below.width - top.width;
        const side = Math.sign(r.x - below.center) || 1;
        const lx = top.center + side * (top.width / 2 + lost / 2);
        const piece = this.add.graphics();
        this.block(piece, 0, lost, 0);
        piece.setPosition(cx(lx) - W / 2, y);
        this.tweens.add({ targets: piece, y: y + 260, x: piece.x + side * 60, angle: side * 70, alpha: 0, duration: 800, ease: 'Quad.in', onComplete: () => piece.destroy() });
      }
      this.cameras.main.shake(90, 0.004);
      this.camY = Math.max(0, (r.placed - 8) * BH);
      this.tweens.add({ targets: this.cameras.main, scrollY: -this.camY, duration: 400, ease: 'Sine.out' });
    }
    const g = this.swing.clear();
    if (r.swinging && !r.done) {
      const y = BASE_Y - (r.placed + 1) * BH;
      g.lineStyle(3, INK, 0.5).lineBetween(cx(r.x), y - BH / 2, cx(r.x), y - 140);
      this.block(g, r.x, r.top.width, y);
    }
    this.height.setText(`${r.placed} / ${IS.BLOCKS}`);
    if (r.done) this.finish();
  }

  private finish() {
    this.finished = true;
    const r = this.runner.result();
    this.add.text(W / 2, H * 0.36, r.placed >= IS.BLOCKS ? 'Cosy igloo!' : 'Oops!', { fontFamily: 'Fredoka, sans-serif', fontSize: '48px', fontStyle: '700', color: '#14213d', stroke: '#ffffff', strokeThickness: 8 }).setOrigin(0.5).setScrollFactor(0);
    this.time.delayedCall(900, () => this.opts.onFinish(r, [...this.runner.inputs]));
  }
}

export function iglooStackConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return { type: Phaser.AUTO, parent, width: W, height: H, backgroundColor: '#5e8fd3', scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, audio: { noAudio: true }, scene: [] };
}
