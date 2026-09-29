// TENEBRAE (bars 56-63) and the end card (bar 64): the opening framing again - the portal, the module, the two candles - but now
// the last course is rung and every one of its 128 strikes snuffs one LED, top of the board first (grid by grid), a wisp of smoke
// rising from each. The counter falls in Roman numerals; the candles gutter and die with the last strike. Then only the bell.
import { TAU, clamp, lerp, smooth, sstep, ease, hash } from '../../render/util.js';
import { SEG_NAMES } from '../../render/glyph.js';
import { L, La, TONE, roman, flicker } from '../tone.js';
import { stone, Light, candle } from '../ornament.js';
import { niche, courseStrikes } from '../furniture.js';

let light = null;
const W_ = 820, H_ = 950, BASE = 1040;

export function tenebrae(C) {
  const { ctx, glow, G, W, H, f, cues, Tc, BAR } = C;
  light = light || new Light(W, H);
  const lb = C.lbar, cx = 960, s = 6.4, my = 640, t64 = 64 * BAR, st = courseStrikes(cues, 4);
  const end = Tc >= t64;

  // ---- how many LEDs are still lit, and how strongly each segment still glows
  let out = 0; const ledLv = new Float32Array(129);
  for (let n = 1; n <= 128; n++) {
    const t = st[n], age = Tc - t;
    if (t && age >= 0) { out++; ledLv[n] = 0.22 * Math.exp(-age / 0.5) + 0.85 * Math.exp(-age / 0.07); } else ledLv[n] = 0.9;
  }
  const segSum = new Float32Array(17), segCnt = new Float32Array(17), segLive = new Float32Array(17);
  for (const l of G.leds) {
    const i = SEG_NAMES.indexOf(l.seg); if (i < 0) continue;
    const t = st[l.n], gone = t && Tc >= t; segSum[i] += gone ? 0 : 1; segCnt[i]++;
  }
  const lv = new Float32Array(17);
  for (let i = 0; i < 17; i++) lv[i] = segCnt[i] ? 0.92 * (segSum[i] / segCnt[i]) : 0;
  const litFrac = 1 - out / 128;

  // ---- portal and light: the same framing as the opening
  ctx.drawImage(stone(W, H, 3), 0, 0);
  niche(ctx, { cx, baseY: BASE, w: W_, h: H_, v: 0.62 });
  const candleLit = lb < 8 ? clamp(1 - 0.25 * smooth(lb / 8)) * (lb > 7.9 ? 0 : 1) : 0;
  const c1 = lb < 7.9 ? clamp(1.05 - 0.55 * (lb / 8) - 0.1 * flicker(Tc, 3)) : 0, c2 = lb < 7.94 ? clamp(1.0 - 0.6 * (lb / 8) - 0.1 * flicker(Tc, 4)) : 0;
  light.begin(0.015 + 0.28 * (end ? f.toll : 0));
  light.add(cx - 380, 985, 640, (0.75 + 0.25 * flicker(Tc, 1)) * c1);
  light.add(cx + 380, 985, 640, (0.75 + 0.25 * flicker(Tc, 2)) * c2);
  light.add(cx, my, 900, 0.9 * clamp(litFrac * 1.5));
  light.apply(ctx);

  candle(ctx, glow, cx - 380, 1010, { h: 92 - 26 * (lb / 8), w: 20, t: Tc, seed: 1, lit: c1, wind: 0.2 * Math.sin(lb * 3) * (lb / 8) });
  candle(ctx, glow, cx + 380, 1010, { h: 78 - 22 * (lb / 8), w: 20, t: Tc, seed: 2, lit: c2, wind: -0.2 * Math.sin(lb * 2.6) * (lb / 8) });

  // ---- the module: segments dim as their LEDs go out; every LED shows its own state
  G.board(ctx, { x: cx, y: my, s, fill: '#000000', edge: L(0.16), screws: false });
  G.draw(ctx, glow, { x: cx, y: my, s, lv, color: L(TONE.led * 0.86), off: L(0.045), edge: L(0.1), hot: 0.55, glowK: 0.9, dp: true });
  G.leds16(ctx, glow, { x: cx, y: my, s, r: 0.62, off: L(0.06), color: L(1), f: (l) => (l.seg === 'UL' ? ledLv[l.n] * 0.95 : (segLv(l) * ledLv[l.n] > 0 ? ledLv[l.n] * 0.95 : ledLv[l.n] * 0.95)) });
  function segLv() { return 1; }

  // ---- smoke: each snuffed LED sends up a wavering wisp for about two seconds
  ctx.lineCap = 'round';
  for (const e of cues.between('snuff', Tc - 2.2, Tc + 0.0005)) {
    const led = G.leds[e[1] - 1], age = Tc - e[0], k = age / 2.2, x0 = cx + led.x * s, y0 = my + led.y * s, sd = e[1] * 7.31;
    ctx.strokeStyle = L(0.36 * (1 - k) * (1 - k)); ctx.lineWidth = 2.2 * (1 - 0.5 * k); ctx.beginPath();
    for (let j = 0; j <= 12; j++) {
      const a = age * (j / 12), rise = a * 70 + a * a * 18, x = x0 + Math.sin(a * 3.2 + sd) * (6 + 22 * a) * (j / 12), y = y0 - rise;
      j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  }

  // ---- the counter, the inscription, the end card
  const n = 128 - out, cnt = n > 0 ? roman(n) : 'NIHIL';
  const ca = 1 - sstep(7.7, 8.0, lb);
  G.text(ctx, glow, cnt, { x: 270, y: 520, h: 64, align: 'center', color: L(0.88 * ca), off: null, gap: 0.24, hot: 0.4, glowK: 0.6 });
  G.text(ctx, null, 'LUMINA', { x: 270, y: 580, h: 20, align: 'center', color: L(0.5 * ca), gap: 0.5, hot: 0 });
  const ins = sstep(6.0, 7.2, lb) * (1 - sstep(7.9, 8.05, lb));
  G.text(ctx, null, 'TENEBRAE FACTAE SUNT', { x: cx, y: 1018, h: 20, align: 'center', color: L(0.42 * ins), gap: 0.5, hot: 0 });
  if (end) {
    const e = clamp((Tc - t64) / 0.4) * (1 - sstep(0.8, 1.0, (Tc - t64) / BAR));
    G.text(ctx, glow, 'LUX SEDECIM', { x: cx, y: 600, h: 84, align: 'center', color: L(0.7 * e), off: null, gap: 0.28, hot: 0.3, glowK: 0.5 });
    G.text(ctx, null, 'KLAIS 16', { x: cx, y: 690, h: 24, align: 'center', color: L(0.42 * e), gap: 0.6, hot: 0 });
  }
  C.fx.bloom = 1 + 0.6 * f.impact * (lb < 1 ? 1 : 0);
  C.fx.fade = end ? sstep(0.72, 1.0, (Tc - t64) / BAR) : 0;
  void TAU; void lerp; void ease; void hash; void candleLit; void La;
}
