// BOOT (bars 0-3): one module powers up. Underline LEDs, DP, then the 16-segment self-test - one chirp, one segment.
// Then the brightness ladder (TM1640 codes 0x88..0x8F) and a blackout before the daisy chain appears.
import { P, LED, TAU, clamp, E, rgba, hash, hex2, smooth, sstep } from '../util.js';
import { SEG_NAMES } from '../glyph.js';
import { grid, corners, label, bits } from '../ui.js';
import { ring, disc, line, rect } from '../bauhaus.js';
import { camera } from './wall.js';

const LEVELS = [1, 2, 4, 10, 11, 12, 13, 14]; // README brightness table

export function boot(C) {
  const { ctx, glow, G, W, H, f, cues, Tc, STEP, BAR } = C;
  const lb = C.lbar, cx = W / 2, cy = H / 2 + 8, s = 7.5;
  const bootEv = cues.ev.boot, t1 = bootEv[0][0], tEnd = 2 * BAR;
  grid(C, { alpha: 0.035 });
  corners(C, { alpha: 0.35 });

  // a thin horizontal line grows from the centre: the panel is powered
  const lineU = E('out4', lb / 0.45);
  line(ctx, cx - lineU * W * 0.5, H / 2, cx + lineU * W * 0.5, H / 2, 2, rgba(P.WHT, 0.16 + 0.1 * f.kick));

  // lit segment count from the chirps
  let n = 0;
  for (let i = 0; i < 16; i++) if (Tc >= bootEv[i][0]) n = i + 1;
  const sweep = Tc >= t1 && Tc < tEnd - 1e-6;
  const allOn = Tc >= tEnd - 0.001;
  const lv = new Float32Array(17), colors = new Array(17);
  for (let i = 0; i < 16; i++) {
    const on = i < n || allOn;
    const age = i < n ? Tc - bootEv[i][0] : 9;
    lv[i] = on ? 1 : 0;
    colors[i] = LED[i % 5];
    if (on && age < 0.25) lv[i] = 1;
  }
  // brightness ladder in bar 2
  const lvlIdx = clamp(Math.floor((lb - 2) * 8), 0, 7);
  let dim = 1;
  if (lb >= 2) dim = 0.06 + 0.94 * (LEVELS[lvlIdx] / 14);
  if (lb >= 2.86) dim = 0.0; // 0x81: OFF - the beat before the chain appears
  // DP: power-on blink starting at bar 0 step 6
  const dpOn = Tc >= 6 * STEP && (Tc < 9 * STEP || Tc > 10 * STEP);
  lv[16] = dpOn ? 1 : 0; colors[16] = P.RED;
  if (allOn) lv[16] = 1;

  const zoom = 0.93 + 0.07 * E('out3', lb / 3), shake = f.kick * 3;
  camera(C, () => {
    // 16-step dial: one dot per chirp
    const R = 500;
    for (let i = 0; i < 16; i++) {
      const a = -Math.PI / 2 + (i / 16) * TAU, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R * 0.98;
      const lit = i < n || allOn, age = i < n ? Tc - bootEv[i][0] : 9, pop = Math.exp(-age / 0.12);
      ctx.fillStyle = 'rgba(244,236,220,0.13)'; ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.fill();
      if (lit) { const c = LED[i % 5]; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, 9 + 9 * pop, 0, TAU); ctx.fill(); glow.fillStyle = c; glow.globalAlpha = 0.5 + 0.5 * pop; glow.beginPath(); glow.arc(x, y, 12 + 10 * pop, 0, TAU); glow.fill(); glow.globalAlpha = 1; }
    }
    const ringU = E('io3', (lb - 0.9) / 1.2);
    ctx.strokeStyle = rgba(P.WHT, 0.22); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(ringU), false); ctx.stroke();

    // the board
    const bw = G.W * s, bh = G.H * s;
    G.board(ctx, { x: cx + (hash(Math.floor(Tc * 60)) - 0.5) * shake, y: cy, s, fill: '#0a0a0f', edge: '#252733' });
    // segments
    const lvD = lv.map((v) => v * dim);
    G.draw(ctx, glow, { x: cx, y: cy, s, lv: lvD, colors, off: '#12131a', edge: '#242631', hot: 0.4, glowK: 1.0 * (dim > 0 ? 1 : 0) });
    // underline LEDs (8): lit one per 16th in the second half of bar 0
    G.underlineDots(ctx, glow, { x: cx, y: cy, s, color: P.WHT, r: 1.15, lit: (i) => (Tc >= (8 + i) * STEP ? (0.55 + 0.45 * Math.exp(-(Tc - (8 + i) * STEP) / 0.1)) * (lb >= 2 ? dim : 1) : 0) });
  }, { z: zoom });

  // ---- left: the name of the segment being tested (A..U)
  const cur = clamp(n - 1, 0, 15);
  if (sweep || allOn) {
    const c = allOn ? P.WHT : LED[cur % 5];
    const pop = allOn ? 0 : Math.exp(-(Tc - bootEv[cur][0]) / 0.14);
    const hh = 330 + 30 * pop, ls = hh / G.H, big = new Float32Array(17);
    G.lv(G.mask(allOn ? '8' : SEG_NAMES[cur].length > 1 ? '.' : SEG_NAMES[cur]), big);
    if (allOn) big[16] = 1;
    G.draw(ctx, glow, { x: 330, y: cy, s: ls, lv: big, color: c, off: 'rgba(255,255,255,0.05)', edge: null, glowK: 0.8, hot: 0.3 });
    label(C, allOn ? 'SELF TEST OK' : `SEGMENT ${String(cur + 1).padStart(2, '0')}/16`, 330, cy + 250, 22, rgba(P.WHT, 0.75), { align: 'center' });
  } else if (lb < 1) {
    label(C, 'POWER', 330, cy, 34, rgba(P.WHT, 0.4 * sstep(0.4, 0.7, lb)), { align: 'center' });
  }

  // ---- right: the mask register being filled (firmware order: A = bit 0 ... U = bit 15)
  {
    const mask = allOn ? 0xffff : n >= 16 ? 0xffff : (1 << n) - 1;
    const x0 = 1330;
    label(C, 'SEGMENT MODE', x0, cy - 250, 24, rgba(P.WHT, 0.7 * sstep(0.9, 1.1, lb)));
    label(C, '0X11 DC1 + 3 BYTES', x0, cy - 214, 18, rgba(P.WHT, 0.4 * sstep(0.9, 1.1, lb)));
    if (lb >= 1) {
      for (let i = 0; i < 16; i++) {
        const col = i % 4, row = Math.floor(i / 4), x = x0 + col * 62, y = cy - 160 + row * 62, lit = i < n || allOn;
        ctx.fillStyle = lit ? LED[i % 5] : 'rgba(255,255,255,0.08)'; ctx.fillRect(x, y, 50, 50);
        if (lit) { glow.fillStyle = LED[i % 5]; glow.globalAlpha = 0.6; glow.fillRect(x - 3, y - 3, 56, 56); glow.globalAlpha = 1; }
        label(C, SEG_NAMES[i], x + 25, y + 25, 26, lit ? P.INK : rgba(P.WHT, 0.4), { align: 'center', glowK: 0, gap: 0 });
      }
      label(C, '0X' + mask.toString(16).toUpperCase().padStart(4, '0'), x0, cy + 130, 44, P.WHT, { glowK: 0.5 });
    }
    if (lb >= 2) {
      label(C, 'BRIGHTNESS', x0, cy + 190, 22, rgba(P.WHT, 0.7));
      const code = lb >= 2.86 ? 0x81 : 0x88 + lvlIdx;
      label(C, hex2(code), x0, cy + 236, 40, lb >= 2.86 ? P.RED : P.YEL, { glowK: 0.6 });
      for (let i = 0; i < 8; i++) {
        const on = lb >= 2 && lb < 2.86 && i <= lvlIdx, h = 14 + 8 * i;
        ctx.fillStyle = on ? P.YEL : 'rgba(255,255,255,0.10)'; ctx.fillRect(x0 + 200 + i * 20, cy + 256 - h, 14, h);
      }
    }
  }
  // tiny caption bottom-left
  label(C, 'SEG-16-RGB-MDNT', 72, H - 96, 20, rgba(P.WHT, 0.45));
  label(C, 'FW 0.6', W - 72, H - 96, 20, rgba(P.WHT, 0.45), { align: 'right' });
  C.fx.bloom = 1.0;
}
