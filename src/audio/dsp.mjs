// Small offline DSP toolkit (no dependencies). Everything renders faster than real time into Float32Arrays.
export const SR = 48000;
export const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------------------------
// utils
// ---------------------------------------------------------------------------------------------
/** Deterministic PRNG (mulberry32) so every render is bit-identical. */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const fromDb = (d) => Math.pow(10, d / 20);
export const toDb = (x) => 20 * Math.log10(Math.max(1e-12, x));
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** 'F2' -> 41, 'Gb3' -> 54 (C4 = 60) */
export function noteNum(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error('bad note ' + name);
  return 12 * (Number(m[3]) + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

/** Stereo audio bus. */
export class Bus {
  constructor(n) {
    this.n = n;
    this.L = new Float32Array(n);
    this.R = new Float32Array(n);
  }
  /** add `src` (Bus) * gain into this bus */
  add(src, gain = 1) {
    const { L, R } = this, sl = src.L, sr = src.R, n = Math.min(this.n, src.n);
    for (let i = 0; i < n; i++) { L[i] += sl[i] * gain; R[i] += sr[i] * gain; }
    return this;
  }
  /** multiply by a per-sample gain array */
  mul(g) {
    const { L, R } = this, n = Math.min(this.n, g.length);
    for (let i = 0; i < n; i++) { L[i] *= g[i]; R[i] *= g[i]; }
    return this;
  }
  gain(x) {
    for (let i = 0; i < this.n; i++) { this.L[i] *= x; this.R[i] *= x; }
    return this;
  }
  rms(from = 0, to = this.n) {
    let s = 0;
    for (let i = from; i < to; i++) s += this.L[i] * this.L[i] + this.R[i] * this.R[i];
    return Math.sqrt(s / (2 * Math.max(1, to - from)));
  }
  peak() {
    let p = 0;
    for (let i = 0; i < this.n; i++) p = Math.max(p, Math.abs(this.L[i]), Math.abs(this.R[i]));
    return p;
  }
}

// ---------------------------------------------------------------------------------------------
// filters
// ---------------------------------------------------------------------------------------------
/** RBJ cookbook biquad coefficients [b0,b1,b2,a1,a2] (already divided by a0). */
export function biquad(type, f, q = Math.SQRT1_2, gainDb = 0) {
  const w0 = (TAU * Math.min(f, SR * 0.49)) / SR, cw = Math.cos(w0), sw = Math.sin(w0), al = sw / (2 * q);
  const A = Math.pow(10, gainDb / 40);
  let b0, b1, b2, a0, a1, a2;
  switch (type) {
    case 'lp': b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; break;
    case 'hp': b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; break;
    case 'bp': b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; break;
    case 'notch': b0 = 1; b1 = -2 * cw; b2 = 1; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; break;
    case 'peak': b0 = 1 + al * A; b1 = -2 * cw; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cw; a2 = 1 - al / A; break;
    case 'lowshelf': {
      const s = 2 * Math.sqrt(A) * al;
      b0 = A * (A + 1 - (A - 1) * cw + s); b1 = 2 * A * (A - 1 - (A + 1) * cw); b2 = A * (A + 1 - (A - 1) * cw - s);
      a0 = A + 1 + (A - 1) * cw + s; a1 = -2 * (A - 1 + (A + 1) * cw); a2 = A + 1 + (A - 1) * cw - s; break;
    }
    case 'highshelf': {
      const s = 2 * Math.sqrt(A) * al;
      b0 = A * (A + 1 + (A - 1) * cw + s); b1 = -2 * A * (A - 1 + (A + 1) * cw); b2 = A * (A + 1 + (A - 1) * cw - s);
      a0 = A + 1 - (A - 1) * cw + s; a1 = 2 * (A - 1 - (A + 1) * cw); a2 = A + 1 - (A - 1) * cw - s; break;
    }
    default: throw new Error('biquad type ' + type);
  }
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}
/** run a biquad (or cascade of them) over x[from,to) in place */
export function filt(x, coeffs, from = 0, to = x.length) {
  const list = Array.isArray(coeffs[0]) ? coeffs : [coeffs];
  for (const [b0, b1, b2, a1, a2] of list) {
    let z1 = 0, z2 = 0;
    for (let i = from; i < to; i++) {
      const v = x[i], y = b0 * v + z1;
      z1 = b1 * v - a1 * y + z2;
      z2 = b2 * v - a2 * y;
      x[i] = y;
    }
  }
  return x;
}
export const filtBus = (bus, coeffs) => { filt(bus.L, coeffs); filt(bus.R, coeffs); return bus; };

/** Topology-preserving state variable filter: stable under fast cutoff modulation. */
export class SVF {
  constructor() { this.ic1 = 0; this.ic2 = 0; this.lp = 0; this.bp = 0; this.hp = 0; }
  tick(x, fc, q = 0.7071) {
    const g = Math.tan((Math.PI * Math.min(fc, SR * 0.45)) / SR), k = 1 / q;
    const a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2;
    const v3 = x - this.ic2;
    const v1 = a1 * this.ic1 + a2 * v3;
    const v2 = this.ic2 + a2 * this.ic1 + a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    this.lp = v2; this.bp = v1; this.hp = x - k * v1 - v2;
    return v2;
  }
}

/** Nonlinear 4-pole ladder low-pass (Moog / TB-303 flavoured), 2x oversampled. */
export class Ladder {
  constructor() { this.y = new Float64Array(4); this.w = new Float64Array(4); this.prev = 0; }
  tick(x, fc, res, drive = 1) {
    const g = 1 - Math.exp((-TAU * Math.min(fc, SR * 0.4)) / (SR * 2)), k = 4 * res;
    const y = this.y, w = this.w;
    let out = 0;
    for (let s = 0; s < 2; s++) {
      const xi = s === 0 ? 0.5 * (x + this.prev) : x;
      const u = Math.tanh(drive * xi - k * y[3]);
      y[0] += g * (u - w[0]); w[0] = Math.tanh(y[0]);
      y[1] += g * (w[0] - w[1]); w[1] = Math.tanh(y[1]);
      y[2] += g * (w[1] - w[2]); w[2] = Math.tanh(y[2]);
      y[3] += g * (w[2] - w[3]); w[3] = Math.tanh(y[3]);
      out = y[3];
    }
    this.prev = x;
    return out;
  }
}

// ---------------------------------------------------------------------------------------------
// oscillators
// ---------------------------------------------------------------------------------------------
export function polyBlep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}
export const sawBL = (ph, dt) => 2 * ph - 1 - polyBlep(ph, dt);
export function squareBL(ph, dt, pw = 0.5) {
  let v = ph < pw ? 1 : -1;
  v += polyBlep(ph, dt);
  v -= polyBlep((ph + 1 - pw) % 1, dt);
  return v;
}

// ---------------------------------------------------------------------------------------------
// reverb: 8-line feedback delay network with input diffusion and modulated lines
// ---------------------------------------------------------------------------------------------
class AllPass {
  constructor(len, g) { this.b = new Float32Array(len); this.i = 0; this.g = g; }
  tick(x) {
    const d = this.b[this.i], w = x + this.g * d;
    this.b[this.i] = w;
    if (++this.i >= this.b.length) this.i = 0;
    return -this.g * w + d;
  }
}
export class Reverb {
  constructor({ rt60 = 2.5, damp = 5000, pre = 0.015, size = 1, mod = 1, seed = 3 } = {}) {
    const r = rng(seed);
    const ms = [29.7, 37.1, 41.1, 43.7, 47.9, 53.3, 59.9, 67.3];
    this.N = 8;
    this.len = ms.map((m) => Math.round(m * size * 1e-3 * SR));
    this.buf = this.len.map((l) => new Float32Array(l + 512));
    this.w = new Int32Array(8);
    this.lp = new Float64Array(8);
    this.g = this.len.map((l) => Math.pow(10, (-3 * (l / SR)) / rt60));
    this.a = Math.exp((-TAU * damp) / SR);
    this.phase = ms.map(() => r() * TAU);
    this.rate = ms.map((_, i) => ((0.11 + 0.037 * i + r() * 0.05) * TAU) / SR);
    this.depth = 5 * mod;
    this.pre = new Float32Array(Math.max(1, Math.round(pre * SR)));
    this.pi = 0;
    const s = SR / 44100;
    this.ap = [113, 167, 241, 337].map((d) => new AllPass(Math.round(d * s), 0.6));
    this.norm = 1;
    this.opts = { rt60, damp, pre, size, mod, seed };
  }
  /** process mono/stereo in -> stereo out (overwrites out[from,to)) */
  run(inL, inR, outL, outR, from = 0, to = outL.length) {
    const { N, len, buf, w, lp, g, a, phase, rate, depth, pre, ap } = this;
    const v = new Float64Array(8);
    let pi = this.pi;
    for (let i = from; i < to; i++) {
      // pre-delay + diffusion on each channel's contribution
      const xin = 0.5 * ((inL[i] || 0) + (inR[i] || 0));
      const pd = pre[pi]; pre[pi] = xin; if (++pi >= pre.length) pi = 0;
      let x = pd;
      for (let k = 0; k < 4; k++) x = ap[k].tick(x);
      // read lines (linear-interpolated, slowly modulated)
      for (let k = 0; k < N; k++) {
        phase[k] += rate[k];
        const d = len[k] + depth * Math.sin(phase[k]);
        let rp = w[k] - d; if (rp < 0) rp += buf[k].length;
        const i0 = Math.floor(rp), fr = rp - i0, b = buf[k];
        const i1 = i0 + 1 >= b.length ? 0 : i0 + 1;
        const s = b[i0] * (1 - fr) + b[i1] * fr;
        lp[k] = s * (1 - a) + lp[k] * a; // damping
        v[k] = lp[k];
      }
      // Hadamard mix (orthogonal, /sqrt(8))
      for (let h = 1; h < 8; h <<= 1) {
        for (let j = 0; j < 8; j += h << 1) {
          for (let q = j; q < j + h; q++) { const p0 = v[q], p1 = v[q + h]; v[q] = p0 + p1; v[q + h] = p0 - p1; }
        }
      }
      const sc = 0.35355339;
      for (let k = 0; k < N; k++) {
        const b = buf[k];
        b[w[k]] = x * 0.5 + v[k] * sc * g[k];
        if (++w[k] >= b.length) w[k] = 0;
      }
      outL[i] = (v[0] - v[2] + v[4] - v[6]) * 0.5 * this.norm;
      outR[i] = (v[1] - v[3] + v[5] - v[7]) * 0.5 * this.norm;
    }
    this.pi = pi;
  }
}

/** Reverb whose wet output has ~unity RMS gain for steady noise, so send levels are predictable. */
export function makeReverb(opts = {}) {
  const probe = new Reverb(opts), r = rng(5), n = Math.round(SR * 5);
  const x = new Float32Array(n).map(() => r() * 2 - 1), oL = new Float32Array(n), oR = new Float32Array(n);
  probe.run(x, x, oL, oR);
  let a = 0, b = 0;
  for (let i = Math.round(SR * 2.5); i < n; i++) { a += x[i] * x[i]; b += oL[i] * oL[i] + oR[i] * oR[i]; }
  const rev = new Reverb(opts);
  rev.norm = Math.sqrt(a / (b / 2));
  return rev;
}

// ---------------------------------------------------------------------------------------------
// delay / chorus
// ---------------------------------------------------------------------------------------------
/** Stereo ping-pong echo of a mono send. Feedback path is band-limited for dub-style repeats. */
export function pingPong(src, { time, fb = 0.5, lp = 3200, hp = 220 } = {}) {
  const n = src.length, d = Math.round(time * SR);
  const bl = new Float32Array(d), br = new Float32Array(d);
  const oL = new Float32Array(n), oR = new Float32Array(n);
  const la = Math.exp((-TAU * lp) / SR), ha = Math.exp((-TAU * hp) / SR);
  let lpL = 0, lpR = 0, hpL = 0, hpR = 0, p = 0;
  for (let i = 0; i < n; i++) {
    const rl = bl[p], rr = br[p];
    oL[i] = rl; oR[i] = rr;
    // feedback: R -> L, L -> R, each low-passed then high-passed
    lpL = rr * (1 - la) + lpL * la; hpL = hpL * ha + lpL * (1 - ha); const fl = lpL - hpL;
    lpR = rl * (1 - la) + lpR * la; hpR = hpR * ha + lpR * (1 - ha); const fr = lpR - hpR;
    bl[p] = src[i] + fb * fl;
    br[p] = fb * fr;
    if (++p >= d) p = 0;
  }
  return { L: oL, R: oR };
}
/** Two-voice chorus, in place on a Bus. */
export function chorus(bus, { rate = 0.35, depth = 0.0035, base = 0.016, mix = 0.5 } = {}) {
  const n = bus.n, max = Math.ceil((base + depth) * SR) + 4;
  for (const [ch, ph0] of [[bus.L, 0], [bus.R, Math.PI * 0.9]]) {
    const dl = new Float32Array(max);
    let wp = 0;
    for (let i = 0; i < n; i++) {
      dl[wp] = ch[i];
      const d = (base + depth * Math.sin(TAU * rate * (i / SR) + ph0)) * SR;
      let rp = wp - d; if (rp < 0) rp += max;
      const i0 = Math.floor(rp), fr = rp - i0, i1 = i0 + 1 >= max ? 0 : i0 + 1;
      ch[i] = ch[i] * (1 - mix * 0.5) + (dl[i0] * (1 - fr) + dl[i1] * fr) * mix;
      if (++wp >= max) wp = 0;
    }
  }
  return bus;
}

// ---------------------------------------------------------------------------------------------
// dynamics
// ---------------------------------------------------------------------------------------------
/** Sidechain duck curve from trigger times: per-sample gain in [1-depth, 1]. */
export function duckCurve(n, times, { depth = 0.8, attack = 0.004, hold = 0, release = 0.28, curve = 1.6 } = {}) {
  const g = new Float32Array(n).fill(1);
  const len = Math.round((attack + hold + release) * SR);
  const shape = new Float32Array(len);
  for (let k = 0; k < len; k++) {
    const s = k / SR;
    let duck;
    if (s < attack) duck = s / attack;
    else if (s < attack + hold) duck = 1;
    else duck = Math.pow(Math.max(0, 1 - (s - attack - hold) / release), curve); // fast initial recovery, long tail
    shape[k] = 1 - depth * duck;
  }
  for (const t of times) {
    const s0 = Math.round(t * SR);
    for (let k = 0; k < len && s0 + k < n; k++) if (shape[k] < g[s0 + k]) g[s0 + k] = shape[k];
  }
  return g;
}

/** Feed-forward stereo-linked bus compressor. */
export function compress(bus, { thresh = -14, ratio = 2, attack = 0.02, release = 0.15, makeup = 0 } = {}) {
  const { L, R, n } = bus;
  const ac = 1 - Math.exp(-1 / (attack * SR)), rc = 1 - Math.exp(-1 / (release * SR));
  const th = fromDb(thresh), mk = fromDb(makeup), slope = 1 - 1 / ratio;
  let env = 0;
  for (let i = 0; i < n; i++) {
    const p = Math.max(Math.abs(L[i]), Math.abs(R[i]));
    env += (p > env ? ac : rc) * (p - env);
    let gain = mk;
    if (env > th) gain *= Math.pow(env / th, -slope);
    L[i] *= gain; R[i] *= gain;
  }
  return bus;
}

/** Offline look-ahead brick-wall limiter (non-causal, so no latency). Sample-peak ceiling is guaranteed. */
export function limit(bus, { ceiling = -1.5, look = 0.003, release = 0.09 } = {}) {
  const { L, R, n } = bus;
  const ceil = fromDb(ceiling), W = Math.max(1, Math.round(look * SR));
  // 1) gain each sample would need on its own
  const req = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = Math.max(Math.abs(L[i]), Math.abs(R[i]));
    req[i] = p > ceil ? ceil / p : 1;
  }
  // 2) sliding minimum over [i-W, i+W] (monotonic deque)
  const hold = new Float32Array(n), dq = new Int32Array(n);
  let head = 0, tail = 0, next = 0;
  for (let i = 0; i < n; i++) {
    const hi = Math.min(n - 1, i + W);
    while (next <= hi) {
      while (tail > head && req[dq[tail - 1]] >= req[next]) tail--;
      dq[tail++] = next++;
    }
    while (dq[head] < i - W) head++;
    hold[i] = req[dq[head]];
  }
  // 3) release smoothing (never above `hold`)
  const rc = 1 - Math.exp(-1 / (release * SR)), rel = new Float32Array(n);
  let g = 1;
  for (let i = 0; i < n; i++) {
    const h = hold[i];
    g = h < g ? h : g + (1 - g) * rc;
    rel[i] = g < h ? g : h;
  }
  // 4) centred box smoothing of half-width W: mean of values that are all <= req[i], so the ceiling still holds
  //    (edges replicate the first/last value, which is also <= req of the samples that see it)
  const pre = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + rel[i];
  const span = 2 * W + 1;
  for (let i = 0; i < n; i++) {
    const a = i - W, b = i + W, lo = a < 0 ? 0 : a, hi = b > n - 1 ? n - 1 : b;
    const gain = (pre[hi + 1] - pre[lo] + (lo - a) * rel[0] + (b - hi) * rel[n - 1]) / span; // replicate edges
    L[i] *= gain; R[i] *= gain;
  }
  return bus;
}

/** ITU-R BS.1770-4 integrated loudness (LUFS) with K-weighting @48 kHz, absolute + relative gating. */
export function lufs(bus) {
  const ks = [
    [1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585],
    [1, -2, 1, -1.99004745483398, 0.99007225036621],
  ];
  const chans = [bus.L, bus.R].map((c) => filt(Float32Array.from(c), ks));
  const B = Math.round(0.4 * SR), H = Math.round(0.1 * SR);
  const blocks = [];
  for (let s = 0; s + B <= bus.n; s += H) {
    let z = 0;
    for (const c of chans) { let a = 0; for (let i = s; i < s + B; i++) a += c[i] * c[i]; z += a / B; }
    blocks.push(z);
  }
  const l = (z) => -0.691 + 10 * Math.log10(z);
  const abs = blocks.filter((z) => l(z) > -70);
  if (!abs.length) return -Infinity;
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const rel = l(mean(abs)) - 10;
  const gated = abs.filter((z) => l(z) > rel);
  return l(mean(gated));
}

// ---------------------------------------------------------------------------------------------
// analysis (for the video's music-reactive layer)
// ---------------------------------------------------------------------------------------------
function fftInPlace(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-TAU) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}
/** Log-spaced band levels (0..255, -78..0 dBFS) per hop, plus overall RMS (0..255). */
export function analyse(bus, { hz = 60, size = 2048, bands = 24, fMin = 32, fMax = 16000 } = {}) {
  const hop = Math.round(SR / hz), frames = Math.floor(bus.n / hop);
  const win = new Float64Array(size).map((_, i) => 0.5 - 0.5 * Math.cos((TAU * i) / (size - 1)));
  const edges = Array.from({ length: bands + 1 }, (_, i) => fMin * Math.pow(fMax / fMin, i / bands));
  const binHz = SR / size;
  const bandBins = Array.from({ length: bands }, (_, b) => [Math.max(1, Math.floor(edges[b] / binHz)), Math.max(Math.floor(edges[b] / binHz) + 1, Math.ceil(edges[b + 1] / binHz))]);
  const out = new Uint8Array(frames * bands), rmsOut = new Uint8Array(frames);
  const re = new Float64Array(size), im = new Float64Array(size);
  for (let f = 0; f < frames; f++) {
    const c = f * hop + (hop >> 1), s0 = c - (size >> 1);
    let e = 0;
    for (let i = 0; i < size; i++) {
      const k = s0 + i, m = k >= 0 && k < bus.n ? 0.5 * (bus.L[k] + bus.R[k]) : 0;
      re[i] = m * win[i]; im[i] = 0; e += m * m;
    }
    fftInPlace(re, im);
    for (let b = 0; b < bands; b++) {
      let peak = 0;
      for (let k = bandBins[b][0]; k < bandBins[b][1]; k++) peak = Math.max(peak, Math.hypot(re[k], im[k]));
      const db = toDb((peak / (size * 0.25)) + 1e-9);
      out[f * bands + b] = Math.round(clamp((db + 78) / 78, 0, 1) * 255);
    }
    rmsOut[f] = Math.round(clamp((toDb(Math.sqrt(e / size)) + 60) / 60, 0, 1) * 255);
  }
  return { hz, bands, frames, data: out, rms: rmsOut, edges };
}

// ---------------------------------------------------------------------------------------------
// io
// ---------------------------------------------------------------------------------------------
/** 16-bit PCM WAV with TPDF dither. */
export function wav16(bus) {
  const n = bus.n, buf = Buffer.alloc(44 + n * 4), r = rng(99);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (const c of [bus.L, bus.R]) {
      const d = (r() - r()) / 32768;
      buf.writeInt16LE(Math.round(clamp(c[i] + d, -1, 1) * 32767), o); o += 2;
    }
  }
  return buf;
}
