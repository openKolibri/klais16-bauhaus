// KALEIDO: KLAIS-16 as a ring of eight glyphs that snaps 22.5 degrees on every beat, over counter-rotating
// Bauhaus rings and sun rays. Inner hub = the 16-step dial. Reused in the second drop with a different palette.
import { P, LED, TAU, clamp, E, rgba, mix, hash, hash2, ease, sstep, frac } from '../util.js';
import { grid, corners, label } from '../ui.js';
import { disc, ring, tri, arcBand, pie } from '../bauhaus.js';
import { camera } from './wall.js';

const TXT = 'KLAIS-16';

export function kaleido({ ringCols = [P.RED, P.YEL, P.BLU, P.WHT], text = TXT, dir = 1, mono = false } = {}) {
  return function draw(C) {
    const { ctx, glow, G, W, H, f, cues, Tc, BAR } = C;
    const cx = W / 2, cy = H / 2, beat = C.beat, bI = Math.floor(beat), bF = frac(beat);
    const snap = (bI + ease.io3(clamp(bF * 1.6))) * (Math.PI / 8) * dir;   // 22.5deg per beat
    const lb = C.lbar, k = E('outBack', lb / 0.3);
    const pulse = 1 + 0.045 * f.kick;
    // ---- sun rays (16 = one per step)
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-snap * 0.5);
    for (let i = 0; i < 16; i++) {
      const a0 = (i / 16) * TAU, a1 = a0 + TAU / 16;
      ctx.fillStyle = i % 2 ? rgba(ringCols[(i >> 1) % 4], 0.16 + 0.1 * f.kick) : rgba('#000', 0);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 1400, a0, a1); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // ---- concentric bands
    const bands = [[760, 700], [640, 610], [520, 500]];
    bands.forEach(([r1, r0], i) => {
      const c = ringCols[(i + bI) % 4], a = -snap * (i % 2 ? -0.7 : 0.7) + i;
      arcBand(ctx, cx, cy, r0 * k, r1 * k * pulse, a, a + TAU * (0.55 + 0.1 * i), c, 0.9);
      arcBand(ctx, cx, cy, r0 * k, r1 * k * pulse, a + Math.PI, a + Math.PI + TAU * 0.18, ringCols[(i + bI + 2) % 4], 0.9);
    });
    ring(ctx, cx, cy, 800 * k, 3, rgba(P.WHT, 0.35));
    // ---- the ring of glyphs
    const n = text.length, R = 335 * k * pulse, gs = 3.6, gh = G.H * gs, gw = G.W * gs;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + snap - Math.PI / 2, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
      const c = mono ? P.WHT : LED[(i + bI) % 5];
      ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2);
      ctx.fillStyle = 'rgba(6,6,10,0.94)'; ctx.fillRect(-gw / 2 - 8, -gh / 2 - 8, gw + 16, gh + 16);
      ctx.strokeStyle = rgba(c, 0.8); ctx.lineWidth = 3; ctx.strokeRect(-gw / 2 - 8, -gh / 2 - 8, gw + 16, gh + 16);
      ctx.restore();
      const lv = G.lvChar(text[i]);
      const flash = 1 + 0.5 * (i === (Math.floor(C.step) % n) ? 1 : 0) + 0.3 * f.kick;
      for (let j = 0; j < 17; j++) lv[j] *= Math.min(1.4, flash);
      G.draw(ctx, glow, { x, y, s: gs, lv, color: c, rot: a + Math.PI / 2, off: '#12131a', edge: '#20222c', hot: 0.4, glowK: 1 });
    }
    // ---- hub: 16-step dial
    disc(ctx, cx, cy, 165 * k * pulse, P.INK);
    ring(ctx, cx, cy, 165 * k * pulse, 5, P.WHT);
    const stepI = Math.floor(C.step) % 16;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU - Math.PI / 2, r = 118 * k, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r, cur = i === stepI, past = ((stepI - i + 16) % 16) < 4;
      const c = LED[i % 5];
      ctx.fillStyle = cur ? P.WHT : past ? c : 'rgba(244,236,220,0.16)'; ctx.beginPath(); ctx.arc(x, y, cur ? 15 : 9, 0, TAU); ctx.fill();
      if (cur || past) { glow.fillStyle = cur ? P.WHT : c; glow.globalAlpha = cur ? 1 : 0.5; glow.beginPath(); glow.arc(x, y, cur ? 20 : 11, 0, TAU); glow.fill(); glow.globalAlpha = 1; }
    }
    // centre glyph: the step counter in hex
    G.text(ctx, glow, stepI.toString(16).toUpperCase(), { x: cx, y: cy, h: 120, align: 'center', color: P.WHT, glowK: 0.7, hot: 0.2, off: 'rgba(255,255,255,0.05)' });
    C.fx.bloom = 1;
  };
}
