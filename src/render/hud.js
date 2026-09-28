// Minimal HUD: a 16-step sequencer bar (the display *is* the sequencer), bar counter and tempo.
import { P, rgba, clamp, E } from './util.js';

/** which steps of the current bar carried an event of `kind` (array of 16 booleans) */
export function stepHits(C, kind, barIdx) {
  const { cues } = C, t0 = barIdx * cues.BAR, out = new Array(16).fill(0);
  for (const e of cues.between(kind, t0 - 0.004, t0 + cues.BAR - 0.004)) out[Math.min(15, Math.max(0, Math.round((e[0] - t0) / cues.STEP)))] = e[1] ?? 1;
  return out;
}

export function drawHud(C, { alpha = 1, col = P.WHT, steps = true } = {}) {
  const { ctx, glow, G, cues, W, H } = C;
  if (alpha <= 0.01) return;
  const barIdx = Math.floor(C.bar), stepIdx = Math.floor((C.bar - barIdx) * 16 + 1e-6);
  const sw = 20, gap = 8, total = 16 * sw + 15 * gap, x0 = W / 2 - total / 2, y0 = H - 46;
  const kick = stepHits(C, 'kick', barIdx), hat = stepHits(C, 'hatC', barIdx), clap = stepHits(C, 'clap', barIdx), acid = stepHits(C, 'acid', barIdx);
  ctx.save(); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = 'difference';
  for (let i = 0; steps && i < 16; i++) {
    const x = x0 + i * (sw + gap), cur = i === stepIdx, past = i < stepIdx;
    ctx.fillStyle = cur ? col : past ? 'rgba(244,236,220,0.26)' : 'rgba(244,236,220,0.10)';
    ctx.fillRect(x, y0, sw, 8);
    // per-instrument dots above the step
    if (kick[i]) { ctx.fillStyle = P.RED; ctx.fillRect(x + 2, y0 - 12, sw - 4, 5); }
    if (clap[i]) { ctx.fillStyle = P.YEL; ctx.fillRect(x + 2, y0 - 20, sw - 4, 5); }
    if (acid[i]) { ctx.fillStyle = P.BLU; ctx.fillRect(x + 2, y0 - 28, sw - 4, 5); }
  }
  ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'difference';
  // counters in segment font
  const bs = `${String(barIdx + 1).padStart(3, '0')}`;
  G.text(ctx, null, 'BAR ' + bs + '.' + (Math.floor((C.bar - barIdx) * 4) + 1), { x: W - 48, y: 44, h: 26, align: 'right', color: rgba(col, 0.85 * alpha), gap: 0.3, hot: 0 });
  G.text(ctx, null, `${cues.bpm} BPM`, { x: 48, y: H - 42, h: 22, color: rgba(col, 0.6 * alpha), gap: 0.3, hot: 0 });
  G.text(ctx, null, 'F PHRYGIAN', { x: W - 48, y: H - 42, h: 22, align: 'right', color: rgba(col, 0.5 * alpha), gap: 0.3, hot: 0 });
  ctx.restore();
}
