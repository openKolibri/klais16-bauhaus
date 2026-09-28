// Cue sheet access: turns the synthesizer's event lists + spectrum analysis into per-frame envelopes.
// All lookups are pure functions of time (binary search), so any frame can be rendered independently.
import { clamp } from './util.js';

const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export class Cues {
  constructor(json) {
    this.j = json;
    this.bpm = json.bpm; this.STEP = json.step; this.BAR = json.bar; this.BEAT = json.step * 4;
    this.duration = json.duration; this.bars = json.bars;
    this.sections = json.sections;
    this.uart = json.uart;
    this.ev = json.events;
    this.times = {};
    for (const k of Object.keys(this.ev)) {
      this.ev[k].sort((a, b) => a[0] - b[0]);
      this.times[k] = Float64Array.from(this.ev[k], (e) => e[0]);
    }
    const sp = json.spectrum;
    this.sp = { hz: sp.hz, bands: sp.bands, frames: sp.frames, data: b64(sp.data), rms: b64(sp.rms) };
    this.tmp = new Float32Array(sp.bands);
  }

  /** index of the last event of `kind` with time <= T, or -1 */
  idx(kind, T) {
    const a = this.times[kind];
    if (!a) return -1;   // an event kind that this cue sheet does not have
    let lo = 0, hi = a.length - 1, r = -1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (a[m] <= T) { r = m; lo = m + 1; } else hi = m - 1; }
    return r;
  }
  /** seconds since the last `kind` event (Infinity if none yet) */
  age(kind, T) { const i = this.idx(kind, T); return i < 0 ? Infinity : T - this.times[kind][i]; }
  /** exponential decay envelope 1 -> 0 after each event */
  env(kind, T, tau) { const a = this.age(kind, T); return a === Infinity ? 0 : Math.exp(-a / tau); }
  /** last event record [t, ...] or null */
  last(kind, T) { const i = this.idx(kind, T); return i < 0 ? null : this.ev[kind][i]; }
  /** number of events so far */
  count(kind, T) { return this.idx(kind, T) + 1; }
  /** velocity-weighted envelope of the most recent event */
  envV(kind, T, tau) { const i = this.idx(kind, T); if (i < 0) return 0; const e = this.ev[kind][i]; return Math.exp(-(T - e[0]) / tau) * (e[1] ?? 1); }
  /** events of `kind` within [T0, T1) */
  between(kind, T0, T1) {
    const a = this.times[kind], out = [];
    if (!a) return out;
    let lo = 0, hi = a.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < T0) lo = m + 1; else hi = m; }
    for (let i = lo; i < a.length && a[i] < T1; i++) out.push(this.ev[kind][i]);
    return out;
  }

  /** log-spaced band levels 0..1 at time T (linear interpolation between analysis frames) */
  bands(T, out = this.tmp) {
    const { hz, bands, frames, data } = this.sp, f = clamp(T * hz, 0, frames - 1.001), i = Math.floor(f), w = f - i;
    for (let b = 0; b < bands; b++) out[b] = ((data[i * bands + b] * (1 - w)) + (data[(i + 1) * bands + b] * w)) / 255;
    return out;
  }
  rms(T) {
    const { hz, frames, rms } = this.sp, f = clamp(T * hz, 0, frames - 1.001), i = Math.floor(f), w = f - i;
    return (rms[i] * (1 - w) + rms[i + 1] * w) / 255;
  }
  /** mean of a band range */
  bandAvg(T, a, b) { const v = this.bands(T); let s = 0; for (let k = a; k < b; k++) s += v[k]; return s / (b - a); }

  sectionAt(T) { let s = this.sections[0]; for (const x of this.sections) if (T >= x.bar * this.BAR - 1e-6) s = x; return s; }

  /** UART layer (see song.mjs): bit at global step g */
  uartBit(g) {
    const { message, startStep } = this.uart;
    if (g < startStep) return { bit: 0, pos: 0, char: -1, code: 0 };
    const k = g - startStep, char = Math.floor(k / 10) % message.length, pos = k % 10, code = message.charCodeAt(char);
    return { bit: pos === 0 ? 0 : pos === 9 ? 1 : (code >> (pos - 1)) & 1, pos, char, code };
  }
}
