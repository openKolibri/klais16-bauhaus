// Objective sanity checks for build/track.wav + build/cues.json
import { readFileSync } from 'node:fs';
const dir = process.argv[2] || 'build';
const wav = readFileSync(`${dir}/track.wav`);
const n = (wav.length - 44) / 4, L = new Float32Array(n), R = new Float32Array(n);
for (let i = 0; i < n; i++) { L[i] = wav.readInt16LE(44 + i * 4) / 32768; R[i] = wav.readInt16LE(46 + i * 4) / 32768; }
const cues = JSON.parse(readFileSync(`${dir}/cues.json`, 'utf8'));
const db = (x) => 20 * Math.log10(Math.max(1e-9, x));
let pk = 0, dcL = 0, dcR = 0, sLR = 0, sLL = 0, sRR = 0, clip = 0, nan = 0;
for (let i = 0; i < n; i++) { pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i])); dcL += L[i]; dcR += R[i]; sLR += L[i] * R[i]; sLL += L[i] * L[i]; sRR += R[i] * R[i]; if (Math.abs(L[i]) > 0.999 || Math.abs(R[i]) > 0.999) clip++; if (!Number.isFinite(L[i])) nan++; }
console.log(`samples ${n} (${(n / cues.sr).toFixed(2)} s)  peak ${db(pk).toFixed(2)} dBFS  clipped ${clip}  nan ${nan}`);
console.log(`DC  L ${(dcL / n).toExponential(1)}  R ${(dcR / n).toExponential(1)}   L/R correlation ${(sLR / Math.sqrt(sLL * sRR)).toFixed(3)}`);
const sp = cues.spectrum, data = Buffer.from(sp.data, 'base64');
const labels = [[0, 4, 'sub   <70Hz'], [4, 8, 'bass 70-200'], [8, 12, 'lo-mid 200-600'], [12, 16, 'mid  .6-2k'], [16, 20, 'hi-mid 2-6k'], [20, 24, 'air  6-16k']];
console.log('\nmean band level per section (dB rel. full-scale sine; peak-picked bins)');
console.log('section'.padEnd(8) + labels.map((l) => l[2].padStart(16)).join(''));
for (const s of cues.sections) {
  const f0 = Math.floor(s.bar * cues.bar * sp.hz), f1 = Math.min(sp.frames, Math.floor((s.bar + s.bars) * cues.bar * sp.hz));
  let row = s.name.padEnd(8);
  for (const [a, b] of labels) {
    let acc = 0, c = 0;
    for (let f = f0; f < f1; f++) for (let k = a; k < b; k++) { acc += data[f * sp.bands + k]; c++; }
    row += (((acc / c) / 255) * 78 - 78).toFixed(1).padStart(16);
  }
  console.log(row);
}
// beat-lock check: energy of the lowest band at kick times vs between
const t0 = 16 * cues.bar, t1 = 24 * cues.bar; let on = 0, off = 0, c = 0;
for (let tt = t0; tt < t1; tt += cues.step * 4) {
  const f = Math.round(tt * sp.hz), fo = Math.round((tt + cues.step * 2) * sp.hz);
  on += data[(f + 2) * sp.bands + 1]; off += data[fo * sp.bands + 1]; c++;
}
console.log(`\nkick pump (band 1): on-beat ${(on / c).toFixed(0)}/255 vs off-beat ${(off / c).toFixed(0)}/255`);
console.log('event counts:', Object.entries(cues.events).map(([k, v]) => `${k}:${v.length}`).join(' '));
