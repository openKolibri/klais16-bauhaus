// Photosensitivity sanity check on the finished video (WCAG 2.3.1 "three flashes", simplified).
// Decodes the mp4 at low resolution and, for the whole frame and its four quadrants (a flash must cover ~25% of the screen to
// matter), tracks two signals:
//   * relative luminance          - "general flash": pairs of opposing swings >= 10% of the maximum luminance
//   * (R - G - B) x 320           - "red flash": pairs of opposing swings > 20 (values 0..1) - the rule for saturated red, which
//                                   is what the all-red gothic edition is made of (its luminance never moves 10%, its red does)
// and prints the worst one-second window for each. Not a certification - a guard rail.
//   node tools/flash-check.mjs [--edition gothic] [file.mp4] [fps]
import { spawn } from 'node:child_process';
import { edition } from './editions.mjs';

const ed = edition();
const file = ed.args[0] || ed.out;
const FPS = Number(ed.args[1] || 30), W = 192, H = 108, FR = W * H * 3;
const ff = spawn(process.env.FFMPEG || 'ffmpeg', ['-v', 'error', '-i', file, '-vf', `scale=${W}:${H}:flags=area,format=rgb24`, '-f', 'rawvideo', '-'], { stdio: ['ignore', 'pipe', 'inherit'] });
const lin = new Float32Array(256).map((_, i) => { const c = i / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
const regions = [[0, 0, W, H], [0, 0, W / 2, H / 2], [W / 2, 0, W, H / 2], [0, H / 2, W / 2, H], [W / 2, H / 2, W, H]]; // whole + quadrants
const names = ['whole', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];
const lumS = regions.map(() => []), redS = regions.map(() => []);
let buf = Buffer.alloc(0);
ff.stdout.on('data', (d) => {
  buf = Buffer.concat([buf, d]);
  while (buf.length >= FR) {
    const f = buf.subarray(0, FR); buf = buf.subarray(FR);
    regions.forEach(([x0, y0, x1, y1], k) => {
      let s = 0, r = 0, n = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const o = (y * W + x) * 3;
        s += 0.2126 * lin[f[o]] + 0.7152 * lin[f[o + 1]] + 0.0722 * lin[f[o + 2]];
        r += (f[o] - f[o + 1] - f[o + 2]) / 255;
        n++;
      }
      lumS[k].push(s / n); redS[k].push(Math.max(0, (r / n) * 320));
    });
  }
});

/** opposing swings of at least `thr` in a series: returns the frame index of each swing's extremum */
function swings(Y, thr) {
  const out = [];
  let dir = 0, ext = Y[0], extI = 0;
  for (let i = 1; i < Y.length; i++) {
    const d = Y[i] - ext;
    if (dir >= 0 && Y[i] > ext) { ext = Y[i]; extI = i; dir = 1; }
    else if (dir <= 0 && Y[i] < ext) { ext = Y[i]; extI = i; dir = -1; }
    else if (Math.abs(d) >= thr) { out.push({ i: extI, up: dir === 1 }); dir = -dir; ext = Y[i]; extI = i; }
  }
  return out;
}
function worst(series, thr, N) {
  let w = { flashes: 0, t: 0, region: 0 };
  series.forEach((Y, k) => {
    const sw = swings(Y, thr);
    for (let i = 0; i + FPS <= N; i += 3) {
      const inWin = sw.filter((s) => s.i >= i && s.i < i + FPS), flashes = Math.floor(inWin.length / 2);
      if (flashes > w.flashes) w = { flashes, t: i / FPS, region: k };
    }
  });
  return w;
}

ff.on('close', () => {
  const N = lumS[0].length;
  // general flash: 10% of the maximum relative luminance (1.0), only counted when the darker side is below 0.8
  const wl = worst(lumS, 0.1, N), wr = worst(redS, 20, N);
  regions.forEach((_, k) => {
    const L = lumS[k], R = redS[k];
    console.log(`  ${names[k].padEnd(12)} luminance ${Math.min(...L).toFixed(3)}..${Math.max(...L).toFixed(3)}   red (R-G-B)x320 ${Math.min(...R).toFixed(1)}..${Math.max(...R).toFixed(1)}   swings>=20: ${swings(R, 20).length}`);
  });
  console.log(`${N} frames analysed.`);
  console.log(`general flash  : worst 1-second window has ${wl.flashes} flash(es) (${names[wl.region]}, ${wl.t.toFixed(1)} s); limit 3 per second.`);
  console.log(`red flash      : worst 1-second window has ${wr.flashes} flash(es) (${names[wr.region]}, ${wr.t.toFixed(1)} s); limit 3 per second.`);
  process.exitCode = wl.flashes > 3 || wr.flashes > 3 ? 1 : 0;
});
