// SEQUENCER: the display *is* the sequencer. Four colourways of the product (SEG-16-RED / YEL / BLU / WHT), each module
// lighting segment i when its instrument has a hit on step i of the bar. Segment order A..U = step 1..16.
import { P, LED, TAU, clamp, E, rgba, mix, hash, sstep, ease } from '../util.js';
import { SEG_NAMES } from '../glyph.js';
import { stepHits } from '../hud.js';
import { grid, corners, label } from '../ui.js';
import { rect, disc, ring, half, quarter } from '../bauhaus.js';
import { camera } from './wall.js';

const TRACKS = [
  { name: 'KICK', kind: 'kick', col: P.RED, code: 'RED', env: 'kick' },
  { name: 'HATS', kind: 'hatC', col: P.YEL, code: 'YEL', env: 'hat' },
  { name: 'ACID', kind: 'acid', col: P.BLU, code: 'BLU', env: 'acid' },
  { name: 'STAB', kind: 'stab', col: P.WHT, code: 'WHT', env: 'stab' },
];

export function sequencer(C) {
  const { ctx, glow, G, W, H, f, cues, Tc, STEP, BAR } = C;
  const barI = Math.floor(C.bar), stepI = Math.floor((C.bar - barI) * 16 + 1e-6), sub = (C.bar - barI) * 16 - stepI;
  const lb = C.lbar, colW = W / 4;
  const lv = new Float32Array(17);
  TRACKS.forEach((t, i) => {
    const x = i * colW, cx = x + colW / 2, on = E('outBack', (lb - i * 0.05) / 0.22);
    const hits = stepHits(C, t.kind, barI);
    const e = f[t.env] ?? 0;
    // colour block
    ctx.fillStyle = mix(P.INK, t.col, 0.72 + 0.28 * e * 0.5); ctx.fillRect(x, H - H * on, colW + 1, H * on);
    // big Bauhaus accents on each band
    const accent = [() => disc(ctx, cx, 120, 70 * on, P.INK), () => quarter(ctx, x, H, 130 * on, -Math.PI / 2, P.INK), () => rect(ctx, cx - 10, 60, 20, 90 * on, P.INK), () => half(ctx, cx, 90, 68 * on, Math.PI / 2, P.INK)][i];
    accent();
    // module
    const s = 4.7, by = 566;
    ctx.save(); ctx.translate(cx, by); const z = 1 + 0.03 * e; ctx.scale(z, z); ctx.translate(-cx, -by);
    G.board(ctx, { x: cx, y: by, s, fill: '#0a0a0e', edge: mix('#000', t.col, 0.5) });
    for (let k = 0; k < 16; k++) lv[k] = hits[k] ? 0.95 : 0;
    lv[16] = stepI === 0 ? 1 : 0;
    const cur = stepI;
    lv[cur] = hits[cur] ? 1.35 : 0.5;
    const colors = new Array(17).fill(t.col); colors[cur] = P.WHT;
    G.draw(ctx, glow, { x: cx, y: by, s, lv, colors, off: '#13141a', edge: '#242631', hot: 0.4, glowK: 1 });
    ctx.restore();
    // labels
    label(C, t.name, cx, 222, 56, P.INK, { align: 'center', glowK: 0, gap: 0.22 });
    label(C, `SEG-16-${t.code}-MDNT`, cx, 908, 20, P.INK, { align: 'center', glowK: 0 });
    // step squares: the 16-step pattern
    const sw = 17, gap = 5, tot = 16 * sw + 15 * gap, sx = cx - tot / 2;
    for (let k = 0; k < 16; k++) {
      const xx = sx + k * (sw + gap);
      ctx.fillStyle = hits[k] ? P.INK : 'rgba(6,6,10,0.28)'; ctx.fillRect(xx, 972, sw, 28);
      if (k === cur) { ctx.strokeStyle = P.INK; ctx.lineWidth = 4; ctx.strokeRect(xx - 3, 969, sw + 6, 34); }
    }
    label(C, SEG_NAMES[cur], cx, 942, 24, P.INK, { align: 'center', glowK: 0 });
  });
  // thin dividers
  ctx.fillStyle = P.INK; for (let i = 1; i < 4; i++) ctx.fillRect(i * colW - 3, 0, 6, H);
  C.fx.bloom = 0.9;
}
