// Verifies that a finished video really is red and black: decodes every 10th frame at 480x270 and checks each pixel that is
// not (nearly) black. A pixel passes when it is a red: R >= G, R >= B (small tolerance for codec rounding) and its hue is within
// -20..+15 degrees of pure red (the finished file went through H.264 chroma subsampling, which tints very dark reds a little). Prints the worst frame and the share of failing pixels overall.
//   node tools/red-check.mjs [--edition gothic] [file.mp4]
import { spawn } from 'node:child_process';
import { edition } from './editions.mjs';

const ed = edition();
const file = ed.args[0] || ed.out, W = 480, H = 270, FR = W * H * 3, EVERY = 10, FPS = 30;
const ff = spawn(process.env.FFMPEG || 'ffmpeg', ['-v', 'error', '-i', file, '-vf', `select='not(mod(n\\,${EVERY}))',scale=${W}:${H}:flags=area,format=rgb24`, '-vsync', '0', '-f', 'rawvideo', '-'], { stdio: ['ignore', 'pipe', 'inherit'] });
let buf = Buffer.alloc(0), frame = 0, lit = 0, bad = 0, worst = { share: 0, t: 0 }, hueMin = 999, hueMax = -999, maxG = 0, maxB = 0;
ff.stdout.on('data', (d) => {
  buf = Buffer.concat([buf, d]);
  while (buf.length >= FR) {
    const f = buf.subarray(0, FR); buf = buf.subarray(FR);
    let l = 0, b = 0;
    for (let i = 0; i < FR; i += 3) {
      const r = f[i], g = f[i + 1], bl = f[i + 2];
      if (r < 32) continue;                             // black, or too dark for the codec's chroma to say anything
      l++;
      const mx = Math.max(r, g, bl), mn = Math.min(r, g, bl);
      let hue = 0;
      if (mx > mn) { hue = mx === r ? (60 * (g - bl)) / (mx - mn) : mx === g ? 120 + (60 * (bl - r)) / (mx - mn) : 240 + (60 * (r - g)) / (mx - mn); if (hue > 180) hue -= 360; }
      hueMin = Math.min(hueMin, hue); hueMax = Math.max(hueMax, hue); maxG = Math.max(maxG, g / r); maxB = Math.max(maxB, bl / r);
      if (g > r + 8 || bl > r + 8 || hue < -20 || hue > 15) b++;
    }
    lit += l; bad += b;
    const share = l ? b / l : 0;
    if (share > worst.share) worst = { share, t: (frame * EVERY) / FPS };
    frame++;
  }
});
ff.on('close', () => {
  console.log(`${frame} frames sampled, ${lit} non-black pixels checked`);
  console.log(`hue range ${hueMin.toFixed(1)} .. ${hueMax.toFixed(1)} degrees, max G/R ${maxG.toFixed(2)}, max B/R ${maxB.toFixed(2)}`);
  console.log(`pixels outside the red band: ${bad} (${((100 * bad) / Math.max(1, lit)).toFixed(4)} %), worst frame ${(100 * worst.share).toFixed(3)} % at ${worst.t.toFixed(1)} s`);
  process.exitCode = bad / Math.max(1, lit) > 0.002 ? 1 : 0;
});
