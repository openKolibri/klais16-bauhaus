// Renders the track: composes every part, mixes, masters to ~-14 LUFS and writes build/track.wav + build/cues.json.
// usage: node src/audio/render-audio.mjs [outDir]
import { mkdirSync, writeFileSync } from 'node:fs';
import { Bus, SR, SVF, biquad, filt, filtBus, makeReverb, pingPong, chorus, duckCurve, compress, limit, lufs, analyse, wav16, fromDb, toDb, clamp } from './dsp.mjs';
import { compose, DURATION, STEP, BAR, BPM, BARS, SECTIONS, MESSAGE, UART_START, t } from './song.mjs';
import { writePNG } from '../../tools/png.mjs';

const outDir = process.argv[2] || 'build';
mkdirSync(outDir, { recursive: true });
const tm = (label) => { const t0 = Date.now(); return () => console.log(`  ${label}: ${((Date.now() - t0) / 1000).toFixed(1)}s`); };

const N = Math.ceil(DURATION * SR);
const names = ['kick', 'rumble', 'acid', 'hats', 'clap', 'perc', 'stab', 'pad', 'pluck', 'blip', 'atmo', 'voice', 'fx'];
const tr = Object.fromEntries(names.map((n) => [n, new Bus(N)]));

let done = tm('compose + synthesis');
const { ev } = compose(tr);
done();

const S = (sec) => Math.round(sec * SR);
const setLevel = (bus, t0, t1, db) => { const r = bus.rms(S(t0), S(t1)); if (r > 0) bus.gain(fromDb(db) / r); return r; };
const kickTimes = ev.kick.filter((k) => k[1] > 0.7).map((k) => k[0]);

// ------------------------------------------------------------------------------------ kick: filter sweeps in/out
function sweep(bus, t0, t1, f0, f1) {
  const a = new SVF(), b = new SVF(), n0 = S(t0), n1 = S(t1);
  for (let i = n0; i < n1 && i < bus.n; i++) {
    const u = (i - n0) / (n1 - n0), fc = f0 * Math.pow(f1 / f0, u);
    a.tick(bus.L[i], fc, 0.75); b.tick(bus.R[i], fc, 0.75);
    bus.L[i] = a.lp; bus.R[i] = b.lp;
  }
}
done = tm('kick sweeps');
sweep(tr.kick, t(4), t(8), 110, 7000);
sweep(tr.kick, t(60), t(64), 6000, 90);
done();
tr.kick.gain(1 / tr.kick.peak() * 0.9);

// ------------------------------------------------------------------------------------ rumble: kick -> long dark reverb -> LP -> sat -> sidechain
done = tm('rumble');
{
  const rv = makeReverb({ rt60: 1.9, damp: 220, pre: 0, size: 1.7, mod: 0.6, seed: 11 });
  const oL = new Float32Array(N), oR = new Float32Array(N);
  rv.run(tr.rumble.L, tr.rumble.L, oL, oR);
  const m = new Float32Array(N);
  for (let i = 0; i < N; i++) m[i] = 0.5 * (oL[i] + oR[i]);
  filt(m, [biquad('lp', 125, 0.8), biquad('lp', 160, 0.7), biquad('hp', 32, 0.7)]);
  for (let i = 0; i < N; i++) m[i] = Math.tanh(1.7 * m[i]);
  const duck = duckCurve(N, kickTimes, { depth: 0.96, attack: 0.003, release: 0.2, curve: 1.3 });
  for (let i = 0; i < N; i++) { tr.rumble.L[i] = tr.rumble.R[i] = m[i] * duck[i]; }
}
done();

// ------------------------------------------------------------------------------------ level balance (RMS dBFS over reference windows)
const W = { drop1: [t(16), t(32)], drop2: [t(40), t(56)], stack: [t(33), t(39)], intro: [t(1), t(4)], build: [t(8), t(15)] };
setLevel(tr.rumble, ...W.drop1, -17);
setLevel(tr.acid, ...W.drop1, -16.5);
setLevel(tr.hats, ...W.drop1, -27);
setLevel(tr.clap, ...W.drop1, -23);
setLevel(tr.perc, ...W.drop2, -27);
setLevel(tr.stab, ...W.drop1, -23);
setLevel(tr.pad, ...W.stack, -24);
setLevel(tr.pluck, ...W.stack, -25);
setLevel(tr.blip, ...W.stack, -27);
setLevel(tr.atmo, ...W.intro, -22);
setLevel(tr.voice, t(18), t(20), -18.5);

// sidechain ducking of the melodic / bass parts
const duckFast = duckCurve(N, kickTimes, { depth: 0.72, attack: 0.004, release: 0.3 });
const duckMid = duckCurve(N, kickTimes, { depth: 0.5, attack: 0.004, release: 0.34 });
const duckLight = duckCurve(N, kickTimes, { depth: 0.25, attack: 0.004, release: 0.3 });
tr.acid.mul(duckFast);
tr.pad.mul(duckMid);
tr.stab.mul(duckMid);
tr.pluck.mul(duckLight);
tr.atmo.mul(duckLight);
// the robot voice: band-limit, add presence and a little grit, keep it out of the kick's way
filtBus(tr.voice, [biquad('hp', 150, 0.7), biquad('lp', 8500, 0.7), biquad('peak', 1400, 0.9, 3)]);
for (let i = 0; i < N; i++) { tr.voice.L[i] = Math.tanh(1.6 * tr.voice.L[i]) / 1.2; tr.voice.R[i] = Math.tanh(1.6 * tr.voice.R[i]) / 1.2; }
tr.voice.mul(duckLight);

// acid: a little extra grit and mono bass management
for (let i = 0; i < N; i++) { const v = Math.tanh(1.5 * tr.acid.L[i]) / 1.05; tr.acid.L[i] = tr.acid.R[i] = v; }
filtBus(tr.acid, biquad('hp', 42, 0.7));

// pad chorus for width
chorus(tr.pad, { rate: 0.27, depth: 0.004, base: 0.017, mix: 0.6 });

// ------------------------------------------------------------------------------------ sends
done = tm('reverb + delay');
const sendRev = new Float32Array(N), sendDly = new Float32Array(N);
const add = (dst, src, g) => { for (let i = 0; i < N; i++) dst[i] += g * 0.5 * (src.L[i] + src.R[i]); };
add(sendRev, tr.clap, 0.55); add(sendRev, tr.stab, 0.4); add(sendRev, tr.pluck, 0.35); add(sendRev, tr.blip, 0.3);
add(sendRev, tr.perc, 0.3); add(sendRev, tr.voice, 0.5); add(sendRev, tr.fx, 0.45); add(sendRev, tr.pad, 0.25); add(sendRev, tr.hats, 0.06); add(sendRev, tr.atmo, 0.2);
add(sendDly, tr.voice, 0.6); add(sendDly, tr.stab, 0.7); add(sendDly, tr.pluck, 0.5); add(sendDly, tr.blip, 0.55); add(sendDly, tr.clap, 0.12); add(sendDly, tr.perc, 0.12);
filt(sendRev, [biquad('hp', 230, 0.7)]);
filt(sendDly, [biquad('hp', 180, 0.7)]);
const dly = pingPong(sendDly, { time: 3 * STEP, fb: 0.58, lp: 3000, hp: 260 });
for (let i = 0; i < N; i++) sendRev[i] += 0.35 * 0.5 * (dly.L[i] + dly.R[i]); // echoes bloom into the hall (dub)
const hall = makeReverb({ rt60: 2.7, damp: 4200, pre: 0.02, size: 1.25, mod: 1, seed: 21 });
const rvL = new Float32Array(N), rvR = new Float32Array(N);
hall.run(sendRev, sendRev, rvL, rvR);
filt(rvL, [biquad('lp', 9000, 0.7)]); filt(rvR, [biquad('lp', 9000, 0.7)]);
const duckRev = duckCurve(N, kickTimes, { depth: 0.3, attack: 0.004, release: 0.3 });
for (let i = 0; i < N; i++) { rvL[i] *= duckRev[i]; rvR[i] *= duckRev[i]; }
done();

// ------------------------------------------------------------------------------------ master mix
const mix = new Bus(N);
for (const n of names) mix.add(tr[n], 1);
const g = { rev: 0.85, dly: 0.55 };
for (let i = 0; i < N; i++) {
  mix.L[i] += rvL[i] * g.rev + dly.L[i] * g.dly;
  mix.R[i] += rvR[i] * g.rev + dly.R[i] * g.dly;
}
filtBus(mix, [biquad('hp', 24, 0.7)]);
filtBus(mix, [biquad('peak', 300, 0.9, -1.5)]); // clear a little mud
compress(mix, { thresh: -14, ratio: 1.9, attack: 0.03, release: 0.14, makeup: 1 });
for (let i = 0; i < N; i++) { mix.L[i] = Math.tanh(1.15 * mix.L[i]) / 1.05; mix.R[i] = Math.tanh(1.15 * mix.R[i]) / 1.05; }
// fade the very end
{
  const f0 = S(DURATION - 1.6);
  for (let i = f0; i < N; i++) { const u = 1 - (i - f0) / (N - f0), e = u * u * (3 - 2 * u); mix.L[i] *= e; mix.R[i] *= e; }
  const fi = S(0.05); for (let i = 0; i < fi; i++) { mix.L[i] *= i / fi; mix.R[i] *= i / fi; }
}

// loudness target: -14 LUFS integrated, sample peak <= -1.5 dBFS
done = tm('master (limiter + LUFS)');
const TARGET = -14;
let cur = lufs(mix);
console.log(`  pre-master loudness ${cur.toFixed(2)} LUFS, peak ${toDb(mix.peak()).toFixed(2)} dBFS`);
let gain = fromDb(TARGET - cur);
const base = new Bus(N); base.L.set(mix.L); base.R.set(mix.R);
let final = mix;
for (let iter = 0; iter < 5; iter++) {
  final = new Bus(N); final.L.set(base.L); final.R.set(base.R); final.gain(gain);
  limit(final, { ceiling: -1.5, look: 0.004, release: 0.12 });
  const l = lufs(final);
  console.log(`  iter ${iter}: ${l.toFixed(2)} LUFS, peak ${toDb(final.peak()).toFixed(2)} dBFS`);
  if (Math.abs(l - TARGET) < 0.25) break;
  gain *= fromDb(TARGET - l);
}
done();

// ------------------------------------------------------------------------------------ report + outputs
const secLoud = SECTIONS.map((s) => {
  const a = S(t(s.bar)), b = Math.min(N, S(t(s.bar + s.bars)));
  const seg = new Bus(b - a); seg.L.set(final.L.subarray(a, b)); seg.R.set(final.R.subarray(a, b));
  return `${s.name.padEnd(6)} bars ${String(s.bar).padStart(2)}-${String(s.bar + s.bars - 1).padEnd(2)}  ${lufs(seg).toFixed(1).padStart(6)} LUFS  rms ${toDb(seg.rms()).toFixed(1)} dBFS`;
});
console.log(secLoud.map((l) => '  ' + l).join('\n'));

done = tm('analysis + files');
const an = analyse(final, { hz: 60, bands: 24 });
writeFileSync(`${outDir}/track.wav`, wav16(final));
const b64 = (u8) => Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength).toString('base64');
const cues = {
  bpm: BPM, step: STEP, bar: BAR, bars: BARS, duration: DURATION, sr: SR,
  sections: SECTIONS,
  uart: { message: MESSAGE, startStep: UART_START, frameBits: 10 },
  events: ev,
  spectrum: { hz: an.hz, bands: an.bands, frames: an.frames, edges: an.edges.map((e) => Math.round(e)), data: b64(an.data), rms: b64(an.rms) },
};
writeFileSync(`${outDir}/cues.json`, JSON.stringify(cues));

// QA image: band heat-map + rms lane + section markers
{
  const px = 4, w = Math.floor(an.frames / px), h = an.bands * 7 + 60, img = new Uint8Array(w * h * 4);
  const heat = (v) => { const x = v / 255; return [Math.round(255 * clamp(x * 2.2 - 0.3, 0, 1)), Math.round(255 * clamp(x * 2.6 - 1.1, 0, 1)), Math.round(255 * clamp(1.4 - Math.abs(x * 2.2 - 0.9), 0, 1) * 0.7)]; };
  for (let x = 0; x < w; x++) {
    for (let b = 0; b < an.bands; b++) {
      let v = 0; for (let k = 0; k < px; k++) v = Math.max(v, an.data[(x * px + k) * an.bands + b]);
      const [r, gg, bl] = heat(v);
      for (let yy = 0; yy < 7; yy++) { const o = (((an.bands - 1 - b) * 7 + yy) * w + x) * 4; img[o] = r; img[o + 1] = gg; img[o + 2] = bl; img[o + 3] = 255; }
    }
    let rv = 0; for (let k = 0; k < px; k++) rv = Math.max(rv, an.rms[x * px + k]);
    const bh = Math.round((rv / 255) * 50);
    for (let yy = 0; yy < 50; yy++) { const o = ((an.bands * 7 + 5 + (49 - yy)) * w + x) * 4; const on = yy < bh; img[o] = on ? 255 : 20; img[o + 1] = on ? 200 : 20; img[o + 2] = on ? 30 : 30; img[o + 3] = 255; }
  }
  for (const s of SECTIONS) { const x = Math.round((t(s.bar) * 60) / px); if (x < w) for (let y = 0; y < h; y++) { const o = (y * w + x) * 4; img[o] = 255; img[o + 1] = 255; img[o + 2] = 255; img[o + 3] = 255; } }
  writePNG(`${outDir}/spectrogram.png`, w, h, img);
}
done();
console.log(`wrote ${outDir}/track.wav (${(DURATION).toFixed(2)} s), cues.json, spectrogram.png`);
