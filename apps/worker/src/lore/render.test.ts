import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, test } from 'vitest';
import { cardSvg } from '@flurry/art';
import { createRenderer } from './render';

const require = createRequire(import.meta.url);
const wasm = readFileSync(require.resolve('@resvg/resvg-wasm/index_bg.wasm'));
const font = (n: string) => new Uint8Array(readFileSync(new URL(`../../assets/fonts/${n}.ttf`, import.meta.url)));
const render = createRenderer({ wasm, fonts: [font('Fredoka-SemiBold'), font('Figtree-Regular'), font('Figtree-Italic')] });

describe('renderPng', () => {
  const svg = cardSvg({ level: 1, elements: [0], variants: [1, 6, 11] }, { name: 'Pebble', story: 'Sleeps in snowdrifts and hums when the wind changes.' });

  test('returns a PNG (89 50 4E 47 signature)', async () => {
    const png = await render(svg);
    expect([...png.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  test('PNG is 800×1000', async () => {
    const png = await render(svg);
    const view = new DataView(png.buffer, png.byteOffset);
    expect(view.getUint32(16)).toBe(800);
    expect(view.getUint32(20)).toBe(1000);
  });

  test('renders twice with one WASM init', async () => {
    await render(svg);
    await expect(render(svg)).resolves.toBeInstanceOf(Uint8Array);
  });

  test('renders every level (2–5) and a hybrid', async () => {
    for (const level of [2, 3, 4, 5]) {
      const n = level === 2 ? 4 : 5;
      const card = cardSvg({ level, elements: level === 3 ? [1, 3] : [0], variants: Array.from({ length: n }, (_, i) => (i * 5) % 16) }, { name: 'Glimmer', story: 'Glimmer grew taller.' });
      const png = await render(card);
      expect([...png.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    }
  });
});

