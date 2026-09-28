// END (bar 64): the last bar. The array holds "KLAIS-16"; the decimal points blink once and the panel powers down.
import { P, LED, clamp, E, rgba, sstep } from '../util.js';
import { stripRow } from './strip.js';
import { label, grid } from '../ui.js';

export function end(C) {
  const { ctx, glow, G, W, H, f, cues, Tc, BAR, STEP } = C;
  const lb = C.lbar, fade = 1 - sstep(0.35, 0.95, lb);
  grid(C, { alpha: 0.03 * fade });
  const txt = 'KLAIS-16', cells = [];
  for (let i = 0; i < 8; i++) {
    const dpBlink = lb > 0.06 && lb < 0.3 ? Math.floor((lb - 0.06) / 0.08) % 2 === 0 : false;
    cells.push({ ch: txt[i], color: LED[i % 5], alpha: fade * (1 + 0.4 * f.kick), dp: dpBlink });
  }
  stripRow(C, { cy: 470, cells, dim: 1 });
  label(C, 'GITHUB.COM/OPENKOLIBRI/KLAIS-16', 96, 790, 58, rgba(P.WHT, fade), { glowK: 0.5, gap: 0.22 });
  label(C, 'THANK YOU FOR SCANNING', 96, 880, 24, rgba(P.WHT, 0.0), { glowK: 0 });
  C.fx.bloom = 1;
}
