// Gothic edition page: the shared engine plus the red-only frame context, scene timeline and post chain.
import { run, W, H } from '../render/engine.js';
import { makeFrame } from './frame.js';
import { drawTimeline } from './timeline.js';
import { grade, La } from './tone.js';

const mk = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });

run({
  cuesUrl: '../../build/gothic/cues.json',
  ink: '#000000',
  ctxOptions: { alpha: false, willReadFrequently: true }, // the final grade reads the whole frame back
  makeFrame,
  drawScene: drawTimeline,
  init(env) {
    // a heavy vignette: the corners of the nave stay in the dark
    const v = mk(W, H), c = v.getContext('2d'), g = c.createRadialGradient(W / 2, H / 2, H * 0.34, W / 2, H / 2, H * 1.0);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.65, 'rgba(0,0,0,0.42)'); g.addColorStop(1, 'rgba(0,0,0,0.88)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    env.vig = v;
  },
  finish(C, { ctx, glowC, post, vig, T, fps }) {
    const bm = C.fx.bloom * C.fx.bloomMul;
    if (bm > 0.01) post.bloom(ctx, glowC, { k1: 0.5 * bm, k2: 0.5 * bm, k3: 0.42 * bm });
    ctx.drawImage(vig, 0, 0);
    if (C.fx.glitch > 0) post.glitch(ctx, Math.floor(T * fps), C.fx.glitch);
    if (C.fx.flash > 0) { ctx.fillStyle = La(1, Math.min(0.5, C.fx.flash)); ctx.fillRect(0, 0, W, H); }
    if (C.fx.fade > 0) { ctx.fillStyle = `rgba(0,0,0,${Math.min(1, C.fx.fade)})`; ctx.fillRect(0, 0, W, H); }
    grade(ctx, W, H);
  },
});
