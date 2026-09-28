// TABLE (drop 2): the complete printable ASCII set, 0x20..0x7F, as 16 columns x 6 rows - the classic chart layout -
// and every cell is exactly one 2:3 Klais-16 panel (120 x 180 px). Ripples race across it on every kick.
import { P, LED, TAU, clamp, E, rgba, mix, hash, hash2, sstep, ease, frac } from '../util.js';
import { camera } from './wall.js';

export function table({ hop = 1, sparkle = 0.05 } = {}) {
  return function draw(C) {
    const { ctx, glow, G, W, H, f, cues, Tc, STEP } = C;
    const cols = 16, rows = 6, cw = W / cols, ch = H / rows, s = cw / G.W;
    const kI = f.kickN, stepI = Math.floor(C.step);
    // ripple origin hops on every kick; radius grows with the kick's age
    const o = (i) => [hash2(i, 3) * cols, hash2(i, 9) * rows];
    const [ox, oy] = o(Math.floor(kI / hop)), age = Tc - (cues.last('kick', Tc)?.[0] ?? 0);
    const radius = age * 30;
    const [px, py] = o(Math.floor(kI / hop) - 1), pr = (age + cues.BEAT * hop) * 30;
    const lv = new Float32Array(17);
    camera(C, () => {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * cw, y = r * ch, cx = x + cw / 2, cy = y + ch / 2;
          const code = 32 + r * 16 + c;
          const d1 = Math.hypot((c + 0.5 - ox) * 1.0, (r + 0.5 - oy) * 1.35), d2 = Math.hypot((c + 0.5 - px), (r + 0.5 - py) * 1.35);
          const w1 = Math.exp(-Math.pow((d1 - radius) / 1.9, 2)), w2 = 0.6 * Math.exp(-Math.pow((d2 - pr) / 1.9, 2));
          const w = Math.min(1.3, w1 + w2);
          const spark = hash2(stepI, code) < sparkle ? 1 : 0;
          const band = LED[((Math.floor(d1 * 0.7) + Math.floor(C.beat)) % 5 + 5) % 5];
          const tint = LED[(r + Math.floor(C.beat / 2)) % 5];
          ctx.fillStyle = mix(P.INK, tint, 0.13 + 0.3 * w); ctx.fillRect(x, y, cw + 1, ch + 1);
          G.lv(G.mask(code), lv);
          const base = 0.34 + 0.12 * f.rms;
          for (let i = 0; i < 17; i++) lv[i] *= clamp(base + 0.95 * w + spark);
          const color = spark ? P.WHT : w > 0.35 ? band : mix(P.WHT, band, 0.4);
          G.draw(ctx, glow, { x: cx, y: cy, s, lv, color, off: 'rgba(0,0,0,0.42)', edge: null, hot: 0.3, glowK: 0.9 });
        }
      }
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      for (let c = 1; c < cols; c++) ctx.fillRect(c * cw - 1, 0, 2, H);
      for (let r = 1; r < rows; r++) ctx.fillRect(0, r * ch - 1, W, 2);
    }, { z: 1 + 0.012 * f.kick });
    C.fx.bloom = 0.95;
  };
}
