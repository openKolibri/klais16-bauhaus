// Synth voices for the track. Each voice renders into a temporary mono buffer and mixes it into a Bus at time t.
import { readFileSync } from 'node:fs';
import { SR, TAU, rng, mtof, biquad, filt, sawBL, squareBL, SVF, Ladder, clamp } from './dsp.mjs';

const R = rng(20240928);
const nz = () => R() * 2 - 1;

const panGains = (p) => {
  const a = ((clamp(p, -1, 1) + 1) * Math.PI) / 4;
  return [Math.cos(a), Math.sin(a)];
};

/** mix a mono buffer into a bus at time t (seconds) */
export function put(bus, t, buf, gain = 1, pan = 0) {
  const n0 = Math.round(t * SR);
  if (n0 >= bus.n || n0 + buf.length <= 0) return;
  const [gl, gr] = panGains(pan);
  const len = Math.min(buf.length, bus.n - n0), L = bus.L, Rr = bus.R;
  for (let i = Math.max(0, -n0); i < len; i++) {
    const s = buf[i] * gain;
    L[n0 + i] += s * gl;
    Rr[n0 + i] += s * gr;
  }
}

// cached filters
const HP30 = biquad('hp', 30, 0.7);
const HAT_HP = [biquad('hp', 7000, 0.8), biquad('peak', 10500, 1.1, 4)];
const CLAP_BP = [biquad('bp', 1250, 0.9), biquad('hp', 520, 0.7)];
const TICK_BP = biquad('bp', 6800, 2.2);

// ------------------------------------------------------------------------------------------------
// drums
// ------------------------------------------------------------------------------------------------
/** Techno kick: two-stage pitch glide sine, saturated, with a short click. Tuned to the key (F1 = 43.65 Hz). */
export function kick(bus, t, vel = 1, o = {}) {
  const { f0 = 210, fm = 60, f1 = 43.65, tauP = 0.016, tauM = 0.075, decay = 0.165, len = 0.5, drive = 2.7, click = 0.5, body = true } = o;
  const n = Math.round(len * SR), buf = new Float32Array(n);
  let ph = 0;
  const td = Math.tanh(drive);
  for (let i = 0; i < n; i++) {
    const s = i / SR;
    const f = f1 + (fm - f1) * Math.exp(-s / tauM) + (f0 - fm) * Math.exp(-s / tauP);
    ph += (TAU * f) / SR;
    const env = (1 - Math.exp(-s / 0.0006)) * Math.exp(-s / decay) * (s > len - 0.06 ? (len - s) / 0.06 : 1);
    buf[i] = Math.tanh(Math.sin(ph) * env * drive) / td;
  }
  if (click > 0) {
    const m = Math.round(0.008 * SR);
    for (let i = 0; i < m; i++) {
      const s = i / SR;
      buf[i] += click * (0.45 * nz() * Math.exp(-s / 0.0011) + 0.35 * Math.sin(TAU * 1900 * s) * Math.exp(-s / 0.0016));
    }
  }
  filt(buf, HP30);
  if (o.lp) filt(buf, biquad('lp', o.lp, 0.7));
  put(bus, t, buf, vel * (o.gain ?? 1), 0);
  return buf;
}

/** 909-ish metallic hat: six detuned squares + noise, high-passed. */
const HAT_F = [205.3, 304.4, 369.6, 522.7, 540, 800];
export function hat(bus, t, vel = 0.5, o = {}) {
  const { decay = 0.04, pan = 0, pitch = 1 } = o;
  const n = Math.round((decay * 6 + 0.01) * SR), buf = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const s = i / SR;
    let m = 0;
    for (let k = 0; k < 6; k++) m += (s * HAT_F[k] * pitch) % 1 < 0.5 ? 1 : -1;
    buf[i] = (m * 0.09 + nz() * 0.6) * (1 - Math.exp(-s / 0.0003)) * Math.exp(-s / decay);
  }
  filt(buf, HAT_HP);
  put(bus, t, buf, vel, pan);
}

export function clap(bus, t, vel = 0.8, o = {}) {
  const { pan = 0, tail = 0.13 } = o;
  const n = Math.round(0.5 * SR), buf = new Float32Array(n), starts = [0, 0.0105, 0.0225, 0.035];
  for (let i = 0; i < n; i++) {
    const s = i / SR;
    let e = 0;
    for (let k = 0; k < 3; k++) if (s >= starts[k]) e = Math.max(e, Math.exp(-(s - starts[k]) / 0.0032));
    if (s >= starts[3]) e = Math.max(e, 0.9 * Math.exp(-(s - starts[3]) / (tail / 3)));
    buf[i] = nz() * e;
  }
  filt(buf, CLAP_BP);
  put(bus, t, buf, vel * 1.8, pan);
}

export function snare(bus, t, vel = 0.7, o = {}) {
  const { pan = 0, f = 188, decay = 0.1 } = o;
  const n = Math.round(0.4 * SR), buf = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const s = i / SR;
    ph += (TAU * (f + f * 0.7 * Math.exp(-s / 0.018))) / SR;
    buf[i] = Math.sin(ph) * Math.exp(-s / 0.055) * 0.7 + nz() * Math.exp(-s / decay) * 0.8;
  }
  filt(buf, [biquad('hp', 240, 0.7), biquad('peak', 3200, 0.9, 5)]);
  put(bus, t, buf, vel, pan);
}

/** short metallic tick used for the polyrhythmic (5-step) hi loop */
export function tick(bus, t, vel = 0.4, o = {}) {
  const { pan = 0, pitch = 2400 } = o;
  const n = Math.round(0.06 * SR), buf = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const s = i / SR;
    buf[i] = (nz() * 0.8 + Math.sin(TAU * pitch * s) * 0.7) * Math.exp(-s / 0.008) * (1 - Math.exp(-s / 0.0002));
  }
  filt(buf, TICK_BP);
  put(bus, t, buf, vel * 2.2, pan);
}

/** two-operator FM "clank": industrial metal hit */
export function clank(bus, t, vel = 0.5, o = {}) {
  const { pan = 0, freq = 420, ratio = 1.4142, index = 4.5, decay = 0.09 } = o;
  const n = Math.round((decay * 6) * SR), buf = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const s = i / SR;
    const idx = index * Math.exp(-s / 0.035);
    buf[i] = Math.sin(TAU * freq * s + idx * Math.sin(TAU * freq * ratio * s)) * Math.exp(-s / decay);
  }
  filt(buf, [biquad('hp', 260, 0.7)]);
  put(bus, t, buf, vel, pan);
}

export function tom(bus, t, vel = 0.6, o = {}) {
  const { pan = 0, f = 96, decay = 0.16 } = o;
  const n = Math.round(0.5 * SR), buf = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const s = i / SR;
    ph += (TAU * (f + f * 0.9 * Math.exp(-s / 0.03))) / SR;
    buf[i] = Math.tanh(1.6 * Math.sin(ph)) * Math.exp(-s / decay) * (1 - Math.exp(-s / 0.0008));
  }
  put(bus, t, buf, vel, pan);
}

/** crash cymbal; `reverse` gives the swelling pre-hit version that *ends* at time t. */
export function crash(bus, t, vel = 0.6, o = {}) {
  const { decay = 1.1, reverse = false, pan = 0, dur = decay * 3.2 } = o;
  const n = Math.round(dur * SR), buf = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const s = i / SR;
    let m = 0;
    for (let k = 0; k < 6; k++) m += (s * HAT_F[k] * 1.9) % 1 < 0.5 ? 1 : -1;
    buf[i] = (m * 0.06 + nz() * 0.7) * (1 - Math.exp(-s / 0.0004)) * Math.exp(-s / decay);
  }
  filt(buf, [biquad('hp', 3200, 0.7), biquad('peak', 6500, 0.8, 3)]);
  if (reverse) buf.reverse();
  put(bus, reverse ? t - dur : t, buf, vel, pan);
}

// ------------------------------------------------------------------------------------------------
// bass
// ------------------------------------------------------------------------------------------------
/**
 * Monophonic acid line: PolyBLEP saw -> resonant ladder filter with accent/slide, like a certain little silver box.
 * notes: [{t, dur, midi, acc, slide}]  cutoffAt(t) -> base cutoff Hz
 */
export function acid(bus, notes, { cutoffAt, res = 0.9, drive = 1.5, envMod = 2400, decay = 0.2, accDecay = 0.1, accBoost = 1.5, slide = 0.06, gain = 1, from, to } = {}) {
  if (!notes.length) return;
  const lad = new Ladder();
  const i0 = Math.max(0, Math.round((from ?? notes[0].t) * SR)), i1 = Math.min(bus.n, Math.round((to ?? notes[notes.length - 1].t + notes[notes.length - 1].dur + 0.6) * SR));
  const slideC = 1 - Math.exp(-1 / (slide * SR));
  let ph = 0, freq = 0, tgt = 0, on = false, tOn = -1, tOff = 0, acc = false, amp = 0, ni = 0, prevOn = false;
  const dcHP = { z: 0, y: 0 };
  for (let i = i0; i < i1; i++) {
    const t = i / SR;
    while (ni < notes.length && notes[ni].t <= t) {
      const nt = notes[ni++];
      const f = mtof(nt.midi);
      const legato = prevOn && nt.slide;
      tgt = f;
      if (!legato || freq === 0) freq = f;
      if (!legato) { tOn = nt.t; }
      acc = !!nt.acc;
      on = true; prevOn = true; tOff = nt.t + nt.dur;
      if (legato) tOn = tOn < 0 ? nt.t : tOn;
    }
    if (on && t >= tOff) { on = false; prevOn = false; }
    freq += (tgt - freq) * slideC;
    ph += freq / SR; if (ph >= 1) ph -= 1;
    const dt = freq / SR;
    const osc = sawBL(ph, dt);
    amp += on ? (1 - amp) * 0.03 : (0 - amp) * 0.006;
    const age = tOn < 0 ? 9 : t - tOn;
    const fe = Math.exp(-age / (acc ? accDecay : decay));
    const fc = clamp(cutoffAt(t) + envMod * fe * (acc ? accBoost : 1), 70, 9500);
    let y = lad.tick(osc * amp, fc, res, drive) * (acc ? 1.35 : 1) * gain * 2.6;
    // gentle DC blocker
    const hp = y - dcHP.z + 0.995 * dcHP.y; dcHP.z = y; dcHP.y = hp; y = hp;
    bus.L[i] += y; bus.R[i] += y;
  }
}

// ------------------------------------------------------------------------------------------------
// chords, pads, plucks
// ------------------------------------------------------------------------------------------------
/** dub-techno chord stab: detuned saws through an enveloped low-pass. */
export function stab(bus, t, notes, o = {}) {
  const { dur = 0.35, cutoff = 1500, base = 380, decay = 0.13, q = 1.6, det = 0.09, pan = 0, gain = 1, voices = 3 } = o;
  const n = Math.round(dur * SR), buf = new Float32Array(n);
  const oscs = [];
  for (const m of notes) for (let v = 0; v < voices; v++) oscs.push({ f: mtof(m + (v - (voices - 1) / 2) * det), ph: R() });
  const svf = new SVF();
  for (let i = 0; i < n; i++) {
    const s = i / SR;
    let x = 0;
    for (const os of oscs) { os.ph += os.f / SR; if (os.ph >= 1) os.ph -= 1; x += sawBL(os.ph, os.f / SR); }
    const env = (1 - Math.exp(-s / 0.002)) * Math.exp(-s / (dur * 0.4)) ;
    svf.tick(x / oscs.length, base + cutoff * Math.exp(-s / decay), q);
    buf[i] = svf.lp * env * (s > dur - 0.03 ? (dur - s) / 0.03 : 1);
  }
  put(bus, t, buf, gain, pan);
}

/** slow, wide pad: detuned saws, gentle low-pass, long attack/release. */
export function pad(bus, t, dur, notes, o = {}) {
  const { att = 1.0, rel = 1.4, cutoff = 900, gain = 1, det = 0.14, voices = 4, lfo = 0.07 } = o;
  const n = Math.round((dur + rel) * SR);
  const bl = new Float32Array(n), br = new Float32Array(n);
  const oscs = [];
  for (const m of notes) for (let v = 0; v < voices; v++) oscs.push({ f: mtof(m + (v - (voices - 1) / 2) * det), ph: R(), pan: (v / (voices - 1)) * 2 - 1 });
  const sl = new SVF(), sr = new SVF();
  for (let i = 0; i < n; i++) {
    const s = i / SR;
    let xl = 0, xr = 0;
    for (const os of oscs) {
      os.ph += os.f / SR; if (os.ph >= 1) os.ph -= 1;
      const v = sawBL(os.ph, os.f / SR);
      xl += v * (0.5 - os.pan * 0.35); xr += v * (0.5 + os.pan * 0.35);
    }
    const fc = cutoff * (1 + 0.35 * Math.sin(TAU * lfo * s));
    sl.tick(xl / oscs.length, fc, 0.9); sr.tick(xr / oscs.length, fc * 1.03, 0.9);
    const env = Math.min(1, s / att) * (s > dur ? Math.max(0, 1 - (s - dur) / rel) : 1);
    const e2 = env * env * (3 - 2 * env); // smoothstep
    bl[i] = sl.lp * e2; br[i] = sr.lp * e2;
  }
  const n0 = Math.round(t * SR), len = Math.min(n, bus.n - n0);
  for (let i = 0; i < len; i++) { bus.L[n0 + i] += bl[i] * gain; bus.R[n0 + i] += br[i] * gain; }
}

/** plucked lead / arp note */
export function pluck(bus, t, midi, o = {}) {
  const { dur = 0.22, cutoff = 2600, base = 500, decay = 0.09, q = 2.2, gain = 1, pan = 0, sq = 0.5 } = o;
  const f = mtof(midi), n = Math.round(dur * SR), buf = new Float32Array(n), svf = new SVF();
  let p1 = 0, p2 = R();
  for (let i = 0; i < n; i++) {
    const s = i / SR, dt = f / SR;
    p1 += dt; if (p1 >= 1) p1 -= 1;
    p2 += dt * 1.004; if (p2 >= 1) p2 -= 1;
    const x = sawBL(p1, dt) * (1 - sq) + squareBL(p2, dt * 1.004) * sq;
    svf.tick(x, base + cutoff * Math.exp(-s / decay), q);
    buf[i] = svf.lp * Math.exp(-s / (dur * 0.35)) * (1 - Math.exp(-s / 0.0015)) * (s > dur - 0.02 ? (dur - s) / 0.02 : 1);
  }
  put(bus, t, buf, gain, pan);
}

/** tiny serial-data ping (the UART rhythm layer) */
export function blip(bus, t, midi, vel = 0.5, pan = 0) {
  const f = mtof(midi), n = Math.round(0.28 * SR), buf = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const s = i / SR;
    buf[i] = (Math.sin(TAU * f * s) + 0.35 * Math.sin(TAU * f * 2.0 * s + 0.5 * Math.sin(TAU * f * 0.5 * s))) * Math.exp(-s / 0.045) * (1 - Math.exp(-s / 0.0004));
  }
  put(bus, t, buf, vel, pan);
}

// ------------------------------------------------------------------------------------------------
// atmosphere & fx
// ------------------------------------------------------------------------------------------------
/** slowly breathing detuned drone */
export function drone(bus, t0, dur, notes, o = {}) {
  const { gain = 1, cutoff = 420, lfo = 0.06, fadeIn = 3, fadeOut = 3, res = 1.2 } = o;
  const n = Math.round(dur * SR), i0 = Math.round(t0 * SR);
  const oscs = [];
  for (const m of notes) for (const d of [-0.08, 0.07]) oscs.push({ f: mtof(m + d), ph: R() });
  const sl = new SVF(), sr = new SVF();
  for (let i = 0; i < n && i0 + i < bus.n; i++) {
    const s = i / SR;
    let x = 0, y = 0;
    oscs.forEach((os, k) => { os.ph += os.f / SR; if (os.ph >= 1) os.ph -= 1; const v = sawBL(os.ph, os.f / SR); if (k & 1) x += v; else y += v; });
    const fc = cutoff * (1 + 0.6 * Math.sin(TAU * lfo * s) + 0.25 * Math.sin(TAU * lfo * 2.7 * s + 1));
    sl.tick(x / oscs.length * 2, fc, res); sr.tick(y / oscs.length * 2, fc * 1.05, res);
    const e = Math.min(1, s / fadeIn) * Math.min(1, (dur - s) / fadeOut);
    bus.L[i0 + i] += sl.lp * e * gain; bus.R[i0 + i] += sr.lp * e * gain;
  }
}

/** band-passed noise with slow wandering centre frequency */
export function wind(bus, t0, dur, o = {}) {
  const { gain = 1, f0 = 500, f1 = 1800, q = 5, fadeIn = 2, fadeOut = 2, lfo = 0.09 } = o;
  const n = Math.round(dur * SR), i0 = Math.round(t0 * SR), a = new SVF(), b = new SVF();
  for (let i = 0; i < n && i0 + i < bus.n; i++) {
    const s = i / SR, u = 0.5 + 0.5 * Math.sin(TAU * lfo * s);
    const fc = f0 * Math.pow(f1 / f0, u);
    a.tick(nz(), fc, q); b.tick(nz(), fc * 1.13, q);
    const e = Math.min(1, s / fadeIn) * Math.min(1, (dur - s) / fadeOut);
    bus.L[i0 + i] += a.bp * e * gain; bus.R[i0 + i] += b.bp * e * gain;
  }
}

/** 50 Hz mains hum + harmonics: "the panel is powered" */
export function hum(bus, t0, dur, o = {}) {
  const { gain = 1, fadeIn = 1.5, fadeOut = 2 } = o;
  const n = Math.round(dur * SR), i0 = Math.round(t0 * SR);
  for (let i = 0; i < n && i0 + i < bus.n; i++) {
    const s = i / SR;
    const x = Math.sin(TAU * 50 * s) * 0.5 + Math.sin(TAU * 100 * s + 0.4) * 0.35 + Math.sin(TAU * 150 * s + 1.1) * 0.22 + Math.sin(TAU * 250 * s) * 0.06;
    const e = Math.min(1, s / fadeIn) * Math.min(1, (dur - s) / fadeOut) * (0.85 + 0.15 * Math.sin(TAU * 0.4 * s));
    bus.L[i0 + i] += x * e * gain; bus.R[i0 + i] += x * e * gain;
  }
}

/** swelling filtered-noise riser (with a rising sine) */
export function riser(bus, t0, dur, o = {}) {
  const { gain = 1, f0 = 250, f1 = 9000, q0 = 1.2, q1 = 4.5, curve = 1.6, tone = 0 } = o;
  const n = Math.round(dur * SR), i0 = Math.round(t0 * SR), a = new SVF(), b = new SVF();
  let ph = 0;
  for (let i = 0; i < n && i0 + i < bus.n; i++) {
    const u = i / n, fc = f0 * Math.pow(f1 / f0, Math.pow(u, curve)), q = q0 + (q1 - q0) * u;
    a.tick(nz(), fc, q); b.tick(nz(), fc * 1.07, q);
    const e = Math.pow(u, 2.1);
    let tn = 0;
    if (tone) { ph += (TAU * (200 + 1800 * u * u)) / SR; tn = Math.sin(ph) * tone; }
    bus.L[i0 + i] += (a.bp * 1.6 + tn) * e * gain; bus.R[i0 + i] += (b.bp * 1.6 + tn) * e * gain;
  }
}

/** sub boom + noise burst */
export function impact(bus, t, vel = 1, o = {}) {
  const { decay = 1.1, gain = 1 } = o;
  const n = Math.round(decay * 4 * SR), buf = new Float32Array(n);
  let ph = 0;
  const svf = new SVF();
  for (let i = 0; i < n; i++) {
    const s = i / SR;
    ph += (TAU * (32 + 70 * Math.exp(-s / 0.22))) / SR;
    svf.tick(nz(), 380 * Math.exp(-s / 0.35) + 60, 0.9);
    buf[i] = (Math.tanh(1.8 * Math.sin(ph)) * Math.exp(-s / decay) * 0.9 + svf.lp * Math.exp(-s / 0.3) * 0.9) * (1 - Math.exp(-s / 0.002));
  }
  put(bus, t, buf, vel * gain, 0);
}

// ------------------------------------------------------------------------------------------------
// robot voice (eSpeak NG formant samples, see tools/make-voice.mjs)
// ------------------------------------------------------------------------------------------------
const sampleCache = new Map();
export function loadSample(name) {
  let smp = sampleCache.get(name);
  if (!smp) {
    const b = readFileSync(new URL(`./samples/${name}.wav`, import.meta.url)), sr = b.readUInt32LE(24);
    let o = 12;
    while (b.toString('ascii', o, o + 4) !== 'data') o += 8 + b.readUInt32LE(o + 4);
    const n = b.readUInt32LE(o + 4) / 2, x = new Float32Array(n);
    for (let i = 0; i < n; i++) x[i] = b.readInt16LE(o + 8 + i * 2) / 32768;
    smp = { sr, x };
    sampleCache.set(name, smp);
  }
  return smp;
}

/**
 * One-shot robot voice: resampled with cubic interpolation (rate = pitch AND speed), optional gate length,
 * bit-crush and reverse (a reversed hit *ends* at time t). Returns the duration in seconds.
 */
export function voice(bus, t, name, o = {}) {
  const { rate = 1, gain = 1, pan = 0, len = null, reverse = false, crush = 0, fade = 0.006 } = o;
  const { sr: sr0, x } = loadSample(name);
  const inc = (sr0 / SR) * rate;
  let n = Math.floor((x.length - 2) / inc);
  if (len) n = Math.min(n, Math.floor(len * SR));
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = i * inc, i0 = Math.floor(p), fr = p - i0;
    const y0 = x[Math.max(0, i0 - 1)], y1 = x[i0], y2 = x[Math.min(x.length - 1, i0 + 1)], y3 = x[Math.min(x.length - 1, i0 + 2)];
    buf[i] = ((((0.5 * (y3 - y0) + 1.5 * (y1 - y2)) * fr + (y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3)) * fr + 0.5 * (y2 - y0)) * fr) + y1;
  }
  const fn = Math.min(Math.round(fade * SR), n >> 1);
  for (let i = 0; i < fn; i++) { buf[i] *= i / fn; buf[n - 1 - i] *= i / fn; }
  if (crush) { const hold = Math.max(1, Math.round(SR / crush)); let h = 0; for (let i = 0; i < n; i++) { if (i % hold === 0) h = Math.round(buf[i] * 60) / 60; buf[i] = h; } }
  if (reverse) buf.reverse();
  put(bus, reverse ? t - n / SR : t, buf, gain, pan);
  return n / SR;
}
