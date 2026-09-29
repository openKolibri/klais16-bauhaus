// CODEX (bars 36-39): a manuscript page in the light of two candles - the facts of the project set line by line in the segment
// font, with an illuminated capital. Below it eight modules spell DIES IRAE, one letter per note of the plainchant that the
// celesta plays (eight notes, eight letters, eight modules).
import { TAU, clamp, lerp, smooth, sstep, ease } from '../../render/util.js';
import { L, La, TONE, roman } from '../tone.js';
import { stone, Light, candle, foilPath, archPath, hatch, chain, crockets, embers } from '../ornament.js';
import { plaque } from '../furniture.js';

let light = null;
const LINES = [
  'KLAIS 16 IS AN OPEN HARDWARE',
  'SIXTEEN SEGMENT DISPLAY',
  'DESIGNED BY SAWAIZ SYED FOR KOLIBRI',
  '128 LEDS  16 SEGMENTS  5 V  1.6 W',
  '100 X 66.66 MM  63.97 G  5.8 MM',
  'DAISY CHAINED OVER UART  8N1  115200',
  'EACH BYTE PUSHES THE LAST DOWN THE CHAIN',
  'TM1640 SCANS 16 GRIDS OF 8 LEDS',
  'HARDWARE CERN OHL S 2.0  FIRMWARE GPL 3',
];
const DIES = 'DIESIRAE';

export function codex(C) {
  const { ctx, glow, G, W, H, f, cues, Tc, STEP } = C;
  light = light || new Light(W, H);
  const lb = C.lbar, px0 = 330, px1 = 1590, py0 = 52, py1 = 770, pcx = (px0 + px1) / 2;
  ctx.drawImage(stone(W, H, 51, { course: 100, block: 220 }), 0, 0);
  light.begin(0.03 + 0.03 * f.heart);
  light.add(px0 + 60, py1 + 20, 780, 0.78 + 0.18 * Math.sin(Tc * 11) * Math.sin(Tc * 7));
  light.add(px1 - 60, py1 + 20, 780, 0.72 + 0.2 * Math.sin(Tc * 9 + 2));
  light.add(pcx, 300, 900, 0.2);
  light.apply(ctx);

  // ---- the page: a double frame with corner foils, ruled lines
  ctx.fillStyle = L(0.025); ctx.fillRect(px0, py0, px1 - px0, py1 - py0);
  ctx.strokeStyle = L(0.5); ctx.lineWidth = 3; ctx.strokeRect(px0, py0, px1 - px0, py1 - py0);
  ctx.strokeStyle = L(0.3); ctx.lineWidth = 1.5; ctx.strokeRect(px0 + 16, py0 + 16, px1 - px0 - 32, py1 - py0 - 32);
  for (const [x, y] of [[px0, py0], [px1, py0], [px0, py1], [px1, py1]]) { ctx.fillStyle = L(0.6); ctx.fill(foilPath(x, y, 22, 4, -Math.PI / 4)); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.fill(); }

  // ---- the illuminated capital
  const dcx = px0 + 150, dcy = py0 + 150, dc = ctx;
  const capBox = archPath(dcx, dcy + 112, 210, 224, 120);
  ctx.fillStyle = L(0.06); ctx.fill(capBox); hatch(ctx, capBox, { x0: dcx - 110, y0: dcy - 120, x1: dcx + 110, y1: dcy + 114, angle: -0.7, gap: 6, v: 0.2 });
  ctx.strokeStyle = L(0.6); ctx.lineWidth = 3; ctx.stroke(capBox);
  const capA = sstep(0.05, 0.5, lb);
  G.draw(ctx, glow, { x: dcx, y: dcy + 2, s: 1.8, lv: G.lv(G.mask('K')), color: L(0.9 * capA), off: L(0.05 * capA), edge: L(0.1 * capA), hot: 0.5, glowK: 0.8, alpha: 1 });
  crockets(ctx, dcx, dcy + 112, 210, 224, 120, { n: 4, size: 9, v: 0.45, finial: false });

  // ---- the lines, one per beat
  const tx = px0 + 300, y0 = py0 + 84, dy = 68, nLines = Math.min(LINES.length, Math.floor(lb * 4 + 0.001) + 1);
  for (let i = 0; i < LINES.length; i++) {
    const y = y0 + i * dy, x0 = i < 3 ? tx : px0 + 84;
    ctx.strokeStyle = L(0.07); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, y + 24); ctx.lineTo(px1 - 84, y + 24); ctx.stroke();
    if (i >= nLines) continue;
    const age = lb * 4 - i, typed = Math.floor(clamp(age * 1.6) * LINES[i].length), txt = LINES[i].slice(0, typed);
    const fresh = Math.exp(-Math.max(0, age) * 2);
    G.text(ctx, fresh > 0.05 ? glow : null, txt, { x: x0, y, h: 30, color: L(0.62 + 0.38 * fresh), gap: 0.3, hot: 0, glowK: 0.5 });
  }

  // ---- marginalia: a chain down the left border pulses with every note
  const cel = cues.between('cel', Tc - 0.7, Tc + 0.0005).map((e) => ({ y: lerp(py0, py1, clamp((Tc - e[0]) / 0.5)), k: 1 - (Tc - e[0]) / 0.7 }));
  chain(ctx, glow, [[px0 - 60, py0 - 10], [px0 - 70, (py0 + py1) / 2], [px0 - 60, py1 + 10]], { pitch: 26, w: 12, lw: 2.4, v: 0.26, lit: (i, u) => { let m = 0; const y = lerp(py0, py1, u); for (const p of cel) m = Math.max(m, p.k * Math.exp(-Math.pow((y - p.y) / 60, 2))); return m; } });
  chain(ctx, glow, [[px1 + 60, py0 - 10], [px1 + 70, (py0 + py1) / 2], [px1 + 60, py1 + 10]], { pitch: 26, w: 12, lw: 2.4, v: 0.26, lit: () => 0 });
  candle(ctx, glow, px0 + 60, py1 + 84, { h: 60, w: 18, t: Tc, seed: 4 });
  candle(ctx, glow, px1 - 60, py1 + 84, { h: 48, w: 18, t: Tc, seed: 5 });
  embers(ctx, glow, Tc, { x0: px0, x1: px1, y0: py1 + 60, y1: 100, n: 26, seed: 6, life: 6, v: 0.8 });

  // ---- DIES IRAE, letter by letter, one per note
  const my = 890, s = 1.85, cx0 = 960 - 3.5 * 150, notes = cues.between('cel', C.sc.b0 * C.BAR - 0.01, Tc + 0.0005);
  for (let i = 0; i < 8; i++) {
    const cx = cx0 + i * 150, hits = notes.filter((_, k) => k % 8 === i), last = hits.length ? hits[hits.length - 1][0] : -9, age = Tc - last, e = age < 2 ? Math.exp(-age / 0.5) : 0, lit = hits.length ? 0.3 + 0.65 * e : 0;
    G.board(ctx, { x: cx, y: my, s, fill: '#000000', edge: L(0.15), screws: false });
    const lv = G.lv(G.mask(DIES[i]), new Float32Array(17)); for (let k = 0; k < 17; k++) lv[k] *= lit;
    G.draw(ctx, glow, { x: cx, y: my, s, lv, color: L(0.9), off: L(0.045), edge: L(0.09), hot: 0.5, glowK: 0.8 });
  }
  plaque(C, 'CODEX SEDECIM', 960, 838, { h: 0.001, v: 0, rule: false });
  G.text(ctx, null, 'DIES IRAE  THIRTEENTH CENTURY PLAINCHANT  EIGHT NOTES', { x: 960, y: 1030, h: 17, align: 'center', color: L(0.52), gap: 0.4, hot: 0 });
  C.fx.bloom = 1;
  void smooth; void ease; void TONE; void La; void roman; void archPath; void STEP; void dc;
}
