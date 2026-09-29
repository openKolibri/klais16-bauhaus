// Reusable composite pieces of the gothic set: the stepped stone niche (a portal with reveals), the bottom HUD, plaques.
import { TAU, clamp, lerp, smooth, sstep } from '../render/util.js';
import { L, La, TONE, roman } from './tone.js';
import { archPath, crockets, hatch, foilPath } from './ornament.js';

/** arch geometry offset inwards by d: the arcs stay concentric (radius R - d), the springing line stays put */
export function archOffset(w, h, rise, d) {
  const s = w / 2, R = (rise * rise + s * s) / (2 * s), Rd = R - d, sd = s - d;
  const riseD = Math.sqrt(Math.max(1, Rd * Rd - (R - s) * (R - s)));
  return { w: 2 * sd, h: h - rise + riseD - 0 * d, rise: riseD };
}

/**
 * A stone portal: three stepped reveals (each an inward offset of the arch) with hatching between them, crockets and a
 * finial. Draws only the dark stonework (lit by the scene's light map afterwards); returns the innermost arch path.
 */
export function niche(ctx, { cx, baseY, w, h, rise = 0.866 * w, steps = 3, step = 30, v = 0.55, hatchV = 0.2, size = 13, crock = true }) {
  let inner = null;
  for (let i = 0; i < steps; i++) {
    const o = archOffset(w, h, rise, i * step), o2 = archOffset(w, h, rise, (i + 1) * step);
    const outer = archPath(cx, baseY, o.w, o.h, o.rise), inn = archPath(cx, baseY, o2.w, o2.h, o2.rise);
    const ring = new Path2D(); ring.addPath(outer); ring.addPath(inn);
    ctx.save(); ctx.clip(ring, 'evenodd');
    ctx.fillStyle = L(0.09 + 0.02 * i); ctx.fillRect(cx - w / 2 - 4, baseY - h - 60, w + 8, h + 70);
    ctx.restore();
    ctx.save(); ctx.clip(outer);
    // hatching in the reveal only: draw hatch then blank the inner arch
    hatch(ctx, ring, { x0: cx - w / 2, y0: baseY - h, x1: cx + w / 2, y1: baseY, angle: -0.95 + 0.25 * i, gap: 7 - i, v: hatchV, lw: 1 });
    ctx.restore();
    ctx.strokeStyle = L(v * (1 - 0.18 * i)); ctx.lineWidth = 3 - 0.5 * i; ctx.stroke(outer);
    if (i === steps - 1) { ctx.strokeStyle = L(v); ctx.lineWidth = 3; ctx.stroke(inn); inner = inn; }
  }
  if (crock) crockets(ctx, cx, baseY, w + 24, h + 12, rise + 8, { n: 6, size, v: v * 0.9 });
  return inner;
}

/** small inscription plaque: a rule, text in the segment font, a rule */
export function plaque(C, str, x, y, { h = 26, v = 0.55, align = 'center', gap = 0.34, rule = true, glowK = 0.3 } = {}) {
  const { ctx, glow, G } = C, wdt = G.textWidth(str, h, gap);
  const x0 = align === 'center' ? x - wdt / 2 : align === 'left' ? x : x - wdt;
  G.text(ctx, glow, str, { x: x0, y, h, color: L(v), gap, hot: 0.3, glowK });
  if (rule) {
    ctx.save(); ctx.strokeStyle = L(v * 0.5); ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(x0 - 30, y - h * 0.9); ctx.lineTo(x0 + wdt + 30, y - h * 0.9); ctx.moveTo(x0 - 30, y + h * 0.9); ctx.lineTo(x0 + wdt + 30, y + h * 0.9); ctx.stroke();
    ctx.restore();
  }
  return { x0, w: wdt };
}

/** which steps of the bar carried an event of `kind` (16 values, event velocity) */
export function stepHits(C, kind, barIdx) {
  const { cues } = C, t0 = barIdx * cues.BAR, out = new Array(16).fill(0);
  for (const e of cues.between(kind, t0 - 0.004, t0 + cues.BAR - 0.004)) out[Math.min(15, Math.max(0, Math.round((e[0] - t0) / cues.STEP)))] = e[1] ?? 1;
  return out;
}

/**
 * The HUD: sixteen little lancets (one per step of the bar - the display is the sequencer), instrument marks above them,
 * the bar in Roman numerals and the tempo. Kept dim so it never competes with a scene.
 */
export function hud(C, { steps = true, v = 0.5 } = {}) {
  const { ctx, glow, G, W, H, cues } = C;
  const barIdx = Math.floor(C.bar), stepIdx = Math.floor((C.bar - barIdx) * 16 + 1e-6);
  const sw = 16, gap = 9, total = 16 * sw + 15 * gap, x0 = W / 2 - total / 2, y0 = H - 44;
  if (steps) {
    const kick = stepHits(C, 'kick', barIdx), snare = stepHits(C, 'snare', barIdx), bass = stepHits(C, 'bass', barIdx), bell = stepHits(C, 'bell', barIdx);
    ctx.save();
    for (let i = 0; i < 16; i++) {
      const x = x0 + i * (sw + gap), cur = i === stepIdx, past = i < stepIdx;
      const p = archPath(x + sw / 2, y0 + 26, sw, 26, sw * 1.1);
      ctx.fillStyle = L(cur ? 0.95 : past ? 0.3 : 0.11); ctx.fill(p);
      if (cur) { glow.save(); glow.fillStyle = L(0.9); glow.fill(archPath(x + sw / 2, y0 + 26, sw, 26, sw * 1.1)); glow.restore(); }
      if (kick[i]) { ctx.fillStyle = L(0.7); ctx.fillRect(x + 2, y0 - 10, sw - 4, 4); }
      if (snare[i]) { ctx.fillStyle = L(0.5); ctx.fillRect(x + 2, y0 - 17, sw - 4, 4); }
      if (bass[i]) { ctx.fillStyle = L(0.35); ctx.fillRect(x + 2, y0 - 24, sw - 4, 4); }
      if (bell[i]) { ctx.fillStyle = L(0.6); ctx.beginPath(); ctx.arc(x + sw / 2, y0 - 33, 3, 0, TAU); ctx.fill(); }
    }
    ctx.restore();
  }
  G.text(ctx, null, 'BAR ' + roman(barIdx + 1), { x: 56, y: H - 40, h: 20, color: L(v * 0.8), gap: 0.3, hot: 0 });
  G.text(ctx, null, `${roman(cues.bpm)} BPM`, { x: W - 56, y: H - 40, h: 20, align: 'right', color: L(v * 0.6), gap: 0.3, hot: 0 });
}

/** the first event of `kind` in every step of bar `barIdx` (or null): the bar's pattern as the cue sheet knows it, past and future */
export function stepEvents(C, kind, barIdx) {
  const { cues } = C, t0 = barIdx * cues.BAR, out = new Array(16).fill(null);
  for (const e of cues.between(kind, t0 - 0.004, t0 + cues.BAR - 0.004)) {
    const i = Math.min(15, Math.max(0, Math.round((e[0] - t0) / cues.STEP)));
    if (!out[i]) out[i] = e;
  }
  return out;
}

// ---- the ring on the board ---------------------------------------------------------------------------
const strikeCache = new Map();
/** strike times of one course by firmware LED number: t[n] for n = 1..128 (0 when the course never strikes it) */
export function courseStrikes(cues, course) {
  let t = strikeCache.get(course);
  if (!t) {
    t = new Float64Array(129);
    for (const e of cues.ev.bell) if (e[5] === course && e[6] > 0) t[e[6]] = e[0];
    strikeCache.set(course, t);
  }
  return t;
}
/**
 * The module drawn as its 128 LEDs at their true positions, driven by the ring: mode 'fill' = an LED lights at its strike and
 * stays lit (drop 1 lights the board grid by grid); 'snuff' = every LED starts lit and goes out at its strike (tenebrae).
 * Returns the number of LEDs currently lit.
 */
export function ledBoard(C, { x, y, s, course, mode = 'fill', v = 0.9, r = 0.72, outline = true, label = false }) {
  const { ctx, glow, G, Tc, cues } = C, st = courseStrikes(cues, course);
  let lit = 0;
  const level = (n) => {
    const t = st[n];
    if (!t) return mode === 'snuff' ? 0.9 : 0;
    const age = Tc - t;
    if (mode === 'fill') return age < 0 ? 0 : 0.28 + 0.72 * Math.exp(-age / 0.4);
    return age < 0 ? 0.9 : 0.9 * Math.exp(-age / 0.05) * 0 + 0.22 * Math.exp(-age / 0.6) + 0.9 * Math.exp(-age / 0.09) * (age < 0.25 ? 1 : 0);
  };
  if (outline) { G.board(ctx, { x, y, s, fill: '#000000', edge: L(0.16), screws: false }); G.draw(ctx, null, { x, y, s, lv: G.zero, off: L(0.035), edge: L(0.07), dp: true }); }
  G.leds16(ctx, glow, { x, y, s, r, off: L(0.055), color: L(1), f: (l) => { const a = level(l.n) * v; if (a > 0.25) lit++; return a; } });
  return lit;
}

/** expanding ring on every big impact (drops, transitions): thin and red, not a flash */
export function shockRing(C, { x = C.W / 2, y = C.H / 2, life = 1.0 } = {}) {
  const age = C.cues.age('impact', C.Tc);
  if (age > life) return;
  const u = age / life, r = 2200 * (1 - Math.pow(1 - u, 3)), a = 0.75 * (1 - u), lw = 10 * (1 - u) + 2;
  const { ctx, glow } = C;
  ctx.save(); ctx.strokeStyle = La(0.9, a); ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); ctx.restore();
  glow.save(); glow.strokeStyle = La(0.9, a * 0.6); glow.lineWidth = lw * 0.8 + 2; glow.beginPath(); glow.arc(x, y, r, 0, TAU); glow.stroke(); glow.restore();
}

/** a blind arcade along the wall: pointed arches with a foil in each head, drawn faint - the scene's light reveals it */
export function arcade(ctx, { x0 = -120, x1 = 2040, baseY = 1040, w = 400, h = 720, v = 0.4, foils = true } = {}) {
  const n = Math.ceil((x1 - x0) / w) + 1;
  ctx.save(); ctx.lineJoin = 'round';
  for (let i = 0; i < n; i++) {
    const cx = x0 + i * w, aw = w - 46;
    ctx.strokeStyle = L(v); ctx.lineWidth = 2.6; ctx.stroke(archPath(cx, baseY, aw, h, aw * 0.95));
    ctx.strokeStyle = L(v * 0.55); ctx.lineWidth = 1.6; ctx.stroke(archPath(cx, baseY, aw - 34, h - 26, (aw - 34) * 0.95));
    if (foils) { const p = foilPath(cx, baseY - h + h * 0.34, 50, 4, Math.PI / 4); ctx.strokeStyle = L(v * 0.85); ctx.lineWidth = 2; ctx.stroke(p); }
  }
  ctx.restore();
}
