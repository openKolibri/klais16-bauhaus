// BELFRY (bars 4-7): eight modules in eight lancet windows, a bell hanging above each one. The daisy chain of the hardware is
// a real chain along the sill: every strike sends a light along it. The bells are "rung up" - the tenor first, one more each
// bar - and the letters of KLAIS-16 appear in the windows as their bells sound (bell 1 = K ... bell 8 = 6).
import { TAU, clamp, lerp, smooth, sstep } from '../../render/util.js';
import { L, TONE, roman } from '../tone.js';
import { stone, Light, chain, bellShape, archPath, crockets, foilPath, embers } from '../ornament.js';
import { niche, plaque } from '../furniture.js';

let light = null;
const TITLE = 'KLAIS-16';

export function belfry(C) {
  const { ctx, glow, G, W, H, f, cues, Tc } = C;
  const lb = C.lbar;
  light = light || new Light(W, H);
  const n = 8, pitch = 232, x0 = 960 - 3.5 * pitch, baseY = 860, w = 212, h = 560, rise = 0.866 * w, s = 2.25, sillY = 918;

  // last strike of every bell (age), and how many strikes so far
  const age = new Float32Array(9).fill(Infinity), count = new Int32Array(9);
  for (const e of cues.between('bell', Tc - 2.5, Tc + 0.0005)) age[e[1]] = Tc - e[0];
  for (const e of cues.between('bell', C.sc.b0 * C.BAR - 0.01, Tc + 0.0005)) count[e[1]]++;

  ctx.drawImage(stone(W, H, 5, { course: 90, block: 190 }), 0, 0);

  // ---- windows
  const inner = [];
  for (let i = 0; i < n; i++) {
    const cx = x0 + i * pitch, e = Math.exp(-age[i + 1] / 0.4);
    inner.push(niche(ctx, { cx, baseY, w, h, rise, steps: 2, step: 20, v: 0.5 + 0.35 * e, hatchV: 0.15, size: 8, crock: true }));
  }
  // ---- light: every strike lights its window
  light.begin(0.09 + 0.05 * f.kick + 0.02 * Math.sin(Tc * 2.1));
  for (let i = 0; i < n; i++) { const e = Math.exp(-age[i + 1] / 0.5), cx = x0 + i * pitch; light.add(cx, 560, 330, 0.16 * (count[i + 1] ? 1 : 0.3) + 0.95 * e); }
  light.apply(ctx);

  for (let i = 0; i < n; i++) {
    const cx = x0 + i * pitch, a = age[i + 1], e = Math.exp(-a / 0.4), swing = (a < 3 ? 0.3 * Math.exp(-a / 0.9) * Math.cos(a * 8.5) * (i % 2 ? 1 : -1) : 0) + 0.03 * Math.sin(Tc * 1.7 + i * 1.3);
    ctx.fillStyle = L(0.015); ctx.fill(inner[i]);
    // a quatrefoil sound-hole over every window, lit by its bell
    { const p = foilPath(cx, baseY - h - 70, 46, 4, Math.PI / 4); ctx.fillStyle = L(0.03 + 0.4 * e); ctx.fill(p); ctx.strokeStyle = L(0.3 + 0.6 * e); ctx.lineWidth = 2.6; ctx.stroke(p); if (e > 0.05) { glow.globalAlpha = e * 0.8; glow.fillStyle = L(0.85); glow.fill(p); glow.globalAlpha = 1; } }
    bellShape(ctx, glow, cx, baseY - h + 190, { size: 1.0, angle: swing, e, v: count[i + 1] ? 0.32 : 0.16 });
    // the module with its letter
    const lit = count[i + 1] ? 0.32 + 0.6 * e : 0, my = baseY - 20 - 112.5, ch = TITLE[i];
    G.board(ctx, { x: cx, y: my, s, fill: '#000000', edge: L(0.15), screws: false });
    const lv = G.lv(G.mask(ch), new Float32Array(17));
    for (let k = 0; k < 17; k++) lv[k] *= lit;
    G.draw(ctx, glow, { x: cx, y: my, s, lv, color: L(TONE.led * 0.9), off: L(0.05), edge: L(0.1), hot: 0.55, glowK: 0.8 });
    G.text(ctx, null, roman(i + 1), { x: cx, y: sillY + 40, h: 20, align: 'center', color: L(0.4 + 0.55 * e), gap: 0.3, hot: 0 });
  }

  // ---- the chain along the sill; pulses run from the left connector to the module that just sounded
  const pulses = [];
  for (const e of cues.between('bell', Tc - 0.5, Tc + 0.0005)) { const u = (Tc - e[0]) / 0.42; if (u >= 0 && u < 1) pulses.push({ x: lerp(-40, x0 + (e[1] - 1) * pitch, smooth(u)), k: 1 - u }); }
  chain(ctx, glow, [[0, sillY], [W, sillY]], { pitch: 30, w: 15, lw: 2.6, v: 0.24, lit: (i, u) => { let m = 0; for (const p of pulses) m = Math.max(m, p.k * Math.exp(-Math.pow((u * W - p.x) / 70, 2))); return m; } });

  // motes drifting up through the belfry: the picture is never still
  embers(ctx, glow, Tc, { x0: 60, x1: W - 60, y0: 930, y1: 240, n: 46, seed: 12, life: 7, v: 0.75, size: 2.4, sway: 40 });

  // ---- inscription
  plaque(C, 'OCTO CAMPANAE', 960, 108, { h: 40, v: 0.65 });
  G.text(ctx, null, 'EIGHT MODULES  EIGHT BELLS  ONE CHAIN', { x: 960, y: 176, h: 19, align: 'center', color: L(0.5), gap: 0.4, hot: 0 });

  // the title lands as one when all eight have rung (last step of the scene)
  const all = sstep(3.86, 3.98, lb);
  C.fx.bloom = 1 + 0.5 * all + 0.1 * f.kickS;
  void TAU; void clamp; void archPath; void crockets;
}
