/**
 * Snow with depth: three tiers (far: tiny and sharp, near: big and soft), drifting on a breeze.
 * Falls faster while the page scrolls fast. Returns a stop function.
 */
export function startSnow(canvas: HTMLCanvasElement, count = 90): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  let w = 0, h = 0, raf = 0, lastY = scrollY, boost = 0;
  const dpr = Math.min(devicePixelRatio, 2);
  const resize = () => { w = canvas.width = canvas.offsetWidth * dpr; h = canvas.height = canvas.offsetHeight * dpr; };
  resize();
  addEventListener('resize', resize);
  const TIERS = [
    { r: [0.8, 1.4], v: 0.0005, a: 0.55, blur: 0 },
    { r: [1.6, 2.6], v: 0.0010, a: 0.8, blur: 0 },
    { r: [3.5, 5.5], v: 0.0019, a: 0.65, blur: 4 },
  ];
  const flakes = Array.from({ length: count }, (_, i) => {
    const t = TIERS[i % 10 < 5 ? 0 : i % 10 < 8 ? 1 : 2];
    return { x: Math.random(), y: Math.random(), r: t.r[0] + Math.random() * (t.r[1] - t.r[0]), v: t.v * (0.7 + Math.random() * 0.6), a: t.a, blur: t.blur, d: Math.random() * 6 };
  });
  const tick = (ms: number) => {
    const dy = Math.abs(scrollY - lastY); lastY = scrollY;
    boost = Math.min(6, boost * 0.9 + dy * 0.02);
    ctx.clearRect(0, 0, w, h);
    for (const f of flakes) {
      f.y += f.v * (1 + boost); if (f.y > 1.03) { f.y = -0.03; f.x = Math.random(); }
      const x = (f.x + Math.sin(ms / 1600 + f.d) * 0.012 * (f.r / 2)) * w;
      ctx.globalAlpha = f.a;
      ctx.shadowBlur = f.blur * dpr; ctx.shadowColor = '#fff';
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x, f.y * h, f.r * dpr, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => { cancelAnimationFrame(raf); removeEventListener('resize', resize); };
}
