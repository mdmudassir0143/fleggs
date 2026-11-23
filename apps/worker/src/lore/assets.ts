// Bundled by wrangler: CompiledWasm for resvg (no runtime WASM compile in Workers), Data for fonts.
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';
import fredoka from '../../assets/fonts/Fredoka-SemiBold.ttf';
import figtree from '../../assets/fonts/Figtree-Regular.ttf';
import figtreeItalic from '../../assets/fonts/Figtree-Italic.ttf';
import { createRenderer } from './render';

export const renderPng = createRenderer({
  wasm: resvgWasm,
  fonts: [fredoka, figtree, figtreeItalic].map((b) => new Uint8Array(b)),
});
