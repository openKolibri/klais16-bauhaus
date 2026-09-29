// Gothic vocabulary: pointed arches, foils, crockets, finials, candles, chains, hatching and cached masonry.
// Everything draws in tone levels (red channel only, see tone.js) and takes an optional glow context for emissive parts.
import { TAU, clamp, lerp, hash, hash2, smooth } from '../render/util.js';
import { L, La, TONE, flicker, noise1 } from './tone.js';

const PI = Math.PI;

/**
 * Pointed (two-centred) arch window: straight sides from `baseY` up to the springing line, then two arcs meeting at the apex.
 * w = width, h = total height, rise = height of the pointed part (equilateral arch: 0.866 w; a lancet is taller).
 * Returns a Path2D. Each half is an arc of radius R = (rise^2 + s^2) / (2 s), s = w/2, centred on the springing line.
 */
export function archPath(cx, baseY, w, h, rise = 0.866 * w) {
  const s = w / 2, ys = baseY - (h - rise), R = (rise * rise + s * s) / (2 * s), a = Math.atan2(rise, R - s);
  const p = new Path2D();
  p.moveTo(cx - s, baseY); p.lineTo(cx - s, ys);
  p.arc(cx - s + R, ys, R, PI, PI + a);
  p.arc(cx + s - R, ys, R, -a, 0);
  p.lineTo(cx + s, baseY); p.closePath();
  return p;
}
/**
 * point on the outline of a pointed arch: side = -1 (left) / +1 (right), u = 0 at the springing line .. 1 at the apex.
 * Returns [x, y, nx, ny, tx, ty]: the point, its outward normal and the unit tangent that climbs towards the apex.
 */
export function archPoint(cx, baseY, w, h, rise, side, u) {
  const s = w / 2, ys = baseY - (h - rise), R = (rise * rise + s * s) / (2 * s), a = Math.atan2(rise, R - s);
  if (side < 0) { const an = PI + a * u; return [cx - s + R + R * Math.cos(an), ys + R * Math.sin(an), Math.cos(an), Math.sin(an), -Math.sin(an), Math.cos(an)]; }
  const an = -a * u;
  return [cx + s - R + R * Math.cos(an), ys + R * Math.sin(an), Math.cos(an), Math.sin(an), Math.sin(an), -Math.cos(an)];
}

/** an n-lobed foil (trefoil n=3, quatrefoil n=4 ...) fitting in radius R; rr = lobe radius / lobe distance */
export function foilPath(cx, cy, R, n = 4, rot = -PI / 2, rr = 0.9) {
  const d = R / (1 + rr), r = d * rr, sn = Math.sin(PI / n), cs = Math.cos(PI / n);
  const rho = d * cs + Math.sqrt(Math.max(0, r * r - d * d * sn * sn));
  const delta = Math.atan2(rho * sn, rho * cs - d);
  const p = new Path2D();
  for (let k = 0; k < n; k++) {
    const th = rot + (k * TAU) / n, x = cx + d * Math.cos(th), y = cy + d * Math.sin(th);
    p.arc(x, y, r, th - delta, th + delta);
  }
  p.closePath();
  return p;
}

/** small curled leaves (crockets) climbing both sides of an arch, and a finial on top */
export function crockets(ctx, cx, baseY, w, h, rise, { n = 6, size = 12, lw = 2, v = 0.3, finial = true } = {}) {
  ctx.save(); ctx.strokeStyle = L(v); ctx.fillStyle = L(v); ctx.lineWidth = lw; ctx.lineCap = 'round';
  for (let side = -1; side <= 1; side += 2) for (let k = 0; k < n; k++) {
    const u = (k + 0.6) / (n + 0.5), [x, y, nx, ny, tx, ty] = archPoint(cx, baseY, w, h, rise, side, u);
    const ex = x + nx * size * 0.75 + tx * size * 1.05, ey = y + ny * size * 0.75 + ty * size * 1.05;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + nx * size * 1.15, y + ny * size * 1.15, ex, ey); ctx.stroke();
    ctx.beginPath(); ctx.arc(ex, ey, size * 0.17, 0, TAU); ctx.fill();
  }
  if (finial) {
    const ty = baseY - h; // apex
    ctx.beginPath(); ctx.moveTo(cx, ty); ctx.lineTo(cx, ty - size * 1.6); ctx.stroke();
    ctx.fill(foilPath(cx, ty - size * 2.5, size * 1.05, 3));
    ctx.beginPath(); ctx.moveTo(cx, ty - size * 3.6); ctx.lineTo(cx, ty - size * 5); ctx.moveTo(cx - size * 0.6, ty - size * 4.3); ctx.lineTo(cx + size * 0.6, ty - size * 4.3); ctx.stroke();
  }
  ctx.restore();
}

/** parallel hatch lines clipped to a path: the engraver's shading */
export function hatch(ctx, path, { x0, y0, x1, y1, angle = -0.9, gap = 6, lw = 1, v = 0.2, a = 1, phase = 0 }) {
  ctx.save(); ctx.clip(path);
  ctx.strokeStyle = La(v, a); ctx.lineWidth = lw; ctx.beginPath();
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, diag = Math.hypot(x1 - x0, y1 - y0) / 2, ca = Math.cos(angle), sa = Math.sin(angle);
  for (let d = -diag + (phase % gap); d <= diag; d += gap) {
    const px = cx - sa * d, py = cy + ca * d;
    ctx.moveTo(px - ca * diag, py - sa * diag); ctx.lineTo(px + ca * diag, py + sa * diag);
  }
  ctx.stroke(); ctx.restore();
}

// ---- candles ---------------------------------------------------------------------------------------
/** a candle: wax column + a flame that leans and flickers (deterministic in t); returns the flame's tip position */
export function candle(ctx, glow, x, y, { h = 60, w = 12, t = 0, seed = 0, lit = 1, wax = 0.22, flame = 0.95, wind = 0 } = {}) {
  ctx.save();
  ctx.fillStyle = L(wax); ctx.fillRect(x - w / 2, y - h, w, h);
  ctx.fillStyle = L(wax * 0.55); ctx.fillRect(x + w * 0.15, y - h, w * 0.35, h);
  ctx.fillStyle = L(wax * 1.5); ctx.beginPath(); ctx.ellipse(x, y - h, w / 2, w * 0.18, 0, 0, TAU); ctx.fill();
  if (lit > 0.01) {
    const fl = flicker(t, seed), sway = (noise1(t * 4 + seed * 11) - 0.5) * 0.55 + wind, fh = w * 2.6 * (0.78 + 0.4 * fl) * lit, fw = w * 0.5 * (0.9 + 0.2 * fl);
    const bx = x, by = y - h - 1, tx = bx + sway * fh * 0.55, ty = by - fh;
    const shape = new Path2D();
    shape.moveTo(bx, by); shape.bezierCurveTo(bx - fw * 1.1, by - fh * 0.32, bx - fw * 0.55 + sway * fh * 0.15, by - fh * 0.75, tx, ty);
    shape.bezierCurveTo(bx + fw * 0.55 + sway * fh * 0.15, by - fh * 0.75, bx + fw * 1.1, by - fh * 0.32, bx, by);
    ctx.globalAlpha = 1; ctx.fillStyle = L(flame * 0.9); ctx.fill(shape);
    ctx.save(); ctx.translate(bx, by); ctx.scale(0.5, 0.62); ctx.translate(-bx, -by); ctx.fillStyle = L(1); ctx.fill(shape); ctx.restore();
    if (glow) {
      glow.save(); glow.globalAlpha = lit; glow.fillStyle = L(flame); glow.fill(shape);
      const g = glow.createRadialGradient(bx, by - fh * 0.5, 2, bx, by - fh * 0.5, w * 4.5 + h * 0.4);
      g.addColorStop(0, La(0.55 * lit, 0.55 + 0.25 * fl)); g.addColorStop(1, La(0, 0));
      glow.fillStyle = g; glow.fillRect(bx - w * 6 - h, by - fh - w * 6 - h, (w * 6 + h) * 2, (w * 6 + h) * 2);
      glow.restore();
    }
    ctx.restore();
    return [tx, ty];
  }
  ctx.restore();
  return [x, y - h];
}

// ---- chains ----------------------------------------------------------------------------------------
/**
 * A chain hanging along a polyline [[x,y],...]: alternating flat and edge-on links every `pitch` px.
 * lit(i, u) -> 0..1 brightness of link i (u = 0..1 along the chain); links draw as outlines with a hot core when lit.
 */
export function chain(ctx, glow, pts, { pitch = 22, w = 8, lw = 2.2, lit = () => 0, v = 0.26, glowK = 0.8 } = {}) {
  // arc-length resample
  const seg = [0];
  for (let i = 1; i < pts.length; i++) seg.push(seg[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = seg[seg.length - 1], n = Math.max(1, Math.floor(total / pitch));
  let j = 1;
  ctx.save(); ctx.lineWidth = lw; ctx.lineCap = 'round';
  for (let i = 0; i <= n; i++) {
    const s = (i / n) * total;
    while (j < pts.length - 1 && seg[j] < s) j++;
    const k = clamp((s - seg[j - 1]) / Math.max(1e-6, seg[j] - seg[j - 1])), x = lerp(pts[j - 1][0], pts[j][0], k), y = lerp(pts[j - 1][1], pts[j][1], k);
    const ang = Math.atan2(pts[j][1] - pts[j - 1][1], pts[j][0] - pts[j - 1][0]), on = clamp(lit(i, i / n));
    const flat = i % 2 === 0, len = pitch * 0.95, wid = flat ? w : w * 0.28;
    const col = L(v + (TONE.led - v) * on);
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.strokeStyle = col;
    ctx.beginPath(); ctx.ellipse(0, 0, len / 2, wid / 2, 0, 0, TAU); ctx.stroke();
    ctx.restore();
    if (glow && on > 0.02) { glow.save(); glow.translate(x, y); glow.rotate(ang); glow.globalAlpha = on * glowK; glow.strokeStyle = L(1); glow.lineWidth = lw * 1.6; glow.beginPath(); glow.ellipse(0, 0, len / 2, wid / 2, 0, 0, TAU); glow.stroke(); glow.restore(); }
  }
  ctx.restore();
}

// ---- masonry, cached -------------------------------------------------------------------------------
const stoneCache = new Map();
/**
 * A cached offscreen canvas of dressed stone (courses of blocks, speckle, a few cracks) drawn in low tone levels.
 * Scenes draw it and then multiply a light mask over it, so the stone only shows where the candles reach.
 */
export function stone(w, h, seed = 1, { course = 74, block = 150, v = 0.42 } = {}) {
  const key = `${w}x${h}:${seed}:${course}:${block}:${v}`;
  let c = stoneCache.get(key);
  if (c) return c;
  c = Object.assign(document.createElement('canvas'), { width: w, height: h });
  const g = c.getContext('2d');
  g.fillStyle = L(v * 0.28); g.fillRect(0, 0, w, h);
  g.strokeStyle = L(v * 0.9); g.lineWidth = 2;
  g.beginPath();
  for (let r = 0, y = 0; y < h + course; r++, y += course) {
    g.moveTo(0, y); g.lineTo(w, y);
    const off = (r % 2) * (block / 2) + hash2(r, seed) * 20;
    for (let x = -off; x < w; x += block * (0.85 + 0.3 * hash2(r * 31 + Math.floor(x / block), seed))) { g.moveTo(x, y); g.lineTo(x, y + course); }
  }
  g.stroke();
  // block faces: slightly different tones, plus speckle
  for (let r = 0, y = 0; y < h; r++, y += course) for (let x = -(r % 2) * (block / 2); x < w; x += block) {
    g.fillStyle = L(v * (0.05 + 0.2 * hash2(x | 0, y + seed))); g.globalAlpha = 0.6; g.fillRect(x + 3, y + 3, block - 6, course - 6);
  }
  g.globalAlpha = 1;
  for (let i = 0; i < (w * h) / 900; i++) { g.fillStyle = L(v * (0.4 + 0.6 * hash(i + seed * 99))); g.globalAlpha = 0.5; g.fillRect(hash(i * 3 + 1 + seed) * w, hash(i * 3 + 2 + seed) * h, 2, 2); }
  g.globalAlpha = 1;
  stoneCache.set(key, c);
  return c;
}

/**
 * A light map: draw a dark scene, then multiply this over it so only the neighbourhood of the candles shows.
 * Built on a half-resolution offscreen canvas (the light is soft anyway): begin(), add() any number of lights, apply().
 */
export class Light {
  constructor(W, H, s = 0.5) {
    this.W = W; this.H = H; this.s = s;
    this.c = Object.assign(document.createElement('canvas'), { width: Math.round(W * s), height: Math.round(H * s) });
    this.g = this.c.getContext('2d');
  }
  begin(floor = 0) {
    const g = this.g, k = Math.round(255 * clamp(floor));
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.fillStyle = `rgb(${k},${k},${k})`; g.fillRect(0, 0, this.c.width, this.c.height);
    g.globalCompositeOperation = 'lighter';
  }
  /** a soft light at (x, y) in canvas pixels: radius r, strength k (0..1+) */
  add(x, y, r, k) {
    const g = this.g, s = this.s, v = (m) => { const q = Math.round(255 * clamp(k * m, 0, 1)); return `rgb(${q},${q},${q})`; };
    const gr = g.createRadialGradient(x * s, y * s, 0, x * s, y * s, r * s);
    gr.addColorStop(0, v(1)); gr.addColorStop(0.3, v(0.62)); gr.addColorStop(0.6, v(0.26)); gr.addColorStop(0.85, v(0.06)); gr.addColorStop(1, 'rgb(0,0,0)');
    g.fillStyle = gr; g.fillRect((x - r) * s, (y - r) * s, 2 * r * s, 2 * r * s);
  }
  apply(ctx) {
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.c, 0, 0, this.W, this.H); ctx.restore();
  }
}

/** rising embers: n sparks whose position is a pure function of time */
export function embers(ctx, glow, t, { x0, x1, y0, y1, n = 40, seed = 0, life = 4, size = 2.2, v = 0.9, sway = 30 } = {}) {
  for (let i = 0; i < n; i++) {
    const per = life * (0.6 + 0.8 * hash(i * 7 + seed)), ph = t / per + hash(i * 13 + seed * 3), cyc = Math.floor(ph), u = ph - cyc;
    const x = lerp(x0, x1, hash2(i, cyc + seed * 17)) + Math.sin(u * 6 + i) * sway * u, y = lerp(y0, y1, u) ;
    const a = Math.sin(PI * u) * (0.4 + 0.6 * hash2(i + 3, cyc)), r = size * (0.5 + hash(i * 5 + seed)) * (1 - 0.5 * u);
    ctx.globalAlpha = a; ctx.fillStyle = L(v); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    if (glow) { glow.globalAlpha = a * 0.8; glow.fillStyle = L(1); glow.beginPath(); glow.arc(x, y, r * 1.8, 0, TAU); glow.fill(); }
  }
  ctx.globalAlpha = 1; if (glow) glow.globalAlpha = 1;
}

// ---- bells -----------------------------------------------------------------------------------------
const BELL_OUTLINE = (() => {
  const p = new Path2D();
  p.moveTo(-11, 18); p.bezierCurveTo(-21, 28, -24, 60, -33, 90); p.bezierCurveTo(-39, 104, -49, 111, -54, 124);
  p.lineTo(54, 124); p.bezierCurveTo(49, 111, 39, 104, 33, 90); p.bezierCurveTo(24, 60, 21, 28, 11, 18); p.closePath();
  return p;
})();
/**
 * A hanging bell drawn from its pivot (x, y): crown, shoulder, waist and flared lip, a clapper, swinging by `angle` (radians).
 * size = 1 is ~124 px tall. `e` (0..1) is how brightly it rings right now.
 */
export function bellShape(ctx, glow, x, y, { size = 1, angle = 0, e = 0, v = 0.3 } = {}) {
  for (const c of glow ? [ctx, glow] : [ctx]) {
    c.save(); c.translate(x, y); c.rotate(angle); c.scale(size, size);
    if (c === ctx) {
      ctx.fillStyle = L(0.05 + 0.3 * e); ctx.fill(BELL_OUTLINE);
      ctx.strokeStyle = L(v + (0.95 - v) * e); ctx.lineWidth = 2.6 / size; ctx.stroke(BELL_OUTLINE);
      ctx.beginPath(); ctx.moveTo(-40, 100); ctx.lineTo(40, 100); ctx.moveTo(-30, 76); ctx.lineTo(30, 76); ctx.lineWidth = 1.6 / size; ctx.strokeStyle = L((v + (0.95 - v) * e) * 0.7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(0, 18); ctx.lineWidth = 3 / size; ctx.strokeStyle = L(v); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 132 + 6 * e, 7, 0, TAU); ctx.fillStyle = L(v + (0.95 - v) * e); ctx.fill();
    } else if (e > 0.02) {
      glow.globalAlpha = e; glow.lineWidth = 6 / size; glow.strokeStyle = L(1); glow.stroke(BELL_OUTLINE);
      glow.globalAlpha = e * 0.5; glow.fillStyle = L(0.8); glow.fill(BELL_OUTLINE);
    }
    c.restore();
  }
}
