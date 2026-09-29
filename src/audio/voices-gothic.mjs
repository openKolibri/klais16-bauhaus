// Voices of the gothic edition: church bells and handbells (inharmonic partials), a mallet/celesta, a wavetable pipe organ,
// a reed lead, a chain rattle, fire crackle, a snuffed candle and a heartbeat. All synthesized from sines, noise and
// filters - no samples and, deliberately, nothing that sounds like a human voice (no formant filters, no choir).
import { SR, TAU, rng, mtof, biquad, filt, SVF, sawBL, squareBL, clamp } from './dsp.mjs';
import { put } from './voices.mjs';
export { put, kick, snare, tick, clank, tom, crash, impact, riser, drone, wind, acid } from './voices.mjs';

const R = rng(1666);
const nz = () => R() * 2 - 1;
const peakNorm = (buf) => { let p = 0; for (let i = 0; i < buf.length; i++) p = Math.max(p, Math.abs(buf[i])); if (p > 0) for (let i = 0; i < buf.length; i++) buf[i] /= p; return buf; };

// ------------------------------------------------------------------------------------------------
// bells
// ------------------------------------------------------------------------------------------------
// a church bell's partials are not harmonic: hum (0.5), prime (1), tierce (a minor third), quint, nominal (octave) ...
const BELL = [ // ratio to the prime, level, relative decay time
  [0.5, 0.5, 1.0], [1.0, 1.0, 0.85], [1.183, 0.7, 0.7], [1.506, 0.42, 0.55], [2.0, 0.62, 0.62], [2.514, 0.28, 0.38],
  [2.662, 0.24, 0.34], [3.011, 0.2, 0.3], [4.166, 0.13, 0.2], [5.433, 0.08, 0.14], [6.796, 0.05, 0.1],
];
const bellCache = new Map();
/** a bell as a peak-normalised mono buffer (cached). `size` scales the ring time: great bell ~2.5, handbell ~0.25 */
export function bellBuf(midi, { size = 1, bright = 1, hum = 1 } = {}) {
  const key = `${midi}|${size}|${bright}|${hum}`;
  let buf = bellCache.get(key);
  if (buf) return buf;
  const f0 = mtof(midi), tau0 = 3.2 * size, len = Math.round(Math.min(9, tau0 * 4 + 0.2) * SR);
  buf = new Float32Array(len);
  for (const [ratio, amp, dk] of BELL) {
    const f = f0 * ratio;
    if (f > 15000) continue;
    const a = amp * (ratio === 0.5 ? hum : ratio > 2 ? bright : 1), decay = Math.exp(-1 / (tau0 * dk * SR));
    // two slightly split modes make every partial shimmer, as in a real (never perfectly round) bell
    const w1 = (TAU * f) / SR, w2 = (TAU * (f + 0.4 + 0.9 * ((ratio * 7) % 1))) / SR;
    let e = a;
    for (let i = 0; i < len && e > 1e-4; i++) { buf[i] += e * (Math.sin(w1 * i) + 0.55 * Math.sin(w2 * i)); e *= decay; }
  }
  // the clapper: a few ms of noise
  const cn = Math.round(0.014 * SR);
  for (let i = 0; i < cn; i++) buf[i] += 0.9 * bright * nz() * Math.exp(-i / (SR * 0.002));
  for (let i = 0; i < 24; i++) buf[i] *= i / 24;
  peakNorm(buf);
  bellCache.set(key, buf);
  return buf;
}
/**
 * Strike a bell. reverse: a swelling reversed bell that *ends* at time t (`dur` seconds long).
 * o.size / o.bright / o.hum shape the bell (see bellBuf).
 */
export function bell(bus, t, midi, vel = 0.6, o = {}) {
  const { pan = 0, reverse = false, dur = 2.2 } = o;
  const buf = bellBuf(midi, o);
  if (reverse) {
    const n = Math.min(buf.length, Math.round(dur * SR)), r = new Float32Array(n);
    for (let i = 0; i < n; i++) r[i] = buf[n - 1 - i] * Math.pow(i / n, 0.6);
    put(bus, t - n / SR, r, vel, pan);
  } else put(bus, t, buf, vel, pan);
}

// a struck metal bar: celesta / glockenspiel / music box
const MALLET = [[1, 1.0, 1.0], [2.756, 0.32, 0.4], [5.404, 0.12, 0.17], [8.933, 0.05, 0.09]];
const malletCache = new Map();
export function mallet(bus, t, midi, vel = 0.5, { pan = 0, decay = 0.7, bright = 1 } = {}) {
  const key = `${midi}|${decay}|${bright}`;
  let buf = malletCache.get(key);
  if (!buf) {
    const f0 = mtof(midi), len = Math.round((decay * 5 + 0.05) * SR);
    buf = new Float32Array(len);
    for (const [ratio, amp, dk] of MALLET) {
      const f = f0 * ratio;
      if (f > 15000) continue;
      const w = (TAU * f) / SR, d = Math.exp(-1 / (decay * dk * SR));
      let e = amp * (ratio > 1 ? bright : 1);
      for (let i = 0; i < len && e > 1e-4; i++) { buf[i] += e * Math.sin(w * i); e *= d; }
    }
    const cn = Math.round(0.004 * SR);
    for (let i = 0; i < cn; i++) buf[i] += 0.35 * nz() * Math.exp(-i / (SR * 0.0008));
    for (let i = 0; i < 12; i++) buf[i] *= i / 12;
    peakNorm(buf);
    malletCache.set(key, buf);
  }
  put(bus, t, buf, vel, pan);
}

// ------------------------------------------------------------------------------------------------
// pipe organ (additive wavetable) and reed lead
// ------------------------------------------------------------------------------------------------
// one table cycle = one period of the 16' pipe; entries are harmonics of it: 1 = 16', 2 = 8', 3 = 5 1/3', 4 = 4', 6 = 2 2/3', 8 = 2' ...
export const STOPS = {
  full: [[1, 0.42], [2, 1.0], [3, 0.4], [4, 0.72], [6, 0.38], [8, 0.34], [10, 0.15], [12, 0.13], [16, 0.07]],
  diapason: [[1, 0.25], [2, 1.0], [4, 0.55], [6, 0.18], [8, 0.16]],
  flute: [[2, 1.0], [4, 0.22], [6, 0.05]],
  dark: [[1, 0.6], [2, 1.0], [3, 0.25], [4, 0.3]],
};
const tableCache = new Map();
function organTable(name) {
  let t = tableCache.get(name);
  if (!t) {
    const N = 4096;
    t = new Float32Array(N + 1);
    for (const [h, a] of STOPS[name]) for (let i = 0; i < N; i++) t[i] += a * Math.sin((TAU * h * i) / N);
    peakNorm(t); t[N] = t[0];
    tableCache.set(name, t);
  }
  return t;
}
/**
 * Pipe-organ chord. notes: MIDI numbers. lp: low-pass cutoff in Hz, or [from, to] for an exponential sweep over the note.
 * trem: tremulant depth, chiff: the breath noise at the start of every pipe. Stereo: pipes are spread across the field.
 */
export function organ(bus, t, dur, notes, o = {}) {
  const { gain = 1, att = 0.06, rel = 0.4, stops = 'full', lp = 3800, trem = 0.05, tremRate = 5.6, det = 0.0012, chiff = 0.22, spread = 0.55, res = 0.75 } = o;
  const tab = organTable(stops), n = Math.round((dur + rel) * SR), i0 = Math.round(t * SR);
  if (i0 >= bus.n) return;
  const voices = [];
  notes.forEach((m, k) => {
    const f = mtof(m), pan = notes.length > 1 ? (k / (notes.length - 1)) * 2 - 1 : 0;
    for (const d of [-1, 1]) voices.push({ inc: (f * (1 + d * det)) / 2 / SR, ph: R(), gl: 0.5 - pan * spread * 0.5, gr: 0.5 + pan * spread * 0.5 });
  });
  const norm = 1 / Math.sqrt(voices.length), sl = new SVF(), sr = new SVF();
  const [lp0, lp1] = Array.isArray(lp) ? lp : [lp, lp];
  const N4 = 4096, cn = Math.round(0.04 * SR), chL = new SVF(), chR = new SVF();
  for (let i = 0; i < n && i0 + i < bus.n; i++) {
    const s = i / SR;
    let xl = 0, xr = 0;
    for (const v of voices) {
      v.ph += v.inc; if (v.ph >= 1) v.ph -= 1;
      const p = v.ph * N4, k = p | 0, fr = p - k, y = tab[k] + (tab[k + 1] - tab[k]) * fr;
      xl += y * v.gl; xr += y * v.gr;
    }
    const a = clamp(s / att, 0, 1), e = a * a * (3 - 2 * a) * (s > dur ? Math.max(0, 1 - (s - dur) / rel) : 1);
    const fc = lp0 * Math.pow(lp1 / lp0, clamp(s / dur, 0, 1));
    let yl = sl.tick(xl * norm, fc, res), yr = sr.tick(xr * norm, fc, res);
    if (chiff > 0 && i < cn) { const c = Math.exp(-i / (SR * 0.009)) * chiff; yl += chL.tick(nz(), 2400, 1.6) * c * 3; yr += chR.tick(nz(), 2400, 1.6) * c * 3; }
    const tr = 1 + trem * Math.sin(TAU * tremRate * s);
    bus.L[i0 + i] += yl * e * tr * gain; bus.R[i0 + i] += yr * e * tr * gain;
  }
}

/** bombarde-like reed: saw + square through a resonant low-pass that opens with the note, with late vibrato */
export function reed(bus, t, midi, dur, o = {}) {
  const { gain = 1, att = 0.025, rel = 0.16, cutoff = 2800, base = 600, q = 1.3, vib = 0.0035, pan = 0, sq = 0.4, drive = 1.7 } = o;
  const f = mtof(midi), n = Math.round((dur + rel) * SR), buf = new Float32Array(n), svf = new SVF();
  let p1 = R(), p2 = R();
  for (let i = 0; i < n; i++) {
    const s = i / SR, fv = f * (1 + vib * Math.sin(TAU * 5.4 * s) * clamp((s - 0.12) / 0.3, 0, 1));
    const dt = fv / SR;
    p1 += dt; if (p1 >= 1) p1 -= 1;
    p2 += dt * 1.003; if (p2 >= 1) p2 -= 1;
    const x = sawBL(p1, dt) * (1 - sq) + squareBL(p2, dt * 1.003) * sq;
    const open = clamp(s / (att * 3.5), 0, 1);
    svf.tick(x, base + cutoff * (0.45 + 0.55 * open), q);
    const e = clamp(s / att, 0, 1) * (s > dur ? Math.max(0, 1 - (s - dur) / rel) : 1);
    buf[i] = Math.tanh(drive * svf.lp) * e;
  }
  put(bus, t, buf, gain * 0.7, pan);
}

// ------------------------------------------------------------------------------------------------
// percussion and texture
// ------------------------------------------------------------------------------------------------
// one chain link falling on another: a click plus a short, slightly inharmonic metal ring
const LINKS = Array.from({ length: 6 }, (_, k) => {
  const n = Math.round(0.06 * SR), b = new Float32Array(n), fq = 2500 + 520 * k;
  for (let i = 0; i < n; i++) {
    const s = i / SR;
    b[i] = (nz() * 0.9 * Math.exp(-s / 0.0011) + Math.sin(TAU * fq * s) * 0.5 * Math.exp(-s / 0.011) + Math.sin(TAU * fq * 1.52 * s) * 0.32 * Math.exp(-s / 0.007) + Math.sin(TAU * fq * 2.31 * s) * 0.16 * Math.exp(-s / 0.004)) * (1 - Math.exp(-s / 0.0002));
  }
  return filt(b, [biquad('hp', 1800, 0.7)]);
});
/** a chain dropped on stone: n links landing with shrinking gaps (a bouncing-and-settling rattle) */
export function chain(bus, t, vel = 0.5, { n = 4, gap = 0.014, pan = 0, shrink = 0.72, fall = 0.78 } = {}) {
  let tt = 0, g = gap, a = 1;
  for (let k = 0; k < n; k++) {
    put(bus, t + tt, LINKS[Math.floor(R() * LINKS.length)], vel * a * (0.7 + 0.3 * R()), clamp(pan + (R() - 0.5) * 0.3, -1, 1));
    tt += g * (0.85 + 0.3 * R()); g *= shrink; a *= fall;
  }
}

/** sparse fire crackle: random tiny pops (deterministic) */
export function crackle(bus, t0, dur, { gain = 0.3, rate = 16, fadeIn = 1, fadeOut = 2, seed = 5 } = {}) {
  const r = rng(seed), n = Math.round(dur * SR), bp = [biquad('bp', 2600, 0.9), biquad('hp', 900, 0.7)];
  const pop = (len, amp) => { const b = new Float32Array(len); for (let i = 0; i < len; i++) b[i] = (r() * 2 - 1) * Math.exp(-i / (SR * 0.0014)) * amp; return filt(b, bp); };
  for (let i = 0; i < n; i += 48) {
    if (r() < (rate * 48) / SR) {
      const s = i / SR, e = Math.min(1, s / fadeIn) * Math.min(1, (dur - s) / fadeOut), a = Math.pow(r(), 2.5) * e;
      if (a > 0.01) put(bus, t0 + s, pop(Math.round(0.012 * SR), 1), gain * a * 3, r() * 1.6 - 0.8);
    }
  }
}

/** a candle snuffed: a short breath of noise whose brightness falls away */
export function snuff(bus, t, vel = 0.4, { pan = 0, dur = 0.34 } = {}) {
  const n = Math.round(dur * SR), buf = new Float32Array(n), svf = new SVF();
  for (let i = 0; i < n; i++) {
    const s = i / SR, e = clamp(s / 0.015, 0, 1) * Math.exp(-s / 0.09);
    svf.tick(nz(), 5200 * Math.exp(-s / 0.1) + 260, 0.9);
    buf[i] = svf.lp * e;
  }
  put(bus, t, buf, vel * 2.4, pan);
}

/** the "LED on" tick: a tiny electric click */
export function spark(bus, t, vel = 0.4, { pan = 0, pitch = 3800 } = {}) {
  const n = Math.round(0.03 * SR), buf = new Float32Array(n);
  for (let i = 0; i < n; i++) { const s = i / SR; buf[i] = (nz() * 0.6 + Math.sin(TAU * pitch * s)) * Math.exp(-s / 0.0035) * (1 - Math.exp(-s / 0.00015)); }
  filt(buf, [biquad('hp', 1500, 0.7)]);
  put(bus, t, buf, vel, pan);
}

/** a soft heartbeat thump (sine with a quick pitch drop, no click) */
export function thump(bus, t, vel = 0.5, { f0 = 95, f1 = 46, decay = 0.11, len = 0.4 } = {}) {
  const n = Math.round(len * SR), buf = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const s = i / SR;
    ph += (TAU * (f1 + (f0 - f1) * Math.exp(-s / 0.03))) / SR;
    buf[i] = Math.sin(ph) * Math.exp(-s / decay) * (1 - Math.exp(-s / 0.002));
  }
  put(bus, t, buf, vel, 0);
}
