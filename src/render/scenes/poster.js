// POSTER (bars 56-60): the spec sheet as a Mondrian-style Bauhaus poster. Every number is straight from the README.
import { P, LED, TAU, clamp, E, rgba, mix, hash, sstep, ease } from '../util.js';
import { label } from '../ui.js';
import { disc, ring, half, quarter, rect, tri, stripes, ruler, dots } from '../bauhaus.js';

// [x, y, w, h, start (bars), colour]
const TILES = [
  { id: 'title', x: 0, y: 0, w: 1180, h: 640, t: 0.0, col: P.INK },
  { id: 'leds', x: 1180, y: 0, w: 740, h: 400, t: 0.5, col: P.RED },
  { id: 'segs', x: 1180, y: 400, w: 370, h: 240, t: 1.0, col: P.YEL },
  { id: 'volt', x: 1550, y: 400, w: 370, h: 240, t: 1.25, col: P.BLU },
  { id: 'size', x: 0, y: 640, w: 700, h: 440, t: 1.5, col: P.WHT },
  { id: 'lic', x: 700, y: 640, w: 1220, h: 440, t: 2.0, col: P.INK },
];

export function poster(C) {
  const { ctx, glow, G, W, H, f, cues, Tc, BAR } = C;
  const lb = C.lbar, out = sstep(3.55, 3.98, lb);
  ctx.save();
  for (const T of TILES) {
    const u = ease.out3(clamp((lb - T.t * 0.5) / 0.28)), a = 1 - out;
    if (u <= 0) continue;
    const pulse = 1 + 0.012 * f.kick;
    const w = T.w * u, x = T.id === 'title' || T.id === 'size' || T.id === 'lic' ? T.x : T.x + T.w - w;
    ctx.fillStyle = mix(P.INK, T.col, T.col === P.INK ? 0 : 0.92); ctx.fillRect(x, T.y, w + 1, T.h + 1);
    ctx.fillStyle = P.INK; ctx.fillRect(x, T.y, w, 6); ctx.fillRect(x, T.y, 6, T.h);
  }
  ctx.restore();
  const I = P.INK;
  // ---- title tile: KLAIS-16 in eight panels
  { const T = TILES[0], u = clamp((lb - 0.1) / 0.3);
    const cw = 130, s = cw / G.W, ch = G.H * s, x0 = 40, y0 = 150;
    const txt = 'KLAIS-16', lv = new Float32Array(17);
    for (let i = 0; i < 8; i++) {
      const cx = x0 + cw * (i + 0.5), on = clamp((lb - 0.1 - i * 0.03) / 0.08);
      ctx.fillStyle = '#0a0a0e'; ctx.fillRect(cx - cw / 2, y0, cw, ch);
      G.lv(G.mask(txt[i]), lv); for (let k = 0; k < 17; k++) lv[k] *= on * (1 + 0.35 * f.kick);
      G.draw(ctx, glow, { x: cx, y: y0 + ch / 2, s, lv, color: LED[i % 5], off: '#101116', edge: '#1b1d26', hot: 0.4, glowK: 1 });
    }
    label(C, 'SIXTEEN SEGMENT DISPLAY', 44, 82, 34, rgba(P.WHT, u), { glowK: 0.4 });
    label(C, 'THE KLAIS DISPLAY SERIES', 44, 570, 24, rgba(P.WHT, 0.8 * u));
    label(C, 'BY KOLIBRI', 44, 606, 20, rgba(P.WHT, 0.5 * u));
    rect(ctx, 1080, 40 * u, 40, 520 * u, P.RED);
  }
  const big = (id, text, sub, col, hh = 190) => {
    const T = TILES.find((t) => t.id === id), u = ease.out3(clamp((lb - T.t * 0.5) / 0.28));
    if (u < 0.6) return;
    label(C, text, T.x + 48, T.y + T.h / 2 - 20, hh, col, { glowK: 0, gap: 0.25 });
    label(C, sub, T.x + 52, T.y + T.h - 56, 26, col, { glowK: 0 });
  };
  big('leds', '128', 'LEDS  0603  KT-0603R', I);
  big('segs', '16', 'SEGMENTS + DP', I, 130);
  big('volt', '5V', '1.6 W MAX', P.WHT, 130);
  big('size', '5.8', 'MM THIN', I, 150);
  label(C, '100 X 66.66 MM', 48, 690, 24, I, { glowK: 0 });
  // ---- licence tile
  { const T = TILES[5], u = ease.out3(clamp((lb - 1.0) / 0.28));
    if (u > 0.6) {
      label(C, 'OPEN HARDWARE', T.x + 48, T.y + 90, 74, P.WHT, { glowK: 0.5, gap: 0.25 });
      const rows = [['HARDWARE', 'CERN-OHL-S 2.0', P.RED], ['FIRMWARE', 'GNU GPL 3.0', P.YEL], ['DOCS', 'CC BY-SA 4.0', P.BLU]];
      rows.forEach(([a, b, c], i) => {
        const y = T.y + 210 + i * 62;
        rect(ctx, T.x + 48, y - 22, 26, 44, c);
        label(C, a, T.x + 98, y, 24, rgba(P.WHT, 0.6));
        label(C, b, T.x + 350, y, 34, P.WHT, { glowK: 0.4 });
      });
      label(C, 'SAWAIZ SYED / KOLIBRI', T.x + 48, T.y + 410, 20, rgba(P.WHT, 0.5));
    }
  }
  // ---- Bauhaus accents on the tiles
  const k = ease.outBack(clamp((lb - 0.9) / 0.4));
  quarter(ctx, W, 0, 210 * k, Math.PI / 2, I); ring(ctx, W, 0, 250 * k, 5, I);
  quarter(ctx, 700, 1080, 200 * k, Math.PI, P.BLU);
  tri(ctx, 560, 830, 90 * k, -Math.PI / 2, P.RED);
  dots(ctx, 1500, 770, 9, 3, 40, 6, rgba(P.WHT, 0.55), { alpha: k });
  // fade out (transition into the URL scene)
  if (out > 0) { ctx.fillStyle = rgba(P.INK, out); ctx.fillRect(0, 0, W, H); }
  C.fx.bloom = 0.8;
  C.fx.glitch = out > 0 ? out * 0.7 : 0;
}
