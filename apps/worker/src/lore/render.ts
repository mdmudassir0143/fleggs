import { Resvg, initWasm } from '@resvg/resvg-wasm';

type WasmInput = WebAssembly.Module | ArrayBufferView | ArrayBuffer;

/**
 * SVG → PNG with resvg. Workers can't compile WASM at runtime, so the module is passed in
 * (bundled by wrangler as a CompiledWasm import); tests pass the raw bytes instead.
 */
export function createRenderer(deps: { wasm: WasmInput; fonts: Uint8Array[] }) {
  let ready: Promise<void> | null = null;
  return async function renderPng(svg: string): Promise<Uint8Array<ArrayBuffer>> {
    ready ??= initWasm(deps.wasm as never).catch((e: Error) => {
      if (!/Already initialized/.test(e.message)) throw e;
    });
    await ready;
    const resvg = new Resvg(svg, {
      font: { fontBuffers: deps.fonts, loadSystemFonts: false, defaultFontFamily: 'Figtree' },
      fitTo: { mode: 'original' },
    });
    return new Uint8Array(resvg.render().asPng());
  };
}
