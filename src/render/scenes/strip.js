// STRIP scenes: a row of 8 modules (each 240 x 360 = exactly a 2:3 panel) - the daisy chain from the README.
// Firmware behaviour reproduced literally: every received byte pushes the byte a module holds on to the next
// module (a shift register), and all displays latch together once the data pauses (the "timeout refresh").
import { P, LED, TAU, clamp, E, rgba, mix, hash, hash2, hex2, smooth, sstep, lerp } from '../util.js';
import { grid, corners, label } from '../ui.js';
import { disc, ring, half, quarter, tri, rtri, rect, bar, line, ruler, stripes, dots, arrow, reg } from '../bauhaus.js';
import { camera } from './wall.js';

const N = 8, CW = 240, CH = 360;

/** draw a row of modules. cells[i] = { ch | lv, color, alpha, glowK, inv, boardAlpha } */
export function stripRow(C, { cy, cells, x0 = 0, cw = CW, n = cells.length, dim = 1, scan = null }) {
  const { ctx, glow, G } = C, s = cw / G.W, ch = G.H * s, lv = new Float32Array(17);
  for (let i = 0; i < n; i++) {
    const c = cells[i]; if (!c) continue;
    const cx = x0 + cw * (i + 0.5);
    if (c.boardAlpha !== undefined && c.boardAlpha <= 0.01) continue;
    ctx.save(); ctx.globalAlpha = c.boardAlpha ?? 1; ctx.fillStyle = '#09090e'; ctx.fillRect(cx - cw / 2, cy - ch / 2, cw + 1, ch); ctx.restore();
    if (c.lv) lv.set(c.lv); else G.lv(G.mask(c.ch || ' '), lv);
    let g = 1;
    if (scan) g = 0.72 + 0.5 * Math.exp(-(((cx - scan.x) / scan.w) ** 2));
    for (let k = 0; k < 17; k++) lv[k] = (c.inv ? 1 - lv[k] : lv[k]) * (c.alpha ?? 1) * dim * g;
    if (c.inv) lv[16] = 0;
    if (c.dp) lv[16] = 1;
    G.draw(ctx, glow, { x: cx, y: cy, s, lv, color: c.color || P.RED, off: '#12131a', edge: '#20222c', hot: 0.4, glowK: (c.glowK ?? 1) * 0.95, alpha: c.boardAlpha ?? 1 });
  }
  // seams
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  for (let i = 1; i < n; i++) ctx.fillRect(x0 + i * cw - 1, cy - ch / 2, 2, ch);
  ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(x0, cy - ch / 2, cw * n, 2); ctx.fillRect(x0, cy + ch / 2 - 2, cw * n, 2);
}

/** Bauhaus backdrop above and below the strip; `u` = 0..1 build-in, beat-driven drift */
export function backdrop(C, u, variant = 0) {
  const { ctx, glow, W, H, f, beat } = C, k = E('outBack', u), pulse = 1 + 0.03 * f.kick;
  const b4 = beat / 4;
  ctx.save();
  if (variant === 0) {
    disc(ctx, 230, 60, 330 * k * pulse, P.RED);
    ring(ctx, 230, 60, 400 * k * pulse, 6, rgba(P.WHT, 0.5));
    // yellow right triangle, top right
    rtri(ctx, W - 520 * k, 0, 520 * k, 290, P.YEL);
    // blue half disc bottom
    half(ctx, 1560, H + 30, 430 * k, -Math.PI / 2, P.BLU);
    disc(ctx, 1560, H + 30, 250 * k, P.INK);
    disc(ctx, 1560, H + 30, 170 * k, P.WHT);
    // ruled bar bottom-left
    rect(ctx, 96, 790, 760 * k, 26, P.WHT);
    ruler(ctx, 96, 826, 760 * k, 38, rgba(P.WHT, 0.8), { major: 5, tick: 14, w: 3 });
    rect(ctx, 96, 900, 90 * k, 90 * k, P.GRN);
    // vertical stripes
    ctx.save(); ctx.beginPath(); ctx.arc(1010, 880, 170 * k, 0, TAU); ctx.clip();
    stripes(ctx, 840, 710, 340, 340, 9, P.YEL, { angle: -Math.PI / 4, duty: 0.5, phase: b4 }); ctx.restore();
    ring(ctx, 1010, 880, 170 * k, 6, P.WHT);
    // small dots grid top centre
    dots(ctx, 700, 70, 9, 3, 34, 6, rgba(P.WHT, 0.7), { alpha: k });
  } else if (variant === 1) {
    disc(ctx, W - 250, 90, 300 * k * pulse, P.BLU);
    disc(ctx, W - 250, 90, 190 * k, P.YEL);
    quarter(ctx, 0, 0, 520 * k, 0, P.RED);
    rect(ctx, 0, 850, 1000 * k, 40, P.YEL);
    rect(ctx, 0, 910, 640 * k, 40, P.WHT);
    tri(ctx, 1450, 900, 210 * k, -Math.PI / 2 + (b4 % 1) * TAU / 3, P.GRN);
    ctx.save(); ctx.beginPath(); ctx.arc(900, 150, 120 * k, 0, TAU); ctx.clip();
    stripes(ctx, 780, 30, 240, 240, 10, P.WHT, { angle: 0, duty: 0.45, phase: -b4 }); ctx.restore();
  } else {
    // variant 2: cool, sparse
    half(ctx, 300, 0, 300 * k, Math.PI / 2, P.YEL);
    disc(ctx, 1700, 120, 190 * k, P.RED);
    rect(ctx, 1250, 60, 20, 190 * k, P.WHT);
    quarter(ctx, W, H, 560 * k, Math.PI, P.BLU);
    rect(ctx, 0, 890, 900 * k, 24, P.RED);
    dots(ctx, 620, 70, 9, 3, 36, 7, rgba(P.YEL, 0.9), { alpha: k });
  }
  ctx.restore();
}

// ----------------------------------------------------------------------------------------------------------
// chain + title: bars 3..6
// ----------------------------------------------------------------------------------------------------------
const TITLE = 'KLAIS-16';
export function chainTitle(C) {
  const { ctx, glow, G, W, H, f, cues, Tc, BAR } = C;
  const lb = C.lbar, cy = 470, bus = cy + CH / 2 + 78;
  const latch = lb >= 1;
  grid(C, { alpha: 0.03 });
  const pre = clamp(lb / 1);

  // -- backdrop shapes burst in at the latch
  const shapes = clamp((lb - 1.0) / 0.55);
  if (shapes > 0) backdrop(C, shapes, 0);

  // -- modules power up left to right in the first tenth of a bar
  const cells = [];
  for (let i = 0; i < N; i++) {
    const on = clamp((lb - 0.03 - i * 0.035) / 0.06);
    const since = latch ? Tc - 1 * BAR - 3 * BAR : 0; // seconds since latch (bar 4.0)
    const pop = latch ? Math.exp(-(since - 0.0) / 0.22) : 0;
    cells.push({ ch: latch ? TITLE[i] : ' ', color: LED[i % 5], boardAlpha: on, alpha: latch ? 1 + 0.6 * pop : 1, glowK: 1 + 1.6 * pop, dp: !latch && on > 0 && (Math.floor(Tc / (BAR / 8)) + i) % 8 === 0 });
  }
  // scan band after the latch
  const scanX = latch ? (((C.bar - 4) % 1) * (W + 400)) - 200 : -999;
  stripRow(C, { cy, cells, scan: latch ? { x: scanX, w: 170 } : null });
  // -- data bus with tokens (before the latch)
  if (lb < 1.35) {
    const fade = 1 - sstep(1.0, 1.35, lb);
    ctx.save(); ctx.globalAlpha = fade;
    const busU = E('out4', (lb - 0.06) / 0.3);
    rect(ctx, 0, bus - 3, W * busU, 6, P.GREY);
    for (let i = 0; i < N; i++) {
      const x = CW * (i + 0.5), u = clamp((lb - 0.1 - i * 0.02) / 0.1);
      rect(ctx, x - 3, cy + CH / 2, 6, (bus - cy - CH / 2) * u, P.GREY);
      disc(ctx, x, bus, 9 * u, P.GREY);
    }
    ctx.restore();
    // tokens: sent in reverse so the string reads correctly once shifted through the chain
    const send = [...TITLE].reverse();
    const t0 = 3 * BAR + 0.32 * BAR, dt = BAR * 0.075;
    ctx.save(); ctx.globalAlpha = fade;
    for (let j = 0; j < 8; j++) {
      const tj = t0 + j * dt;
      if (Tc < tj) continue;
      // number of later sends -> module index, each shift eases over 0.12 bar
      let pos = 0;
      for (let m = j + 1; m < 8; m++) { const tm = t0 + m * dt; pos += E('io3', (Tc - tm) / (BAR * 0.06)); }
      const x = lerp(-70, CW * 0.5, E('out3', (Tc - tj) / (BAR * 0.06))) + pos * CW;
      const code = send[j].charCodeAt(0), c = LED[(7 - j) % 5];
      // token
      ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(x - 44, bus - 64, 88, 40, 8); ctx.fill();
      glow.fillStyle = c; glow.globalAlpha = 0.5; glow.beginPath(); glow.roundRect(x - 44, bus - 64, 88, 40, 8); glow.fill(); glow.globalAlpha = 1;
      label(C, hex2(code), x, bus - 44, 22, P.INK, { align: 'center', glowK: 0, gap: 0.25 });
      // the character it carries, drawn in a mini glyph
      G.text(ctx, glow, send[j], { x, y: bus - 92, h: 40, align: 'center', color: c, glowK: 0.6 });
    }
    ctx.restore();
    label(C, 'TX > RX  115200 8N1', 72, bus + 60, 22, rgba(P.WHT, 0.6 * fade));
    label(C, lb > 0.86 && lb < 1 ? 'TIMEOUT 1 MS ...' : lb >= 1 ? '' : 'SHIFTING BYTES', W - 72, bus + 60, 22, rgba(lb > 0.86 ? P.YEL : P.WHT, 0.8 * fade), { align: 'right' });
  }
  // -- title captions after the latch
  if (latch) {
    const u = clamp((lb - 1.15) / 0.4);
    label(C, 'SIXTEEN SEGMENT DISPLAY', 96, 740, 30, rgba(P.WHT, u), { glowK: 0.5 });
    label(C, 'OPEN HARDWARE / 5V / 128 LEDS', 96, 890 + 40, 22, rgba(P.INK, u * 0.0), { glowK: 0 });
  }
  C.fx.bloom = 1;
  C.fx.flash = latch ? 0.28 * Math.exp(-(Tc - 4 * BAR) / 0.06) : 0;
}
