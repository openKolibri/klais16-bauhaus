// MARQUEE: bytes pushed through the daisy chain, one per eighth note. Each push shifts everything one module along
// and the array latches at once - a text marquee, exactly how a real Klais array scrolls. Used for the outro URL.
import { P, LED, TAU, clamp, E, rgba, mix, hash, hex2, sstep, ease, lerp } from '../util.js';
import { grid, label } from '../ui.js';
import { stripRow, backdrop } from './strip.js';
import { rect, disc } from '../bauhaus.js';

const URL = 'GITHUB.COM/OPENKOLIBRI/KLAIS-16';

export function marquee({ text = URL, variant = 2, tail = false } = {}) {
  return function draw(C) {
    const { ctx, glow, G, W, H, f, cues, Tc, BAR, BEAT } = C;
    const lb = C.lbar, len = C.sc.b1 - C.sc.b0;
    const eighth = BAR / 8, k = Math.floor((Tc - C.sc.b0 * BAR) / eighth) + 1;         // characters pushed so far
    const kk = clamp(k, 0, text.length), n = 8;
    grid(C, { alpha: 0.03 });
    backdrop(C, 1, variant);
    const cells = [];
    for (let i = 0; i < n; i++) {
      const idx = kk - n + i;                                   // window of the last 8 pushed characters
      const ch = idx >= 0 && idx < text.length ? text[idx] : ' ';
      const age = Tc - (C.sc.b0 * BAR + (idx + 1 - 1) * eighth);
      const pop = idx >= 0 ? Math.exp(-Math.max(0, age) / 0.14) : 0;
      cells.push({ ch, color: LED[((idx % 5) + 5) % 5], glowK: 1 + 1.2 * pop, alpha: 1 + 0.35 * pop });
    }
    const finalHold = kk >= text.length;
    stripRow(C, { cy: 470, cells, dim: 1 });
    // typed caption
    const shown = text.slice(0, kk);
    const cwid = 40, capY = 780;
    label(C, shown, 96, capY, 58, P.WHT, { glowK: 0.55, gap: 0.22 });
    // cursor
    const wcap = G.textWidth(shown, 58, 0.22), on = Math.floor(C.beat * 2) % 2 === 0 || !finalHold;
    if (on) { ctx.fillStyle = P.YEL; ctx.fillRect(96 + wcap + 14, capY - 28, 24, 56); }
    label(C, 'OPENKOLIBRI', 96, 900, 22, rgba(P.WHT, 0.0), { glowK: 0 });
    if (kk > 0) {
      const b = text.charCodeAt(kk - 1);
      label(C, `TX ${hex2(b)}`, W - 96, 120, 26, P.WHT, { align: 'right', glowK: 0.4 });
      label(C, `${kk}/${text.length} BYTES`, W - 96, 160, 20, rgba(P.WHT, 0.8), { align: 'right' });
    }
    C.fx.bloom = 1;
  };
}
