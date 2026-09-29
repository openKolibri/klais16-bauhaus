// ORGANUM (bars 24-27): the pipe organ is the spectrum analyser. Twenty-four pipes in three pointed arches, one per band of the
// music; every pipe is a column of LEDs that fills from the mouth upwards. The console below plays the chord that is sounding.
import { TAU, clamp, lerp, smooth, sstep } from '../../render/util.js';
import { L, La, TONE } from '../tone.js';
import { stone, Light, archPath, crockets, foilPath } from '../ornament.js';
import { niche, plaque } from '../furniture.js';

let light = null;
const PEAK = new Float32Array(24);

// three pointed arches: [centre x, half width, apex height, band range]
const CASE = [
  { cx: 430, w: 500, h: 760, rise: 430, b0: 0, b1: 7 },
  { cx: 960, w: 620, h: 860, rise: 560, b0: 7, b1: 17 },
  { cx: 1490, w: 500, h: 760, rise: 430, b0: 17, b1: 24 },
];
const BASE = 930;
const NAMES = { Em: 'EM', C: 'C', Am: 'AM', B: 'B' };

export function organ(C) {
  const { ctx, glow, G, W, H, f, cues, Tc } = C;
  light = light || new Light(W, H);
  const lb = C.lbar;
  ctx.drawImage(stone(W, H, 21, { course: 88, block: 190 }), 0, 0);

  // ---- the case: three stepped arches
  for (const c of CASE) niche(ctx, { cx: c.cx, baseY: BASE, w: c.w, h: c.h, rise: c.rise, steps: 2, step: 22, v: 0.5 + 0.3 * f.toll, hatchV: 0.14, size: 11 });
  light.begin(0.06 + 0.06 * f.kick);
  for (const c of CASE) light.add(c.cx, 620, 560, 0.5 + 0.35 * f.kick);
  light.apply(ctx);

  // ---- pipes: the bands are peak-held with a slow fall (a pure function of time), so the LED columns follow the kick and the
  // chords but do not flicker at the rate of the hats - a large area must never flash faster than 3 times a second
  const bands = new Float32Array(24), tmp = new Float32Array(24);
  for (let k = 0; k <= 10; k++) {
    cues.bands(Tc - k * 0.04, tmp);
    for (let b = 0; b < 24; b++) bands[b] = Math.max(bands[b], tmp[b] * Math.exp((-k * 0.04) / (0.14 + 0.012 * b)));   // slower fall for the higher bands
  }
  for (const c of CASE) {
    const n = c.b1 - c.b0, gap = 8, pw = (c.w - 70 - gap * (n - 1)) / n, x0 = c.cx - (n * pw + gap * (n - 1)) / 2;
    for (let k = 0; k < n; k++) {
      const b = c.b0 + k, x = x0 + k * (pw + gap) + pw / 2;
      // pipe height follows the arch profile around the group centre, longer for lower pitches
      const t = (k - (n - 1) / 2) / ((n - 1) / 2 || 1), prof = 1 - 0.34 * Math.pow(Math.abs(t), 1.4), ph = (c.h - 170) * prof * (1 - 0.32 * (b / 24));
      const raw = bands[b] * 255, lo = 90 - 2.5 * b, hi = 225 - 4.6 * b, lvl = clamp((raw - lo) / (hi - lo));
      PEAK[b] = Math.max(lvl, PEAK[b] - 0.012);
      const top = BASE - 46 - ph;
      // silhouette
      const pipe = archPath(x, BASE - 46, pw, ph, pw * 0.5);
      ctx.fillStyle = L(0.02); ctx.fill(pipe);
      ctx.strokeStyle = L(0.34); ctx.lineWidth = 2; ctx.stroke(pipe);
      // LED column: dots every 13 px, lit from the bottom up to the band level
      const nd = Math.floor((ph - 26) / 13), lit = Math.round(lvl * nd);
      for (let d = 0; d < nd; d++) {
        const y = BASE - 46 - 22 - d * 13, on = d < lit, pk = d === Math.round(PEAK[b] * nd) - 1;
        const v = on ? 0.55 + 0.4 * (d / nd) : pk ? 0.85 : 0.06;
        ctx.fillStyle = L(v); ctx.beginPath(); ctx.arc(x, y, pw * 0.2 + 0.6, 0, TAU); ctx.fill();
        if (on || pk) { glow.globalAlpha = on ? 0.85 : 0.7; glow.fillStyle = L(0.95); glow.beginPath(); glow.arc(x, y, pw * 0.28, 0, TAU); glow.fill(); glow.globalAlpha = 1; }
      }
      // the mouth
      ctx.fillStyle = '#000'; ctx.fillRect(x - pw * 0.32, BASE - 46 - 16, pw * 0.64, 14);
      ctx.strokeStyle = L(0.34); ctx.lineWidth = 1.5; ctx.strokeRect(x - pw * 0.32, BASE - 46 - 16, pw * 0.64, 14);
      void top;
    }
  }

  // ---- the console: three ranks of keys; the sounding chord and the stabs press them
  const pressed = new Set(), flashes = new Map();
  const org = cues.last('organ', Tc);
  if (org && Tc < org[0] + org[1] + 0.4) for (const m of org.slice(2)) pressed.add(m);
  for (const e of cues.between('stab', Tc - 0.5, Tc + 0.0005)) for (const m of e.slice(2)) flashes.set(m, Math.max(flashes.get(m) || 0, Math.exp(-(Tc - e[0]) / 0.16)));
  const kx0 = 300, kx1 = 1620, k0 = 36, k1 = 84; // MIDI range shown
  const white = [0, 2, 4, 5, 7, 9, 11], nWhite = [];
  for (let m = k0; m < k1; m++) if (white.includes(m % 12)) nWhite.push(m);
  const kw = (kx1 - kx0) / nWhite.length, ky = 962, kh = 58;
  ctx.fillStyle = L(0.03); ctx.fillRect(kx0 - 20, ky - 14, kx1 - kx0 + 40, kh + 26);
  ctx.strokeStyle = L(0.3); ctx.lineWidth = 2; ctx.strokeRect(kx0 - 20, ky - 14, kx1 - kx0 + 40, kh + 26);
  nWhite.forEach((m, i) => {
    const on = pressed.has(m) ? 0.55 : 0, fl = flashes.get(m) || 0, v = Math.max(on, fl * 0.95), x = kx0 + i * kw;
    ctx.fillStyle = L(0.09 + v); ctx.fillRect(x + 1.5, ky, kw - 3, kh);
    if (v > 0.1) { glow.globalAlpha = v; glow.fillStyle = L(0.9); glow.fillRect(x + 1.5, ky, kw - 3, kh); glow.globalAlpha = 1; }
  });
  for (let m = k0; m < k1; m++) {
    if (white.includes(m % 12)) continue;
    const i = nWhite.findIndex((q) => q > m) - 1, x = kx0 + (i + 1) * kw - kw * 0.3, on = pressed.has(m) ? 0.5 : 0, fl = flashes.get(m) || 0, v = Math.max(on, fl * 0.95);
    ctx.fillStyle = L(0.025 + v); ctx.fillRect(x, ky, kw * 0.6, kh * 0.6);
    ctx.strokeStyle = L(0.28); ctx.lineWidth = 1.2; ctx.strokeRect(x, ky, kw * 0.6, kh * 0.6);
    if (v > 0.1) { glow.globalAlpha = v; glow.fillStyle = L(0.9); glow.fillRect(x, ky, kw * 0.6, kh * 0.6); glow.globalAlpha = 1; }
  }

  // ---- inscription and the chord name
  const chord = cues.last('chord', Tc), name = NAMES[chord ? chord[1] : 'Em'];
  plaque(C, 'ORGANUM', 960, 96, { h: 36, v: 0.7, rule: false });
  G.text(ctx, glow, name, { x: 960, y: 190, h: 70, align: 'center', color: L(0.92), off: L(0.05), edge: L(0.1), gap: 0.22, hot: 0.55, glowK: 0.9 });
  G.text(ctx, null, 'XXIV PIPES  XXIV BANDS', { x: 960, y: 262, h: 19, align: 'center', color: L(0.52), gap: 0.4, hot: 0 });
  C.fx.bloom = 1.05 + 0.2 * f.kickS;
  void lerp; void smooth; void sstep; void crockets; void foilPath; void TONE; void La; void lb;
}
