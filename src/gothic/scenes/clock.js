// HOROLOGIUM (bars 28-31): a clock with sixteen divisions. One hand turns once per bar; the five-step ticks and the seven-step war
// drums each jump a hand to the step they land on, and draw their star polygons {16/5} and {16/7} as they go. Gears turn a
// tooth at every tick.
import { TAU, clamp, lerp, smooth, sstep, ease } from '../../render/util.js';
import { L, La, TONE, roman } from '../tone.js';
import { stone, Light } from '../ornament.js';
import { stepAngle } from '../rose.js';
import { plaque } from '../furniture.js';

let light = null;
const PI = Math.PI;

function gear(ctx, glow, cx, cy, R, teeth, angle, { v = 0.3, lit = 0 } = {}) {
  const p = new Path2D(), s = TAU / teeth, r0 = R * 0.86;
  for (let i = 0; i < teeth; i++) {
    const a = angle + i * s;
    const pts = [[r0, 0], [R, 0.12], [R, 0.4], [r0, 0.56]];
    pts.forEach(([r, k], j) => { const x = cx + Math.cos(a + k * s) * r, y = cy + Math.sin(a + k * s) * r; (i === 0 && j === 0) ? p.moveTo(x, y) : p.lineTo(x, y); });
  }
  p.closePath();
  ctx.fillStyle = L(0.025); ctx.fill(p);
  ctx.strokeStyle = L(v + 0.5 * lit); ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.stroke(p);
  ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, R * 0.72, 0, TAU); ctx.moveTo(cx + R * 0.16, cy); ctx.arc(cx, cy, R * 0.16, 0, TAU); ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 6; i++) { const a = angle * 0.5 + (i * TAU) / 6; ctx.moveTo(cx + Math.cos(a) * R * 0.16, cy + Math.sin(a) * R * 0.16); ctx.lineTo(cx + Math.cos(a) * R * 0.72, cy + Math.sin(a) * R * 0.72); }
  ctx.stroke();
  if (lit > 0.03) { glow.globalAlpha = lit; glow.strokeStyle = L(0.9); glow.lineWidth = 5; glow.stroke(p); glow.globalAlpha = 1; }
}

/** where a hand driven by events of `kind` points: [angle position in steps, seconds since the last event, previous position] */
function handState(C, kind) {
  const { cues, Tc, STEP } = C;
  const i = cues.idx(kind, Tc);
  if (i < 0) return { pos: 0, age: 9, prev: 0, cnt: 0 };
  const ev = cues.ev[kind], at = (k) => Math.round(ev[k][0] / STEP) % 16;
  const now = at(i), prev = i > 0 ? at(i - 1) : now;
  return { pos: now, age: Tc - ev[i][0], prev, cnt: i + 1 };
}

export function clock(C) {
  const { ctx, glow, G, W, H, f, cues, Tc, STEP } = C;
  light = light || new Light(W, H);
  const cx = 960, cy = 528, R = 430, lb = C.lbar, barFrac = C.bar - Math.floor(C.bar);
  ctx.drawImage(stone(W, H, 31, { course: 80, block: 170 }), 0, 0);
  light.begin(0.05 + 0.05 * f.kick + 0.3 * f.toll);
  light.add(cx, cy, 800, 0.55 + 0.2 * f.kick);
  light.apply(ctx);

  const tk = handState(C, 'tick'), tm = handState(C, 'tom');

  // ---- gears, half out of frame, one tooth per tick / per drum
  const teeth1 = 16, teeth2 = 10;
  const step1 = tk.cnt + ease.out3(clamp(tk.age / 0.16)) - 1, step2 = tm.cnt + ease.out3(clamp(tm.age / 0.2)) - 1;
  gear(ctx, glow, 150, 860, 300, teeth1, (step1 * TAU) / teeth1, { v: 0.28, lit: Math.exp(-tk.age / 0.12) * 0.6 });
  gear(ctx, glow, 1800, 190, 240, teeth2, -(step2 * TAU) / teeth2 + 0.2, { v: 0.28, lit: Math.exp(-tm.age / 0.15) * 0.6 });
  gear(ctx, glow, 1700, 900, 150, 8, (step1 * TAU) / 8 * 1.2, { v: 0.24, lit: 0 });

  // ---- the dial
  ctx.fillStyle = L(0.015); ctx.beginPath(); ctx.arc(cx, cy, R + 8, 0, TAU); ctx.fill();
  ctx.strokeStyle = L(0.42); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, R + 8, 0, TAU); ctx.stroke();
  ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, R - 46, 0, TAU); ctx.moveTo(cx + R - 70, cy); ctx.arc(cx, cy, R - 70, 0, TAU); ctx.moveTo(cx + 84, cy); ctx.arc(cx, cy, 84, 0, TAU); ctx.stroke();
  const posBar = barFrac * 16;
  for (let i = 0; i < 16; i++) {
    const a = stepAngle(i), passed = posBar >= i && posBar < i + 1 ? Math.exp(-(posBar - i) * 1.4) : i < posBar ? 0.12 : 0;
    const big = i % 4 === 0, r0 = R - 46, r1 = R - (big ? 4 : 18);
    ctx.strokeStyle = L(0.4 + 0.55 * passed); ctx.lineWidth = big ? 5 : 3; ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.stroke();
    // numerals: the sixteen steps
    const rn = R - 100, nx = cx + Math.cos(a) * rn, ny = cy + Math.sin(a) * rn;
    G.text(ctx, passed > 0.4 ? glow : null, String(i + 1), { x: nx, y: ny, h: 27, align: 'center', color: L(0.42 + 0.55 * passed), gap: 0.1, hot: 0, glowK: 0.7 });
  }

  // ---- star polygons drawn by the ticks {16/5} and the drums {16/7}
  const star = (kind, rs, span, v0) => {
    const ev = cues.between(kind, Tc - span, Tc + 0.0005), all = cues.ev[kind];
    for (const e of ev) {
      const i = cues.idx(kind, e[0]), a0 = i > 0 ? Math.round(all[i - 1][0] / STEP) % 16 : null, a1 = Math.round(e[0] / STEP) % 16, age = Tc - e[0];
      if (a0 === null || (Tc - all[i - 1][0]) > span + 6) continue;
      const k = 1 - age / span, ka = Math.exp(-age / 0.3);
      const A = stepAngle(a0), B = stepAngle(a1);
      ctx.strokeStyle = L(v0 * k + 0.5 * ka); ctx.lineWidth = 2 + 2 * ka; ctx.beginPath();
      ctx.moveTo(cx + Math.cos(A) * rs, cy + Math.sin(A) * rs); ctx.lineTo(cx + Math.cos(B) * rs, cy + Math.sin(B) * rs); ctx.stroke();
      if (ka > 0.1) { glow.globalAlpha = ka; glow.strokeStyle = L(0.9); glow.lineWidth = 5; glow.beginPath(); glow.moveTo(cx + Math.cos(A) * rs, cy + Math.sin(A) * rs); glow.lineTo(cx + Math.cos(B) * rs, cy + Math.sin(B) * rs); glow.stroke(); glow.globalAlpha = 1; }
    }
    for (let i = 0; i < 16; i++) { const a = stepAngle(i); ctx.fillStyle = L(0.22); ctx.beginPath(); ctx.arc(cx + Math.cos(a) * rs, cy + Math.sin(a) * rs, 3.5, 0, TAU); ctx.fill(); }
  };
  star('tick', R - 120, 9, 0.5);
  star('tom', 150, 12, 0.45);

  // ---- hands
  const hand = (ang, len, tail, wid, v, glowV = 0.9) => {
    const ca = Math.cos(ang), sa = Math.sin(ang), nx = -sa, ny = ca;
    const p = new Path2D();
    p.moveTo(cx - ca * tail, cy - sa * tail);
    p.lineTo(cx + ca * len * 0.12 + nx * wid, cy + sa * len * 0.12 + ny * wid);
    p.lineTo(cx + ca * len * 0.86 + nx * wid * 0.35, cy + sa * len * 0.86 + ny * wid * 0.35);
    p.lineTo(cx + ca * len, cy + sa * len);
    p.lineTo(cx + ca * len * 0.86 - nx * wid * 0.35, cy + sa * len * 0.86 - ny * wid * 0.35);
    p.lineTo(cx + ca * len * 0.12 - nx * wid, cy + sa * len * 0.12 - ny * wid);
    p.closePath();
    ctx.fillStyle = L(v); ctx.fill(p);
    glow.globalAlpha = glowV; glow.fillStyle = L(0.85); glow.fill(p); glow.globalAlpha = 1;
  };
  const posOf = (h) => { let d = h.pos - h.prev; if (d < 0) d += 16; return h.prev + d * ease.out3(clamp(h.age / 0.14)); };
  hand(stepAngle(posOf(tm)), 210, 26, 9, 0.6, 0.5);
  hand(stepAngle(posOf(tk)), 300, 30, 8, 0.72, 0.55);
  hand(stepAngle(posBar), R - 52, 60, 10, 0.95, 0.9);
  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(cx, cy, 58, 0, TAU); ctx.fill(); ctx.strokeStyle = L(0.7); ctx.lineWidth = 3; ctx.stroke();
  G.text(ctx, glow, 'XVI', { x: cx, y: cy, h: 34, align: 'center', color: L(0.9), off: L(0.05), edge: L(0.1), gap: 0.12, hot: 0.5, glowK: 0.8 });

  plaque(C, 'MEMENTO MORI', 960, 70, { h: 38, v: 0.7, rule: false });
  G.text(ctx, null, 'TEMPUS FUGIT', { x: 960, y: 1004, h: 22, align: 'center', color: L(0.55), gap: 0.5, hot: 0 });
  G.text(ctx, null, `V  ${roman(tk.cnt)}`, { x: 200, y: 200, h: 24, color: L(0.6), gap: 0.3, hot: 0 });
  G.text(ctx, null, `VII  ${roman(tm.cnt)}`, { x: 1500, y: 800, h: 24, color: L(0.6), gap: 0.3, hot: 0 });
  C.fx.bloom = 1.05 + 0.15 * f.kickS;
  void lerp; void smooth; void sstep; void TONE; void La; void lb; void W; void H;
}
