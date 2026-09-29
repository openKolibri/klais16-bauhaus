// PLAIN HUNT (bars 12-15, the build): the score of what is about to be rung. One row of the method appears on every beat while
// the bells still ring rounds; each row lights the eight LEDs of one TM1640 grid on the module (16 rows x 8 bells = 128 LEDs).
import { TAU, clamp, lerp, smooth, sstep } from '../../render/util.js';
import { plainHunt, bellPath } from '../../shared/ring.js';
import { SEG_NAMES } from '../../render/glyph.js';
import { L, La, TONE } from '../tone.js';
import { stone, Light, bellShape, hatch } from '../ornament.js';
import { plaque } from '../furniture.js';

const ROWS = plainHunt(8);
let light = null;
const X0 = 330, DX = 112, Y0 = 268, DY = 39;

export function hunt(C) {
  const { ctx, glow, G, W, H, f, cues, Tc } = C;
  const lb = C.lbar, k = Math.min(16, Math.floor(lb * 4 + 1e-6)), a = (lb * 4) % 1;   // row k has just been revealed
  const upto = lb >= 3.8 ? 16 : k;
  light = light || new Light(W, H);
  ctx.drawImage(stone(W, H, 11, { course: 96, block: 200 }), 0, 0);
  light.begin(0.04 + 0.06 * f.kick + 0.08 * (lb / 4));
  light.add(X0 + 3.5 * DX, 560, 820, 0.45 + 0.2 * f.kick); light.add(1530, 540, 520, 0.5);
  light.apply(ctx);

  // ---- bells in their rounds places, hanging over the columns; they swing when they strike
  const age = new Float32Array(9).fill(Infinity);
  for (const e of cues.between('bell', Tc - 2, Tc + 0.0005)) age[e[1]] = Tc - e[0];
  for (let b = 1; b <= 8; b++) {
    const x = X0 + (b - 1) * DX, e = Math.exp(-age[b] / 0.3), sw = age[b] < 2 ? 0.25 * Math.exp(-age[b] / 0.7) * Math.cos(age[b] * 9) * (b % 2 ? 1 : -1) : 0;
    bellShape(ctx, glow, x, 116, { size: 0.62, angle: sw, e, v: 0.36 });
  }

  // ---- the diagram: 8 places x 17 rows
  ctx.strokeStyle = L(0.1); ctx.lineWidth = 1.5; ctx.beginPath();
  for (let p = 0; p < 8; p++) { ctx.moveTo(X0 + p * DX, Y0 - 24); ctx.lineTo(X0 + p * DX, Y0 + 16 * DY + 24); }
  ctx.stroke();
  const tenor = bellPath(ROWS, 8), treble = bellPath(ROWS, 1);
  const line = (path, v, w) => {
    ctx.strokeStyle = L(v); ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.beginPath();
    for (let r = 0; r <= upto; r++) { const x = X0 + path[r] * DX, y = Y0 + r * DY; r ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
    glow.strokeStyle = L(v); glow.lineWidth = w * 1.6; glow.globalAlpha = 0.6; glow.lineJoin = 'round'; glow.beginPath();
    for (let r = 0; r <= upto; r++) { const x = X0 + path[r] * DX, y = Y0 + r * DY; r ? glow.lineTo(x, y) : glow.moveTo(x, y); }
    glow.stroke(); glow.globalAlpha = 1;
  };
  line(tenor, 0.55, 3 + 2 * f.kick); line(treble, 0.98, 3.5 + 2.5 * f.kick);
  for (let r = 0; r <= upto; r++) {
    const cur = r === upto, y = Y0 + r * DY, fl = cur ? Math.exp(-a * 2.4) : 0;
    if (cur) { ctx.fillStyle = L(0.09 + 0.12 * fl); ctx.fillRect(X0 - 60, y - DY / 2 + 3, 7 * DX + 120, DY - 6); }
    for (let p = 0; p < 8; p++) {
      const bell = ROWS[r][p], x = X0 + p * DX, hi = bell === 1 ? 1 : bell === 8 ? 0.75 : 0.46;
      G.text(ctx, cur ? glow : null, String(bell), { x, y, h: 25, align: 'center', color: L(Math.min(1, hi + 0.55 * fl)), gap: 0, hot: 0, glowK: 0.6 });
    }
    G.text(ctx, null, String(r).padStart(2, '0'), { x: X0 - 96, y, h: 20, align: 'right', color: L(cur ? 0.95 : 0.4), gap: 0.3, hot: 0 });
  }
  G.text(ctx, null, 'ROW', { x: X0 - 108, y: Y0 - 44, h: 16, align: 'right', color: L(0.3), gap: 0.4, hot: 0 });
  G.text(ctx, null, 'TREBLE  I', { x: X0 + 7 * DX + 84, y: Y0 + 4, h: 17, color: L(0.85), gap: 0.4, hot: 0 });
  G.text(ctx, null, 'TENOR  VIII', { x: X0 + 7 * DX + 84, y: Y0 + 34, h: 17, color: L(0.6), gap: 0.4, hot: 0 });

  // ---- the module: the LEDs of grid r+1 flash when row r appears
  const mx = 1560, my = 540, s = 5.2;
  G.board(ctx, { x: mx, y: my, s, fill: '#000000', edge: L(0.16), screws: false });
  G.draw(ctx, null, { x: mx, y: my, s, lv: G.zero, off: L(0.04), edge: L(0.09), dp: true });
  const rowAge = (g) => (g - 1 < upto || (g - 1 === upto && a >= 0) ? (upto - (g - 1)) : -1);
  G.leds16(ctx, glow, {
    x: mx, y: my, s, r: 0.72, off: L(0.06), color: L(1), f: (l) => {
      const r = l.grid - 1; if (r > upto || r > 15) return 0;
      const back = upto - r, flash = r === upto ? Math.exp(-a * 2.2) : back === 1 ? Math.exp(-(1 + a) * 2.2) : 0;
      return 0.16 + 0.84 * flash;
    },
  });
  plaque(C, 'PLAIN HUNT ON EIGHT', 960, 60, { h: 34, v: 0.7, rule: false });
  const eq = [['SIXTEEN ROWS', 8], ['TIMES EIGHT BELLS', 10], ['ONE HUNDRED TWENTY EIGHT STRIKES', 12], ['ONE LED FOR EVERY STRIKE', 14]];
  eq.forEach(([t, at], i) => {
    const v = sstep(at, at + 0.4, k + a) * 0.8;
    G.text(ctx, null, t, { x: 1560, y: 858 + i * 32, h: 19, align: 'center', color: L(v), gap: 0.36, hot: 0 });
  });
  if (lb >= 3.8) G.text(ctx, glow, 'COMES ROUND', { x: X0 + 3.5 * DX, y: Y0 + 17 * DY + 20, h: 22, align: 'center', color: L(0.85), gap: 0.4, hot: 0.4, glowK: 0.8 });

  // the last step is a blackout: the drop follows
  C.fx.fade = sstep(3.9, 3.98, lb);
  C.fx.bloom = 1 + 0.5 * (lb / 4) * (lb / 4) + 0.15 * f.snare;   // the riser: the score glows brighter towards the drop
  void TAU; void clamp; void lerp; void smooth; void hatch; void SEG_NAMES; void TONE; void La; void rowAge;
}
