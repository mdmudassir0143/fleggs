/**
 * A flowing aurora curtain drawn by one fragment shader on a transparent canvas (no library).
 * Teal → violet ribbons that ripple slowly; alpha-blended over the night sky. Returns a stop function.
 */
const VERT = `attribute vec2 p; varying vec2 uv; void main(){ uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;
const FRAG = `precision mediump float;
varying vec2 uv; uniform float t; uniform vec2 res;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
float ribbon(vec2 q, float y0, float amp, float speed, float seed){
  float wave = y0 + amp * sin(q.x * 2.2 + t * speed + seed) + 0.06 * noise(vec2(q.x * 3.0 + t * 0.2, seed));
  float d = q.y - wave;
  float body = smoothstep(0.0, 0.02, d) * exp(-d * 9.0);          // bright lower edge, fading upward
  float rays = 0.6 + 0.4 * noise(vec2(q.x * 26.0, t * 0.6 + seed)); // vertical curtain streaks
  return body * rays;
}
void main(){
  vec2 q = vec2(uv.x * res.x / res.y, uv.y);
  float a = ribbon(q, 0.62, 0.05, 0.35, 1.0);
  float b = ribbon(q + vec2(0.3, 0.0), 0.72, 0.04, -0.27, 4.0);
  vec3 teal = vec3(0.36, 0.86, 0.72), violet = vec3(0.58, 0.45, 0.95), pink = vec3(0.95, 0.6, 0.85);
  float sum = a + b + 1e-4;
  vec3 col = (teal * a + mix(violet, pink, 0.25 + 0.25 * sin(t * 0.3)) * b) / sum; // hue mix, not brightness
  float alpha = clamp(sum * 0.8, 0.0, 0.85);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), alpha);
}`;

export function startAurora(canvas: HTMLCanvasElement): () => void {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: false, alpha: true, antialias: false });
  if (!gl || gl.isContextLost()) return () => {};
  const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog); gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uT = gl.getUniformLocation(prog, 't'), uRes = gl.getUniformLocation(prog, 'res');
  gl.disable(gl.BLEND); // one full-screen pass: write straight alpha directly
  let raf = 0, visible = true;
  const resize = () => {
    const s = Math.min(devicePixelRatio, 1.5) * 0.5; // half resolution: soft and cheap
    canvas.width = Math.max(1, canvas.offsetWidth * s); canvas.height = Math.max(1, canvas.offsetHeight * s);
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  resize(); addEventListener('resize', resize);
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
  io.observe(canvas);
  const frame = (ms: number) => {
    raf = requestAnimationFrame(frame);
    if (!visible) return;
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(uT, ms / 1000); gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
  raf = requestAnimationFrame(frame);
  // Stop drawing but keep the context: the same canvas may be started again (React StrictMode,
  // remounts), and a deliberately lost context composites as a white sheet.
  return () => { cancelAnimationFrame(raf); io.disconnect(); removeEventListener('resize', resize); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); };
}
