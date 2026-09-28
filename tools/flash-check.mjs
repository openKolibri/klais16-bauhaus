// Photosensitivity sanity check on the finished video (WCAG 2.3.1 "three flashes" style, simplified).
// Decodes the mp4 at low resolution, computes relative luminance for the whole frame and its four quadrants
// (a flash must cover ~25% of the screen to matter), and counts pairs of opposing luminance swings >= 10%
// in every sliding one-second window. Prints the worst window. Not a certification - a guard rail.
//   node tools/flash-check.mjs dist/klais16-bauhaus.mp4
import { spawn } from 'node:child_process';

const file = process.argv[2] || 'dist/klais16-bauhaus.mp4';
const FPS = Number(process.argv[3] || 30), W = 192, H = 108, FR = W * H * 3;
const ff = spawn(process.env.FFMPEG || 'ffmpeg', ['-v', 'error', '-i', file, '-vf', `scale=${W}:${H}:flags=area,format=rgb24`, '-f', 'rawvideo', '-'], { stdio: ['ignore', 'pipe', 'inherit'] });
const lin = new Float32Array(256).map((_, i) => { const c = i / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
const regions = [[0, 0, W, H], [0, 0, W / 2, H / 2], [W / 2, 0, W, H / 2], [0, H / 2, W / 2, H], [W / 2, H / 2, W, H]]; // whole + quadrants
const series = regions.map(() => []);
let buf = Buffer.alloc(0);
ff.stdout.on('data', (d) => {
  buf = Buffer.concat([buf, d]);
  while (buf.length >= FR) {
    const f = buf.subarray(0, FR); buf = buf.subarray(FR);
    regions.forEach(([x0, y0, x1, y1], k) => {
      let s = 0, n = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const o = (y * W + x) * 3; s += 0.2126 * lin[f[o]] + 0.7152 * lin[f[o + 1]] + 0.0722 * lin[f[o + 2]]; n++; }
      series[k].push(s / n);
    });
  }
});
ff.on('close', () => {
  const N = series[0].length;
  let worst = { flashes: 0, t: 0, region: 0 };
  const names = ['whole', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];
  series.forEach((Y, k) => {
    // opposing swings: track running extremum; a swing >= 0.1 (and darker side < 0.8) completes a transition
    const swings = [];
    let dir = 0, ext = Y[0], extI = 0;
    for (let i = 1; i < N; i++) {
      const d = Y[i] - ext;
      if (dir >= 0 && Y[i] > ext) { ext = Y[i]; extI = i; dir = 1; }
      else if (dir <= 0 && Y[i] < ext) { ext = Y[i]; extI = i; dir = -1; }
      else if (Math.abs(d) >= 0.1) { swings.push({ i: extI, up: dir === 1 }); dir = -dir; ext = Y[i]; extI = i; }
    }
    for (let i = 0; i + FPS <= N; i += 3) {
      const inWin = swings.filter((s) => s.i >= i && s.i < i + FPS);
      const flashes = Math.floor(inWin.length / 2);
      if (flashes > worst.flashes) worst = { flashes, t: i / FPS, region: k };
    }
    const big = swings.length;
    console.log(`  ${names[k].padEnd(12)} swings>=10%: ${String(big).padStart(3)}   luminance min/max: ${Math.min(...Y).toFixed(3)} / ${Math.max(...Y).toFixed(3)}`);
  });
  console.log(`${N} frames analysed. Worst 1-second window: ${worst.flashes} flash(es) (${names[worst.region]}, at ${worst.t.toFixed(1)} s). General-flash threshold is 3 per second.`);
  process.exitCode = worst.flashes > 3 ? 1 : 0;
});
