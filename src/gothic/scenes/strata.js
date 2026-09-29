// STRATA (bars 32-35, the requiem): the four boards of the PCB sandwich, exploded, drawn as an engraver would - hatched walls,
// dressed edges. L0 carries the 128 LEDs, L1/L2 are spacers with the segment cut-outs, L3 is the diffuser face.
// The second course is rung here at sixteenth-note rate and every strike lights one LED; light climbs through the cut-outs.
import { TAU, clamp, lerp, smooth, sstep, ease } from '../../render/util.js';
import { SEG_NAMES } from '../../render/glyph.js';
import { L, La, TONE, roman } from '../tone.js';
import { stone, Light } from '../ornament.js';
import { courseStrikes, plaque } from '../furniture.js';

let light = null;
const PHI = (52 * Math.PI) / 180, SP = Math.sin(PHI), CP = Math.cos(PHI);
const LAYERS = [
  { name: 'STRATUM I', desc: 'LUMEN  ELECTRONICS 1.0 MM', kind: 'pcb', thick: 5 },
  { name: 'STRATUM II', desc: 'SPATIUM  SPACER 1.6 MM', kind: 'cut', thick: 8 },
  { name: 'STRATUM III', desc: 'SPATIUM  SPACER 1.6 MM', kind: 'cut', thick: 8 },
  { name: 'STRATUM IV', desc: 'VELUM  DIFFUSER 1.6 MM', kind: 'face', thick: 8 },
];

export function strata(C) {
  const { ctx, glow, G, W, H, f, cues, Tc } = C;
  light = light || new Light(W, H);
  const lb = C.lbar, cx = 960, s = 5.6;
  const ex = lb < 0.3 ? 0 : lb < 1.6 ? ease.io3((lb - 0.3) / 1.3) : lb < 3.1 ? 1 : lb < 3.9 ? 1 - ease.io3((lb - 3.1) / 0.8) : 0;
  const theta = -0.6 + lb * 0.13, gap = 125 * ex, ct = Math.cos(theta), st = Math.sin(theta), breathe = 1 + 0.008 * f.heart;
  const cy0 = 550 + 1.5 * gap;
  const zpx = (layer) => layer * gap + (1 - ex) * layer * 3.2;
  const setM = (c, layer, dy = 0) => c.setTransform(s * ct * breathe, s * st * SP * breathe, -s * st * breathe, s * ct * SP * breathe, cx, cy0 - zpx(layer) + dy);

  ctx.drawImage(stone(W, H, 41, { course: 96, block: 210 }), 0, 0);
  light.begin(0.035 + 0.04 * f.heart);
  light.add(cx, 560, 900, 0.5 + 0.2 * f.heart);
  light.apply(ctx);

  // ---- which LEDs are lit (from the second course) and how strongly each segment is lit
  const strikes = courseStrikes(cues, 1), ledLv = new Float32Array(129);
  for (let n = 1; n <= 128; n++) { const t = strikes[n]; ledLv[n] = t && Tc >= t ? 0.3 + 0.7 * Math.exp(-(Tc - t) / 0.35) : 0; }
  const segSum = new Float32Array(17), segCnt = new Float32Array(17);
  for (const l of G.leds) { const i = SEG_NAMES.indexOf(l.seg); if (i < 0) continue; segSum[i] += ledLv[l.n]; segCnt[i]++; }
  const lv = new Float32Array(17);
  for (let i = 0; i < 17; i++) lv[i] = segCnt[i] ? clamp(segSum[i] / segCnt[i] * 1.25) : 0;
  const slam = lb >= 3.9 ? 1 : 0;
  if (slam) for (let i = 0; i < 17; i++) lv[i] = Math.max(lv[i], 0.9);

  const outline = G.outline, holes = new Path2D();
  holes.addPath(outline); for (const p of G.paths) holes.addPath(p);
  LAYERS.forEach((Ly, li) => {
    const th = Ly.thick * (0.35 + 0.65 * ex);
    ctx.save();
    // dressed side wall: stacked copies with a dark fill and a bright top edge
    for (let q = Math.ceil(th); q >= 1; q--) { setM(ctx, li, q * 0.9); ctx.fillStyle = L(0.04); ctx.fill(outline); }
    setM(ctx, li);
    if (Ly.kind === 'cut') { ctx.fillStyle = L(0.06); ctx.fill(holes, 'evenodd'); ctx.clip(holes, 'evenodd'); }
    else { ctx.fillStyle = L(0.05); ctx.fill(outline); ctx.clip(outline); }
    // engraver's hatch on the top face
    ctx.strokeStyle = L(0.17); ctx.lineWidth = 0.22; ctx.beginPath();
    for (let x = -80; x < 80; x += 1.7) { ctx.moveTo(x, -60); ctx.lineTo(x + 60, 60); }
    ctx.stroke();
    ctx.restore();
    ctx.save(); setM(ctx, li);
    ctx.strokeStyle = L(0.6); ctx.lineWidth = 0.55; ctx.stroke(outline);
    if (Ly.kind === 'cut') { ctx.strokeStyle = L(0.5); ctx.lineWidth = 0.35; for (const p of G.paths) ctx.stroke(p); }
    ctx.restore();

    if (Ly.kind === 'pcb') {
      ctx.save(); setM(ctx, li);
      for (const p of G.parts) {
        if (/^H/.test(p.ref)) { ctx.strokeStyle = L(0.55); ctx.lineWidth = 0.4; ctx.beginPath(); ctx.arc(p.x, p.y, 2.7, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(p.x, p.y, 1.3, 0, TAU); ctx.stroke(); continue; }
        const chip = p.ref === 'U1' || p.ref === 'U2';
        ctx.strokeStyle = L(chip ? 0.6 : 0.4); ctx.lineWidth = chip ? 0.45 : 0.3; ctx.strokeRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
        if (chip) { ctx.fillStyle = L(0.08); ctx.fillRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h); }
      }
      for (const l of G.leds) {
        const v = ledLv[l.n], on = l.seg === 'UL' ? 0 : v;
        ctx.fillStyle = L(0.1 + 0.9 * on); ctx.beginPath(); ctx.arc(l.x, l.y, 0.85, 0, TAU); ctx.fill();
        if (on > 0.05) { glow.save(); setM(glow, li); glow.globalAlpha = on; glow.fillStyle = L(0.95); glow.beginPath(); glow.arc(l.x, l.y, 1.7, 0, TAU); glow.fill(); glow.restore(); }
      }
      ctx.restore();
    }
    if (Ly.kind === 'face') {
      for (let i = 0; i < 17; i++) {
        const v = lv[i]; if (v < 0.02) continue;
        for (const c of [ctx, glow]) { c.save(); setM(c, li); c.globalAlpha = clamp(v) * (c === glow ? 0.85 : 0.95); c.fillStyle = L(0.85); c.fill(G.paths[i]); c.restore(); }
      }
    }
    if (li === 0 && ex > 0.12) {
      for (let i = 0; i < 16; i++) {
        const v = lv[i]; if (v < 0.2) continue;
        for (let q = 1; q <= 5; q++) { glow.save(); setM(glow, (q / 6) * 3); glow.globalAlpha = v * 0.1 * ex; glow.fillStyle = L(0.9); glow.fill(G.paths[i]); glow.restore(); }
      }
    }
  });
  ctx.setTransform(1, 0, 0, 1, 0, 0); glow.setTransform(1, 0, 0, 1, 0, 0);

  // ---- callouts and the facts from the README
  const a1 = sstep(1.3, 1.9, lb) * (1 - sstep(3.2, 3.7, lb));
  if (a1 > 0.02) LAYERS.forEach((Ly, li) => {
    const y = cy0 - zpx(li) - 10, x = 1400;
    ctx.strokeStyle = L(0.45 * a1); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(1190, y); ctx.lineTo(x - 20, y); ctx.stroke();
    ctx.fillStyle = L(0.7 * a1); ctx.beginPath(); ctx.arc(1190, y, 5, 0, TAU); ctx.fill();
    G.text(ctx, null, Ly.name, { x, y: y - 12, h: 30, color: L(0.9 * a1), gap: 0.3, hot: 0 });
    G.text(ctx, null, Ly.desc, { x, y: y + 24, h: 18, color: L(0.68 * a1), gap: 0.35, hot: 0 });
  });
  const a2 = sstep(0.4, 1.1, lb) * (1 - sstep(3.4, 3.8, lb));
  plaque(C, 'STRATA QUATTUOR', 400, 190, { h: 34, v: 0.75 * a2, rule: false });
  G.text(ctx, glow, '5.8 MM', { x: 400, y: 300, h: 76, align: 'center', color: L(0.8 * a2), gap: 0.22, hot: 0.4, glowK: 0.5 });
  ['THICK  63.97 G', '100 X 66.66 MM', 'THREE TO TWO'].forEach((t, i) => G.text(ctx, null, t, { x: 400, y: 376 + i * 36, h: 21, align: 'center', color: L(0.68 * a2), gap: 0.35, hot: 0 }));
  const nLit = ledLv.reduce((a, v) => a + (v > 0.25 ? 1 : 0), 0);
  G.text(ctx, null, `${roman(nLit)} LUMINA`, { x: 400, y: 900, h: 24, align: 'center', color: L(0.55 * a2), gap: 0.3, hot: 0 });
  C.fx.bloom = 1.05;
  C.fx.glitch = lb > 3.75 ? (lb - 3.75) * 1.4 : 0;
  void lerp; void smooth; void TONE; void La; void CP;
}
