// ROSA II (bars 44-47): SEDECIM SEGMENTA - sixteen characters, sixteen petals. The window snaps 22.5 degrees on every beat (one full
// turn in four bars). The bells of the third course ring the letters: two rows a bar, the first eight strikes of a bar spell
// SEDECIM_ and the next eight SEGMENTA, in the order the hunt rings them - an anagram machine.
import { TAU, clamp, lerp, smooth, sstep, ease } from '../../render/util.js';
import { L, La, TONE } from '../tone.js';
import { stone, Light, foilPath } from '../ornament.js';
import { sector, petal, roseFrame, stepAngle } from '../rose.js';
import { stepEvents } from '../furniture.js';

let light = null;
const PHRASE = 'SEDECIM SEGMENTA';
const PI = Math.PI;

export function rosa2(C) {
  const { ctx, glow, G, W, H, f, cues, Tc } = C;
  light = light || new Light(W, H);
  const cx = 960, cy = 528, R = 480, barIdx = Math.floor(C.bar);
  const beat = C.bar * 4, snap = Math.floor(beat) + ease.outBack(clamp((beat % 1) / 0.55)), rot = snap * (TAU / 16);
  const pump = 1 + 0.018 * f.kick;

  ctx.drawImage(stone(W, H, 61, { course: 92, block: 200 }), 0, 0);
  light.begin(0.03 + 0.05 * f.kick);
  light.add(cx, cy, 820, 0.6 + 0.2 * f.kick);
  light.apply(ctx);

  // ---- strikes of the last 0.6 s decide which letters ring (petal = bell - 1, +8 in the odd row)
  const ring = new Float32Array(16);
  for (const e of cues.between('bell', Tc - 0.8, Tc + 0.0005)) { const petalIdx = (e[1] - 1) + 8 * (e[2] % 2); ring[petalIdx] = Math.max(ring[petalIdx], Math.exp(-(Tc - e[0]) / 0.28)); }
  const kick = stepEvents(C, 'kick', barIdx);

  ctx.save(); ctx.translate(cx, cy); ctx.scale(pump, pump); ctx.translate(-cx, -cy);
  ctx.fillStyle = L(0.012); ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
  for (let i = 0; i < 16; i++) {
    const a = stepAngle(i) + rot, e = ring[i];
    // petal
    const p = petal(cx, cy, R * 0.56, R * 0.95, a, (TAU / 16) * 0.88, 1.15);
    ctx.fillStyle = L(0.04 + 0.26 * e); ctx.fill(p);
    ctx.strokeStyle = L(0.32 + 0.5 * e); ctx.lineWidth = 2.5; ctx.stroke(p);
    if (e > 0.03) { glow.globalAlpha = e * 0.55; glow.fillStyle = L(0.7); glow.fill(p); glow.globalAlpha = 1; }
    // letter, kept upright
    const rr = R * 0.745, x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr, ch = PHRASE[i];
    if (ch !== ' ') G.draw(ctx, glow, { x, y, s: 1.28, lv: G.lv(G.mask(ch), new Float32Array(17)), color: L(0.5 + 0.5 * e), off: L(0.05), edge: L(0.1), hot: 0.75 * e, glowK: 0.6 * e + 0.15 });
    else { ctx.fillStyle = L(0.2 + 0.7 * e); ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.fill(); }
    // inner ring lights on the kick steps of this bar (a pane per step, fixed to the window)
    const k = kick[(i + 16 - Math.round(snap % 16)) % 16], age = k ? Tc - k[0] : -1, hit = k && age >= 0 ? Math.exp(-age / 0.25) : 0;
    const q = sector(cx, cy, R * 0.36, R * 0.5, a - 0.17, a + 0.17);
    ctx.fillStyle = L(0.05 + 0.6 * hit); ctx.fill(q); ctx.strokeStyle = L(0.3 + 0.4 * hit); ctx.lineWidth = 1.5; ctx.stroke(q);
    if (hit > 0.05) { glow.globalAlpha = hit; glow.fillStyle = L(0.9); glow.fill(q); glow.globalAlpha = 1; }
  }
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.translate(-cx, -cy);
  roseFrame(ctx, cx, cy, R, { n: 16, v: 0.42, hub: 0.34 });
  ctx.restore();
  ctx.restore();

  // ---- the hub: the row of the course being rung
  const last = cues.last('bell', Tc), row = last ? last[2] : 0;
  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(cx, cy, R * 0.3, 0, TAU); ctx.fill();
  ctx.strokeStyle = L(0.6); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, R * 0.3, 0, TAU); ctx.stroke();
  G.text(ctx, glow, String(row).padStart(2, '0'), { x: cx, y: cy - 6, h: 118, align: 'center', color: L(0.92), off: L(0.05), edge: L(0.1), gap: 0.2, hot: 0.55, glowK: 0.9 });
  G.text(ctx, null, 'ROW', { x: cx, y: cy + 88, h: 18, align: 'center', color: L(0.5), gap: 0.5, hot: 0 });
  for (const [x, y] of [[140, 140], [1780, 140], [140, 940], [1780, 940]]) { ctx.strokeStyle = L(0.4); ctx.lineWidth = 3; ctx.stroke(foilPath(x, y, 40, 4, PI / 4)); ctx.fillStyle = L(0.1); ctx.fill(foilPath(x, y, 40, 4, PI / 4)); }
  C.fx.bloom = 1.05 + 0.15 * f.snare;
  void lerp; void smooth; void sstep; void TONE; void La; void H; void W;
}
