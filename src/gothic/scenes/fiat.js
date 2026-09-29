// FIAT LUX (bars 0-3): the candle, the great bell, and the sixteen segments of one module ignited one per sixteenth note.
// bar 0  darkness, the bell tolls, two candles are lit          bar 1  16 segments ignite, A..U (one chirp = one segment)
// bar 2  F I A T on the beats; the 8 underline LEDs ring rounds   bar 3  the decimal point, L U X, and the flare into the belfry
import { TAU, clamp, lerp, smooth, sstep, ease } from '../../render/util.js';
import { SEG_NAMES } from '../../render/glyph.js';
import { L, La, TONE, flicker } from '../tone.js';
import { stone, Light, candle, embers } from '../ornament.js';
import { niche, plaque, arcade } from '../furniture.js';

let light = null;
const W_ = 820, H_ = 950, BASE = 1040;
const LETTERS = ['F', 'I', 'A', 'T', ' ', 'L', 'U', 'X'];

export function fiat(C) {
  const { ctx, glow, G, W, H, f, cues, Tc } = C;
  const lb = C.lbar, lt = C.lt;
  light = light || new Light(W, H);
  const cx = 960, s = 6.4, my = 640;
  const toll = f.toll;

  // ---- ignition state of every segment / underline LED / decimal point from the cue sheet
  const lit = new Float32Array(25), age = new Float32Array(25).fill(-1);
  for (const e of cues.ev.ignite) if (Tc >= e[0]) age[e[1]] = Tc - e[0];
  for (let i = 0; i < 25; i++) if (age[i] >= 0) lit[i] = 0.92 * (1 - Math.exp(-age[i] / 0.02)) + 0.9 * Math.exp(-age[i] / 0.11);

  // ---- stone, blind arcade, portal
  ctx.drawImage(stone(W, H, 3), 0, 0);
  arcade(ctx, { v: 0.42 });
  const inner = niche(ctx, { cx, baseY: BASE, w: W_, h: H_, v: 0.66 });
  ctx.fillStyle = L(0.006); ctx.fill(inner);

  // ---- light: two altar candles first, then the glow of the module itself
  const c1 = smooth((lt - 0.85) / 0.5), c2 = smooth((lt - 1.75) / 0.5);
  const moduleGlow = lit.slice(0, 16).reduce((a, b) => a + b, 0) / 16;
  light.begin(0.03 + 0.34 * toll);
  light.add(cx - 380, 985, 700, (0.75 + 0.25 * flicker(Tc, 1)) * c1);
  light.add(cx + 380, 985, 700, (0.75 + 0.25 * flicker(Tc, 2)) * c2);
  light.add(cx, my, 950, 0.95 * clamp(moduleGlow * 1.6));
  light.apply(ctx);

  // ---- the bell rings the stone: expanding rings from the module at every toll
  for (const e of cues.between('toll', Tc - 3.2, Tc + 0.0005)) {
    const a = Tc - e[0], r = 260 + a * 420, k = Math.exp(-a / 1.1) * (e[2] || 1);
    ctx.strokeStyle = La(0.7, 0.5 * k); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, my, r, 0, TAU); ctx.stroke();
    glow.strokeStyle = La(0.9, 0.35 * k); glow.lineWidth = 6; glow.beginPath(); glow.arc(cx, my, r, 0, TAU); glow.stroke();
  }

  // ---- emissive: candles, embers
  candle(ctx, glow, cx - 380, 1010, { h: 118, w: 26, t: Tc, seed: 1, lit: c1 });
  candle(ctx, glow, cx + 380, 1010, { h: 98, w: 26, t: Tc, seed: 2, lit: c2 });
  embers(ctx, glow, Tc, { x0: cx - 300, x1: cx + 300, y0: 1000, y1: 250, n: 34, seed: 3, life: 5, v: 0.85 });

  // ---- the module: 16 segments, decimal point, 8 underline LEDs, and the real LEDs inside every lit segment
  const lv = new Float32Array(17);
  if (lb < 2) { for (let i = 0; i < 16; i++) lv[i] = lit[i]; }
  else {
    // letters on the beats (bar 2: F I A T, bar 3: blank L U X); a short attack so each change reads as a flash
    const beat = Math.floor((lb - 2) * 4), a = ((lb - 2) * 4) % 1, ch = LETTERS[clamp(beat, 0, 7)];
    const m = G.mask(ch), k = 0.85 + 0.15 * Math.exp(-a * 5);
    for (let i = 0; i < 16; i++) lv[i] = ((m >> i) & 1) * k * sstep(0, 0.04, a);
  }
  lv[16] = lb >= 3 && lb < 3.25 ? lit[16] : 0;           // the full stop between FIAT and LUX
  const flare = sstep(3.86, 3.98, lb);                    // the whole display flares in the last step, into the next scene
  for (let i = 0; i < 17; i++) lv[i] = Math.max(lv[i], flare);
  G.board(ctx, { x: cx, y: my, s, fill: '#000000', edge: L(0.18), screws: false });
  G.draw(ctx, glow, { x: cx, y: my, s, lv, color: L(TONE.led * 0.86), off: L(0.05), edge: L(0.11), hot: 0.55, glowK: 0.9, dp: true, dpScale: 1 });
  // LED pinpricks: each of the 128 LEDs at its true position, lit with its segment
  const segLv = (l) => (l.seg === 'UL' ? 0 : lv[SEG_NAMES.indexOf(l.seg)] || 0);
  G.leds16(ctx, glow, { x: cx, y: my, s, f: (l) => (l.seg === 'UL' ? 0 : segLv(l) * 0.95), r: 0.62, off: L(0.075), color: L(1) });
  G.underlineDots(ctx, glow, { x: cx, y: my, s, lit: (i) => clamp(lit[17 + i] + (lb >= 3 ? 0.9 : 0) - (lb >= 3 && flare < 0.05 ? 0.55 : 0)), color: L(0.95), r: 0.95, off: L(0.09) });

  // ---- inscription
  const ins = sstep(0.4, 1.4, lb) * (1 - sstep(3.7, 3.95, lb));
  if (ins > 0.01) plaque(C, 'LUX IN TENEBRIS', cx, 1040, { h: 17, v: 0.55 * ins, gap: 0.5, rule: false });

  C.fx.bloom = 1 + 0.6 * flare;                         // the display flares (bloom only - no full-frame flash)
  void lerp; void ease;
}
