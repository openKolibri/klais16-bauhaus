// Rose-window geometry: annular sectors, radial lancet petals and the fixed tracery of a sixteen-part window.
import { TAU, clamp } from '../render/util.js';
import { L, La } from './tone.js';
import { archPath, foilPath } from './ornament.js';

const PI = Math.PI;

/** annular sector between radii r0..r1 and angles a0..a1 (canvas radians, clockwise) */
export function sector(cx, cy, r0, r1, a0, a1) {
  const p = new Path2D();
  p.arc(cx, cy, r1, a0, a1); p.arc(cx, cy, r0, a1, a0, true); p.closePath();
  return p;
}

/** a lancet petal pointing away from the centre at angle a: base at radius r0, apex at r1, angular width wAng at the base */
export function petal(cx, cy, r0, r1, a, wAng, pointed = 1.15) {
  const w = 2 * r0 * Math.sin(wAng / 2) * 0.98, h = r1 - r0, p = new Path2D();
  p.addPath(archPath(0, -r0, w, h, Math.min(h * 0.9, w * pointed)), new DOMMatrix().translate(cx, cy).rotate(((a + PI / 2) * 180) / PI));
  return p;
}

/** the angle of step i of n, starting at 12 o'clock and running clockwise */
export const stepAngle = (i, n = 16) => -PI / 2 + (i * TAU) / n;

/**
 * The fixed stonework of a rose window of `n` parts: a double rim with beads, radial mullions between the parts and a hub ring.
 * Draws with the tone `v`.
 */
export function roseFrame(ctx, cx, cy, R, { n = 16, v = 0.4, hub = 0.28, rim = 0.06, mullions = true, beads = true } = {}) {
  ctx.save(); ctx.strokeStyle = L(v); ctx.fillStyle = L(v); ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
  ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, R * (1 - rim), 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, R * hub, 0, TAU); ctx.stroke();
  if (mullions) {
    ctx.lineWidth = 2; ctx.beginPath();
    for (let i = 0; i < n; i++) { const a = stepAngle(i, n) + PI / n; ctx.moveTo(cx + Math.cos(a) * R * hub, cy + Math.sin(a) * R * hub); ctx.lineTo(cx + Math.cos(a) * R * (1 - rim), cy + Math.sin(a) * R * (1 - rim)); }
    ctx.stroke();
  }
  if (beads) for (let i = 0; i < n; i++) { const a = stepAngle(i, n), r = R * (1 - rim / 2); ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, R * 0.008, 0, TAU); ctx.fill(); }
  ctx.restore();
}
