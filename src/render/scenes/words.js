// WORDS (bars 12-16): SIXTEEN / SEGMENT / DISPLAY - all three README title words are exactly 7 letters. One letter per 16th.
// The last bar is the riser: letters scramble, everything speeds up, the final step is a blackout before the drop.
import { P, LED, TAU, clamp, E, rgba, hash, hash2, sstep, ease } from '../util.js';
import { grid, corners, label } from '../ui.js';
import { stripRow, backdrop } from './strip.js';
import { rect, disc, ring } from '../bauhaus.js';

const WORDS = ['SIXTEEN', 'SEGMENT', 'DISPLAY'];
const CW = 240, N = 7, X0 = 120, CY = 470;

export function words(C) {
  const { ctx, glow, G, W, H, f, cues, Tc, STEP, BAR } = C;
  const lb = C.lbar, bar = Math.floor(lb), b = C.bar - Math.floor(C.bar), step = Math.floor(b * 16);
  const wi = Math.min(2, bar);
  const last = bar === 3;                  // bar 15: riser
  const word = WORDS[wi % 3];
  grid(C, { alpha: 0.03 });
  // shapes: change variant every bar
  const variant = last ? 2 : wi % 2 === 0 ? 1 : 0;
  backdrop(C, 1, variant);

  const cells = [];
  for (let i = 0; i < N; i++) {
    let ch = word[i], vis = step >= i ? 1 : 0, pop = 0;
    if (!last) {
      const t = (bar * 16 + i) * STEP + 12 * BAR;                       // absolute reveal time of letter i
      const age = Tc - t; vis = age >= 0 ? 1 : 0; pop = vis ? Math.exp(-age / 0.12) : 0;
    } else {
      // riser: scramble faster and faster, converge to full lit "8" on steps 12-14
      const sc = Math.floor(C.step * (1 + 3 * b));
      ch = step >= 12 ? '8' : String.fromCharCode(48 + Math.floor(hash2(sc, i) * 42));
      vis = 1; pop = f.kick * 0.6;
    }
    cells.push({ ch, color: LED[(i + wi * 2) % 5], alpha: (vis ? 1 : 0) * (1 + 0.5 * pop), glowK: 1 + 1.5 * pop, dp: last && step >= 12 });
  }
  const blackout = last && step >= 15;
  ctx.save();
  if (last && step >= 12) ctx.translate((hash(step * 7 + Math.floor(Tc * 60)) - 0.5) * 8, 0);
  stripRow(C, { cy: CY, x0: X0, cells, cw: CW, n: N, dim: blackout ? 0 : 1 });
  ctx.restore();

  label(C, last ? 'READY' : word, 96, 760, 30, rgba(P.WHT, 1), { glowK: 0.5 });
  label(C, `${wi + 1}/3`, 96, 806, 20, rgba(P.WHT, 0.55));
  C.fx.glitch = last ? clamp((b - 0.45) * 1.3) : 0;
  C.fx.bloom = 1;
  if (blackout) { ctx.fillStyle = P.INK; ctx.fillRect(0, 0, W, H); glow.clearRect(0, 0, W, H); }
}
