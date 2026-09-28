// Shared UI furniture: background grid, corner marks, labels in the segment font, bit rows.
import { P, rgba, clamp, hex2 } from './util.js';
import { line, reg } from './bauhaus.js';

/** Bauhaus construction grid: 12 x 8 cells, brightens a touch on the kick */
export function grid(C, { alpha = 0.05, col = P.WHT, cols = 12, rows = 8 } = {}) {
  const { ctx, W, H, f } = C;
  ctx.save(); ctx.strokeStyle = rgba(col, alpha + 0.05 * f.kick); ctx.lineWidth = 1; ctx.beginPath();
  for (let i = 0; i <= cols; i++) { const x = Math.round((i * W) / cols) + 0.5; ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let j = 0; j <= rows; j++) { const y = Math.round((j * H) / rows) + 0.5; ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke(); ctx.restore();
}
export function corners(C, { col = P.WHT, alpha = 0.5, m = 48, r = 14 } = {}) {
  const { ctx, W, H } = C;
  for (const [x, y] of [[m, m], [W - m, m], [m, H - m], [W - m, H - m]]) reg(ctx, x, y, r, col, 2, alpha);
}
/** text in the segment font with default styling */
export function label(C, str, x, y, h, color = P.WHT, o = {}) {
  return C.G.text(C.ctx, C.glow, str, { x, y, h, color, gap: 0.32, hot: 0, glowK: 0.35, ...o });
}
/** row of n bit cells, value v (number); returns nothing. */
export function bits(C, x, y, n, v, { size = 22, gap = 6, on = P.YEL, off = 'rgba(255,255,255,0.10)', lsbLeft = false, hi = -1 } = {}) {
  const { ctx, glow } = C;
  for (let i = 0; i < n; i++) {
    const bit = lsbLeft ? i : n - 1 - i, lit = (v >> bit) & 1, xx = x + i * (size + gap);
    ctx.fillStyle = lit ? on : off; ctx.fillRect(xx, y, size, size);
    if (lit) { glow.fillStyle = on; glow.fillRect(xx - 2, y - 2, size + 4, size + 4); }
    if (i === hi) { ctx.strokeStyle = P.WHT; ctx.lineWidth = 3; ctx.strokeRect(xx - 3, y - 3, size + 6, size + 6); }
  }
}
export { hex2 };

/** expanding ring + faint flash on every impact hit (drops, transitions) */
export function shock(C, { x = C.W / 2, y = C.H / 2, col = P.WHT, life = 1.1 } = {}) {
  const age = C.cues.age('impact', C.Tc);
  if (age > life) return;
  const u = age / life, r = 2300 * (1 - Math.pow(1 - u, 3)), a = 0.8 * (1 - u);
  C.ctx.save(); C.ctx.strokeStyle = rgba(col, a); C.ctx.lineWidth = 26 * (1 - u) + 2;
  C.ctx.beginPath(); C.ctx.arc(x, y, r, 0, Math.PI * 2); C.ctx.stroke(); C.ctx.restore();
  C.glow.save(); C.glow.strokeStyle = rgba(col, a * 0.7); C.glow.lineWidth = 14 * (1 - u) + 2; C.glow.beginPath(); C.glow.arc(x, y, r, 0, Math.PI * 2); C.glow.stroke(); C.glow.restore();
}
