// Bauhaus wipes drawn over the scene around a boundary. Fully covering at p = 0.5 (the scene swaps there).
import { P, clamp, ease, sstep } from './util.js';

const COLS = [P.RED, P.YEL, P.BLU, P.WHT, P.INK];

const styles = {
  // horizontal slabs slide in alternately from left/right, then leave the way they came
  slabs(C, p, cols = COLS) {
    const { ctx, W, H } = C, n = cols.length, h = H / n;
    for (let i = 0; i < n; i++) {
      const fromLeft = i % 2 === 0, a = ease.io3(clamp((p - i * 0.045) / 0.5)), b = ease.io3(clamp((p - 0.5 - i * 0.045) / 0.5));
      ctx.fillStyle = cols[i];
      const x0 = fromLeft ? b * W : W - a * W, x1 = fromLeft ? a * W : W - b * W;
      if (x1 > x0) ctx.fillRect(Math.floor(x0), Math.floor(i * h), Math.ceil(x1 - x0) + 1, Math.ceil(h) + 1);
    }
  },
  // vertical bars grow from the bottom then drain out of the top (an equaliser wipe)
  bars(C, p, cols = COLS) {
    const { ctx, W, H } = C, n = 24, w = W / n;
    for (let i = 0; i < n; i++) {
      const d = ((i * 7) % n) / n * 0.3, a = ease.out3(clamp((p - d) / 0.5)), b = ease.in3(clamp((p - 0.5 - d) / 0.5));
      ctx.fillStyle = cols[i % cols.length]; ctx.fillRect(Math.floor(i * w), H - a * H, Math.ceil(w) + 1, a * H - b * H + 1);
    }
  },
  // a disc grows from the centre; then a hole grows in it
  iris(C, p, cols = [P.YEL, P.RED]) {
    const { ctx, W, H } = C, R = Math.hypot(W, H) / 2 + 10, cx = W / 2, cy = H / 2;
    if (p < 0.5) { ctx.fillStyle = cols[0]; ctx.beginPath(); ctx.arc(cx, cy, R * ease.io3(p * 2), 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = cols[1]; ctx.lineWidth = 40; ctx.beginPath(); ctx.arc(cx, cy, R * ease.io3(p * 2) * 0.8, 0, Math.PI * 2); ctx.stroke(); }
    else { const r = R * ease.io3((p - 0.5) * 2); ctx.fillStyle = cols[0]; ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(cx, cy, r, 0, Math.PI * 2, true); ctx.fill('evenodd'); ctx.strokeStyle = cols[1]; ctx.lineWidth = 40; ctx.beginPath(); ctx.arc(cx, cy, r * 1.0, 0, Math.PI * 2); ctx.stroke(); }
  },
  // checkerboard of squares that scale up along a diagonal and then away
  checker(C, p, cols = [P.BLU, P.RED, P.YEL]) {
    const { ctx, W, H } = C, cw = W / 16, ch = H / 9;
    for (let j = 0; j < 9; j++) for (let i = 0; i < 16; i++) {
      const d = (i + j) / 24 * 0.36, a = ease.out3(clamp((p - d) / 0.44)), b = ease.in3(clamp((p - 0.5 - d) / 0.44));
      const sc = p < 0.5 ? a : 1 - b;
      if (sc <= 0.001) continue;
      ctx.fillStyle = cols[(i + j) % cols.length]; const w = cw * sc + 1, h = ch * sc + 1;
      ctx.fillRect(i * cw + (cw - w) / 2, j * ch + (ch - h) / 2, w, h);
    }
  },
};

// boundary bar -> style. Impact hits (8, 16, 40, 56) are hard cuts with a shock ring instead.
export const TRANSITIONS = [
  { bar: 6, style: 'slabs' },
  { bar: 12, style: 'bars' },
  { bar: 20, style: 'iris', cols: [P.YEL, P.BLU] },
  { bar: 24, style: 'checker', cols: [P.RED, P.YEL, P.BLU] },
  { bar: 28, style: 'slabs', cols: [P.BLU, P.WHT, P.RED, P.YEL, P.INK] },
  { bar: 32, style: 'iris', cols: [P.INK, P.WHT] },
  { bar: 44, style: 'bars', cols: [P.WHT, P.RED, P.BLU, P.YEL] },
  { bar: 48, style: 'checker', cols: [P.YEL, P.BLU, P.RED] },
  { bar: 52, style: 'slabs', cols: [P.RED, P.BLU, P.YEL, P.GRN, P.WHT] },
  { bar: 60, style: 'iris', cols: [P.BLU, P.YEL] },
];

/** half-width of every wipe, in bars */
const HALF = 0.11;
export function drawTransition(C) {
  for (const t of TRANSITIONS) {
    const p = (C.bar - (t.bar - HALF)) / (2 * HALF);
    if (p > 0 && p < 1) {
      styles[t.style](C, p, t.cols);
      C.fx.bloomMul = 1 - sstep(0.1, 0.42, Math.sin(Math.PI * p)); // the scene's glow must not bleed through the wipe
      return;
    }
  }
}
