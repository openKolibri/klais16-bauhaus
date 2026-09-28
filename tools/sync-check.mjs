// Measures picture-vs-music timing in the finished mp4: during the first drop's wall (bars 16-20) the frame's brightness and
// zoom pulse with every kick, so the cross-correlation between the video's per-frame luminance and the kick envelope from the
// cue sheet should peak at a small lag. The renderer deliberately leads the audio by one frame (see src/render/main.js).
//   node tools/sync-check.mjs dist/klais16-bauhaus.mp4
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const file = process.argv[2] || 'dist/klais16-bauhaus.mp4', FPS = 30, W = 96, H = 54, FR = W * H;
const cues = JSON.parse(readFileSync('build/cues.json', 'utf8'));
const kicks = cues.events.kick.map((k) => k[0]);
const t0 = 16.2 * cues.bar, t1 = 19.8 * cues.bar;                      // inside the wall scene, away from its cascade-in
const ff = spawn(process.env.FFMPEG || 'ffmpeg', ['-v', 'error', '-ss', String(t0), '-t', String(t1 - t0), '-i', file, '-vf', `scale=${W}:${H}:flags=area,format=gray`, '-f', 'rawvideo', '-'], { stdio: ['ignore', 'pipe', 'inherit'] });
let buf = Buffer.alloc(0); const Y = [];
ff.stdout.on('data', (d) => { buf = Buffer.concat([buf, d]); while (buf.length >= FR) { let s = 0; for (let i = 0; i < FR; i++) s += buf[i]; Y.push(s / FR); buf = buf.subarray(FR); } });
ff.on('close', () => {
  const env = (T) => { let a = Infinity; for (const k of kicks) if (k <= T) a = T - k; else break; return Math.exp(-a / 0.16); };
  const N = Y.length, mean = Y.reduce((a, b) => a + b, 0) / N;
  const Yd = Y.map((v) => v - mean);
  // remove the slow trend (moving average over 0.5 s) so only the pulses remain
  const hp = Yd.map((v, i) => { let s = 0, n = 0; for (let k = Math.max(0, i - 8); k <= Math.min(N - 1, i + 8); k++) { s += Yd[k]; n++; } return v - s / n; });
  let best = { lag: 0, r: -2 };
  const res = [];
  for (let lag = -6; lag <= 6; lag++) {
    // visual frame i shows cue time (i + lag) / FPS relative to its own timestamp
    const K = hp.map((_, i) => env(t0 + (i + lag) / FPS));
    const km = K.reduce((a, b) => a + b, 0) / N;
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < N; i++) { const a = hp[i], b = K[i] - km; sxy += a * b; sxx += a * a; syy += b * b; }
    const r = sxy / Math.sqrt(sxx * syy + 1e-12);
    res.push([lag, r]); if (r > best.r) best = { lag, r };
  }
  console.log('lag (frames) : correlation of frame luminance with the kick envelope');
  for (const [lag, r] of res) console.log(`  ${String(lag).padStart(3)}  ${r.toFixed(3)} ${'#'.repeat(Math.max(0, Math.round(r * 40)))}`);
  console.log(`best lag ${best.lag} frames (${((best.lag / FPS) * 1000).toFixed(0)} ms), r = ${best.r.toFixed(3)}. Expected: about +1 (the renderer looks one frame ahead of the audio clock).`);
});
