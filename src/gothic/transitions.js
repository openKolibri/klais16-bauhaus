// Wipes between scenes, drawn over the scene around a bar boundary; fully covering at p = 0.5 (the scene swaps there).
// All black, edged in red: a portcullis, a pointed-arch iris and closing curtains. Big impacts (bars 16, 40, 56) are hard cuts.
import { TAU, clamp, ease, sstep } from '../render/util.js';
import { L, La } from './tone.js';
import { archPath } from './ornament.js';

const styles = {
  // iron bars drop from the top, staggered, then lift again; each ends in a glowing point
  portcullis(C, p) {
    const { ctx, glow, W, H } = C, n = 26, w = W / n;
    for (let i = 0; i < n; i++) {
      const d = ((i * 7) % n) / n * 0.28, a = ease.out3(clamp((p - d) / 0.5)), b = ease.in3(clamp((p - 0.5 - d) / 0.5));
      const y0 = -H + b * H * 1.1, y1 = -H + a * (H + 40) ;
      if (y1 <= y0) continue;
      ctx.fillStyle = '#000'; ctx.fillRect(Math.floor(i * w), y0, Math.ceil(w) + 1, y1 - y0 + 1);
      ctx.fillStyle = L(0.55); ctx.fillRect(Math.floor(i * w) + w * 0.45, y0, 2, y1 - y0);
      ctx.beginPath(); ctx.moveTo(i * w + w * 0.2, y1); ctx.lineTo(i * w + w * 0.5, y1 + 34); ctx.lineTo(i * w + w * 0.8, y1); ctx.closePath(); ctx.fillStyle = L(0.7); ctx.fill();
      glow.fillStyle = L(0.9); glow.fillRect(Math.floor(i * w) + w * 0.4, y1 - 4, w * 0.2, 16);
    }
  },
  // a pointed-arch hole shrinks to nothing, then opens again
  iris(C, p) {
    const { ctx, glow, W, H } = C, cx = W / 2, baseY = H * 0.62;
    const k = p < 0.5 ? 1 - ease.io3(p * 2) : ease.io3((p - 0.5) * 2);
    ctx.save();
    const path = new Path2D(); path.rect(-10, -10, W + 20, H + 20);
    if (k > 0.004) path.addPath(archPath(cx, baseY + k * H * 0.4, k * W * 1.25, k * H * 1.7, k * W * 1.1));
    ctx.fillStyle = '#000'; ctx.fill(path, 'evenodd');
    if (k > 0.01) { const a = archPath(cx, baseY + k * H * 0.4, k * W * 1.25, k * H * 1.7, k * W * 1.1); ctx.strokeStyle = L(0.8); ctx.lineWidth = 3; ctx.stroke(a); glow.strokeStyle = L(0.9); glow.lineWidth = 8; glow.stroke(a); }
    ctx.restore();
  },
  // two curtains close from the sides with a pointed edge, hold, then part
  curtain(C, p) {
    const { ctx, glow, W, H } = C;
    const k = p < 0.5 ? ease.io3(p * 2) : 1 - ease.io3((p - 0.5) * 2), half = (W / 2 + 60) * k;
    if (k < 0.004) return;
    for (const side of [-1, 1]) {
      const edge = W / 2 + side * (W / 2 - half), tip = side * -110 * Math.sin(Math.PI * k) * 0;
      ctx.beginPath();
      const x0 = side < 0 ? -10 : W + 10;
      ctx.moveTo(x0, -10); ctx.lineTo(edge, -10);
      for (let y = 0; y <= H; y += 60) { const d = Math.abs(y - H / 2) / (H / 2); ctx.lineTo(edge + side * (1 - d) * 70 * Math.min(1, k * 3) * -1, y); }
      ctx.lineTo(edge, H + 10); ctx.lineTo(x0, H + 10); ctx.closePath();
      ctx.fillStyle = '#000'; ctx.fill();
      ctx.strokeStyle = L(0.7); ctx.lineWidth = 3; ctx.stroke();
      glow.strokeStyle = L(0.8); glow.lineWidth = 7; glow.beginPath();
      for (let y = 0; y <= H; y += 60) { const d = Math.abs(y - H / 2) / (H / 2), x = edge + side * (1 - d) * 70 * Math.min(1, k * 3) * -1; y ? glow.lineTo(x, y) : glow.moveTo(x, y); }
      glow.stroke();
    }
  },
};

// boundary bar -> style. Hard cuts (with a shock ring) at 16, 40 and 56.
export const TRANSITIONS = [
  { bar: 8, style: 'curtain' },
  { bar: 12, style: 'portcullis' },
  { bar: 24, style: 'iris' },
  { bar: 28, style: 'portcullis' },
  { bar: 36, style: 'curtain' },
  { bar: 44, style: 'iris' },
  { bar: 48, style: 'portcullis' },
];

/** half-width of every wipe, in bars */
const HALF = 0.1;
export function drawTransition(C) {
  for (const t of TRANSITIONS) {
    const p = (C.bar - (t.bar - HALF)) / (2 * HALF);
    if (p > 0 && p < 1) {
      styles[t.style](C, p);
      C.fx.bloomMul = 1 - sstep(0.1, 0.42, Math.sin(Math.PI * p)); // the scene's glow must not bleed through the wipe
      return;
    }
  }
}
void TAU; void La;
