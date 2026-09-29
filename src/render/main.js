// Bauhaus edition page: the shared engine plus this edition's frame context, scene timeline and post chain.
import { P } from './util.js';
import { makeFrame } from './frame.js';
import { drawTimeline } from './timeline.js';
import { W, H, run } from './engine.js';

run({
  cuesUrl: '../../build/cues.json',
  ink: P.INK,
  makeFrame,
  drawScene: drawTimeline,
  finish(C, { ctx, glowC, post, params, T, fps }) {
    const bm = C.fx.bloom * C.fx.bloomMul;
    if (bm > 0.01) post.bloom(ctx, glowC, { k1: 0.42 * bm, k2: 0.4 * bm, k3: 0.3 * bm });
    post.finish(ctx, { scan: params.has('scan') });
    if (C.fx.glitch > 0) post.glitch(ctx, Math.floor(T * fps), C.fx.glitch);
    if (C.fx.split > 0) post.rgbSplit(ctx, C.fx.split);
    if (C.fx.flash > 0) { ctx.fillStyle = `rgba(255,250,240,${Math.min(0.5, C.fx.flash)})`; ctx.fillRect(0, 0, W, H); }
  },
});
