// Renders the gothic track: composes every part, mixes, masters to ~-14 LUFS and writes <outDir>/track.wav + cues.json.
// usage: node src/audio/render-audio-gothic.mjs [outDir=build/gothic]
import { mkdirSync, writeFileSync } from 'node:fs';
import { Bus, SR, SVF, biquad, filt, filtBus, makeReverb, pingPong, chorus, duckCurve, compress, limit, lufs, analyse, wav16, fromDb, toDb, clamp } from './dsp.mjs';
import { compose, DURATION, STEP, BAR, BPM, BARS, SECTIONS, t } from './song-gothic.mjs';
import { writePNG } from '../../tools/png.mjs';

const outDir = process.argv[2] || 'build/gothic';
mkdirSync(outDir, { recursive: true });
const tm = (label) => { const t0 = Date.now(); return () => console.log(`  ${label}: ${((Date.now() - t0) / 1000).toFixed(1)}s`); };

const N = Math.ceil(DURATION * SR);
const names = ['kick', 'rumble', 'bass', 'snr', 'chain', 'perc', 'organ', 'stab', 'lead', 'ring', 'toll', 'cel', 'heart', 'atmo', 'fx'];
const tr = Object.fromEntries(names.map((n) => [n, new Bus(N)]));

let done = tm('compose + synthesis');
const { ev } = compose(tr);
done();

const S = (sec) => Math.round(sec * SR);
const setLevel = (bus, t0, t1, db) => { const r = bus.rms(S(t0), S(t1)); if (r > 0) bus.gain(fromDb(db) / r); return r; };
const kickTimes = ev.kick.filter((k) => k[1] > 0.7).map((k) => k[0]);
const mono = (bus) => { const m = new Float32Array(N); for (let i = 0; i < N; i++) m[i] = 0.5 * (bus.L[i] + bus.R[i]); return m; };

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
  const rv = makeReverb({ rt60: 2.1, damp: 200, pre: 0, size: 1.8, mod: 0.6, seed: 12 });
  const oL = new Float32Array(N), oR = new Float32Array(N);
  rv.run(tr.rumble.L, tr.rumble.L, oL, oR);
  const m = new Float32Array(N);
  for (let i = 0; i < N; i++) m[i] = 0.5 * (oL[i] + oR[i]);
  filt(m, [biquad('lp', 120, 0.8), biquad('lp', 150, 0.7), biquad('hp', 30, 0.7)]);
  for (let i = 0; i < N; i++) m[i] = Math.tanh(1.7 * m[i]);
  const duck = duckCurve(N, kickTimes, { depth: 0.96, attack: 0.003, release: 0.2, curve: 1.3 });
  for (let i = 0; i < N; i++) { tr.rumble.L[i] = tr.rumble.R[i] = m[i] * duck[i]; }
}
done();

// ------------------------------------------------------------------------------------ the gated-reverb snare (dry hit + big room, then a hard gate)
done = tm('gated snare');
{
  const room = makeReverb({ rt60: 1.8, damp: 6500, pre: 0.004, size: 0.95, mod: 0.5, seed: 41 });
  const m = mono(tr.snr), wL = new Float32Array(N), wR = new Float32Array(N);
  room.run(m, m, wL, wR);
  const gate = new Float32Array(N), hold = S(0.2), fade = S(0.045);
  for (const e of ev.snare.filter((x) => x[2] === 1)) {
    const n0 = S(e[0]) - S(0.002);
    for (let k = 0; k < hold + fade && n0 + k < N; k++) { const g = k < hold ? 1 : 1 - (k - hold) / fade; if (n0 + k >= 0 && g > gate[n0 + k]) gate[n0 + k] = g; }
  }
  for (let i = 0; i < N; i++) { tr.snr.L[i] = (tr.snr.L[i] + 1.5 * wL[i]) * gate[i]; tr.snr.R[i] = (tr.snr.R[i] + 1.5 * wR[i]) * gate[i]; }
}
done();

// ------------------------------------------------------------------------------------ level balance (RMS dBFS over reference windows)
const W = { d1: [t(16), t(32)], d2: [t(40), t(56)], req: [t(33), t(39)], intro: [t(0), t(4)], vig: [t(8), t(15)], lead: [t(40), t(44)], hearts: [t(32), t(40)] };
setLevel(tr.rumble, ...W.d1, -17);
setLevel(tr.bass, ...W.d1, -17.5);
setLevel(tr.chain, ...W.d1, -24.5);
setLevel(tr.snr, ...W.d1, -20);
setLevel(tr.perc, ...W.d2, -27);
setLevel(tr.organ, ...W.req, -22);
setLevel(tr.stab, ...W.d1, -23);
setLevel(tr.lead, ...W.lead, -21);
setLevel(tr.ring, ...W.d1, -23.5);
setLevel(tr.toll, t(0), t(8), -25);
setLevel(tr.cel, ...W.intro, -27);
setLevel(tr.heart, ...W.hearts, -24);
setLevel(tr.atmo, ...W.intro, -22);

// sidechain ducking of the tonal parts
const duckFast = duckCurve(N, kickTimes, { depth: 0.72, attack: 0.004, release: 0.3 });
const duckMid = duckCurve(N, kickTimes, { depth: 0.5, attack: 0.004, release: 0.34 });
const duckLight = duckCurve(N, kickTimes, { depth: 0.25, attack: 0.004, release: 0.3 });
tr.bass.mul(duckFast);
tr.organ.mul(duckMid);
tr.stab.mul(duckMid);
tr.lead.mul(duckLight);
tr.ring.mul(duckLight);
tr.cel.mul(duckLight);
tr.toll.mul(duckLight);
tr.atmo.mul(duckLight);

// bass: a little grit, mono below the mids
for (let i = 0; i < N; i++) { const v = Math.tanh(1.4 * tr.bass.L[i]) / 1.05; tr.bass.L[i] = tr.bass.R[i] = v; }
filtBus(tr.bass, biquad('hp', 42, 0.7));
// keep the organ and the bells out of the sub region
filtBus(tr.organ, biquad('hp', 62, 0.7));
filtBus(tr.stab, biquad('hp', 110, 0.7));
filtBus(tr.ring, biquad('hp', 130, 0.7));
filtBus(tr.lead, biquad('hp', 150, 0.7));
chorus(tr.organ, { rate: 0.23, depth: 0.0035, base: 0.016, mix: 0.4 });

// ------------------------------------------------------------------------------------ sends: cathedral, hall, dotted-eighth echo
done = tm('reverb + delay');
const sendCath = new Float32Array(N), sendHall = new Float32Array(N), sendDly = new Float32Array(N);
const add = (dst, src, g) => { for (let i = 0; i < N; i++) dst[i] += g * 0.5 * (src.L[i] + src.R[i]); };
add(sendCath, tr.organ, 0.5); add(sendCath, tr.stab, 0.5); add(sendCath, tr.lead, 0.5); add(sendCath, tr.ring, 0.5); add(sendCath, tr.toll, 0.55);
add(sendCath, tr.cel, 0.6); add(sendCath, tr.atmo, 0.25); add(sendCath, tr.perc, 0.3); add(sendCath, tr.fx, 0.5); add(sendCath, tr.chain, 0.04); add(sendCath, tr.heart, 0.08);
add(sendHall, tr.perc, 0.2); add(sendHall, tr.chain, 0.1); add(sendHall, tr.lead, 0.2); add(sendHall, tr.organ, 0.15);
add(sendDly, tr.stab, 0.7); add(sendDly, tr.cel, 0.6); add(sendDly, tr.lead, 0.5); add(sendDly, tr.ring, 0.3); add(sendDly, tr.perc, 0.1);
filt(sendCath, [biquad('hp', 200, 0.7)]);
filt(sendHall, [biquad('hp', 220, 0.7)]);
filt(sendDly, [biquad('hp', 180, 0.7)]);
const dly = pingPong(sendDly, { time: 3 * STEP, fb: 0.55, lp: 3200, hp: 260 });
for (let i = 0; i < N; i++) sendCath[i] += 0.3 * 0.5 * (dly.L[i] + dly.R[i]); // the echoes bloom into the nave
const cath = makeReverb({ rt60: 6.5, damp: 3300, pre: 0.035, size: 2.3, mod: 1.3, seed: 31 });
const hall = makeReverb({ rt60: 3.2, damp: 4800, pre: 0.02, size: 1.3, mod: 1, seed: 21 });
const cL = new Float32Array(N), cR = new Float32Array(N), hL = new Float32Array(N), hR = new Float32Array(N);
cath.run(sendCath, sendCath, cL, cR);
hall.run(sendHall, sendHall, hL, hR);
const duckRev = duckCurve(N, kickTimes, { depth: 0.25, attack: 0.004, release: 0.3 });
const rvL = new Float32Array(N), rvR = new Float32Array(N);
for (let i = 0; i < N; i++) { rvL[i] = (cL[i] * 0.95 + hL[i] * 0.6) * duckRev[i]; rvR[i] = (cR[i] * 0.95 + hR[i] * 0.6) * duckRev[i]; }
filt(rvL, [biquad('lp', 9000, 0.7)]); filt(rvR, [biquad('lp', 9000, 0.7)]);
done();

// ------------------------------------------------------------------------------------ master mix
const mix = new Bus(N);
for (const n of names) mix.add(tr[n], 1);
const g = { dly: 0.5 };
for (let i = 0; i < N; i++) { mix.L[i] += rvL[i] + dly.L[i] * g.dly; mix.R[i] += rvR[i] + dly.R[i] * g.dly; }
filtBus(mix, [biquad('hp', 24, 0.7)]);
filtBus(mix, [biquad('peak', 300, 0.9, -1.5)]); // clear a little mud
compress(mix, { thresh: -14, ratio: 1.9, attack: 0.03, release: 0.14, makeup: 1 });
for (let i = 0; i < N; i++) { mix.L[i] = Math.tanh(1.15 * mix.L[i]) / 1.05; mix.R[i] = Math.tanh(1.15 * mix.R[i]) / 1.05; }
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
  return `${s.name.padEnd(9)} bars ${String(s.bar).padStart(2)}-${String(s.bar + s.bars - 1).padEnd(2)}  ${lufs(seg).toFixed(1).padStart(6)} LUFS  rms ${toDb(seg.rms()).toFixed(1)} dBFS`;
});
console.log(secLoud.map((l) => '  ' + l).join('\n'));

done = tm('analysis + files');
const an = analyse(final, { hz: 60, bands: 24 });
writeFileSync(`${outDir}/track.wav`, wav16(final));
const b64 = (u8) => Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength).toString('base64');
const cues = {
  bpm: BPM, step: STEP, bar: BAR, bars: BARS, duration: DURATION, sr: SR,
  sections: SECTIONS,
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
console.log(`wrote ${outDir}/track.wav (${DURATION.toFixed(2)} s), cues.json, spectrogram.png`);
