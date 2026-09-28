// Bauhaus vocabulary: circles, half/quarter discs, triangles, bars, stripes, dot grids, rulers, arrows, checkerboards.
// All primitives are plain flat fills (that is the point) and take an optional glow context for emissive shapes.
import { P, TAU, rgba, clamp } from './util.js';

export function disc(ctx, x, y, r, color, alpha = 1) {
  if (r <= 0) return;
  ctx.globalAlpha = alpha; ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
}
export function ring(ctx, x, y, r, w, color, alpha = 1) {
  if (r <= 0 || w <= 0) return;
  ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = w;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
}
/** half disc whose flat edge faces angle `a` (radians) */
export function half(ctx, x, y, r, a, color, alpha = 1) {
  ctx.globalAlpha = alpha; ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r, a - Math.PI / 2, a + Math.PI / 2); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
}
export function quarter(ctx, x, y, r, a, color, alpha = 1) {
  ctx.globalAlpha = alpha; ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, r, a, a + Math.PI / 2); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
}
export function pie(ctx, x, y, r, a0, a1, color, alpha = 1) {
  ctx.globalAlpha = alpha; ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, r, a0, a1); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
}
/** ring segment (annular sector) */
export function arcBand(ctx, x, y, r0, r1, a0, a1, color, alpha = 1) {
  ctx.globalAlpha = alpha; ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r1, a0, a1); ctx.arc(x, y, r0, a1, a0, true); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
}
/** equilateral-ish triangle pointing along angle `a` with circumradius r */
export function tri(ctx, x, y, r, a, color, alpha = 1) {
  ctx.globalAlpha = alpha; ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) { const t = a + (i * TAU) / 3; i ? ctx.lineTo(x + Math.cos(t) * r, y + Math.sin(t) * r) : ctx.moveTo(x + Math.cos(t) * r, y + Math.sin(t) * r); }
  ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
}
/** right triangle with legs w,h anchored at corner (x,y) */
export function rtri(ctx, x, y, w, h, color, alpha = 1) {
  ctx.globalAlpha = alpha; ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
}
export function rect(ctx, x, y, w, h, color, alpha = 1) {
  ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1;
}
export function rrect(ctx, x, y, w, h, r, color, alpha = 1) {
  ctx.globalAlpha = alpha; ctx.fillStyle = color;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); ctx.globalAlpha = 1;
}
export function line(ctx, x0, y0, x1, y1, w, color, alpha = 1, cap = 'butt') {
  ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = cap;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.globalAlpha = 1;
}
/** filled rotated rectangle centred at x,y */
export function bar(ctx, x, y, w, h, a, color, alpha = 1) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.restore();
}
/** parallel stripes inside a clip rect */
export function stripes(ctx, x, y, w, h, n, color, { angle = 0, duty = 0.5, phase = 0, alpha = 1 } = {}) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.translate(x + w / 2, y + h / 2); ctx.rotate(angle);
  const diag = Math.hypot(w, h), pitch = diag / n;
  ctx.globalAlpha = alpha; ctx.fillStyle = color;
  for (let i = -1; i <= n + 1; i++) ctx.fillRect(-diag / 2 + (i + phase) * pitch, -diag / 2, pitch * duty, diag);
  ctx.restore();
}
export function dots(ctx, x, y, cols, rows, gap, r, color, { alpha = 1, fn = null } = {}) {
  ctx.globalAlpha = alpha; ctx.fillStyle = color;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const rr = fn ? fn(i, j) : r; if (rr <= 0) continue;
    ctx.beginPath(); ctx.arc(x + i * gap, y + j * gap, rr, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
/** ruler with ticks (every `major` th tick longer) */
export function ruler(ctx, x, y, len, n, color, { major = 5, vertical = false, tick = 14, w = 2, alpha = 1 } = {}) {
  ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const p = (i / n) * len, l = i % major === 0 ? tick * 1.9 : tick;
    if (vertical) { ctx.moveTo(x, y + p); ctx.lineTo(x + l, y + p); } else { ctx.moveTo(x + p, y); ctx.lineTo(x + p, y + l); }
  }
  ctx.stroke(); ctx.globalAlpha = 1;
}
export function concentric(ctx, x, y, r0, r1, n, colors, { alpha = 1, rot = 0 } = {}) {
  for (let i = n - 1; i >= 0; i--) disc(ctx, x, y, r0 + ((r1 - r0) * (i + 1)) / n, colors[i % colors.length], alpha);
}
export function checker(ctx, x, y, cols, rows, cell, c0, c1, alpha = 1) {
  ctx.globalAlpha = alpha;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { ctx.fillStyle = (i + j) % 2 ? c1 : c0; ctx.fillRect(x + i * cell, y + j * cell, cell, cell); }
  ctx.globalAlpha = 1;
}
export function arrow(ctx, x, y, len, a, w, color, alpha = 1) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.globalAlpha = alpha; ctx.fillStyle = color;
  ctx.fillRect(0, -w / 2, len - w * 1.6, w);
  ctx.beginPath(); ctx.moveTo(len, 0); ctx.lineTo(len - w * 2.2, -w * 1.3); ctx.lineTo(len - w * 2.2, w * 1.3); ctx.closePath(); ctx.fill();
  ctx.restore();
}
/** crosshair / registration mark */
export function reg(ctx, x, y, r, color, w = 2, alpha = 1) {
  ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
}
