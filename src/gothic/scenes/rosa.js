// ROSA (bars 8-11): the sixteen-step sequencer as a rose window. One turn of the beam = one bar, one part = one sixteenth.
// Four rings: bells (petals), chains, kick, and the drifting five-step clock ticks; the hub names the chord.
import { TAU, clamp, lerp, smooth, sstep } from '../../render/util.js';
import { L, La, TONE, roman } from '../tone.js';
import { stone, Light, archPath, crockets } from '../ornament.js';
import { sector, petal, roseFrame, stepAngle } from '../rose.js';
import { stepEvents, plaque } from '../furniture.js';

let light = null;
const PI = Math.PI;
const CHORD_NAMES = { Em: 'EM', C: 'C', Am: 'AM', B: 'B' };

export function rosa(C) {
  const { ctx, glow, G, W, H, f, cues, Tc, STEP } = C;
  light = light || new Light(W, H);
  const cx = 960, cy = 505, R = 420, barIdx = Math.floor(C.bar), pos = (C.bar - barIdx) * 16;   // pos = continuous step
  const pump = 1 + 0.012 * f.kick;
  const rings = [
    { kind: 'bell', r0: 300, r1: 396, name: 'CAMPANAE', petals: true },
    { kind: 'chain', kind2: 'drag', r0: 232, r1: 288, name: 'CATENAE' },
    { kind: 'kick', r0: 166, r1: 220, name: 'TYMPANUM' },
    { kind: 'tick', r0: 138, r1: 154, name: 'HOROLOGIUM', dots: true },
  ];

  ctx.drawImage(stone(W, H, 9, { course: 100, block: 210 }), 0, 0);
  light.begin(0.04 + 0.05 * f.kick);
  light.add(cx, cy, 760, 0.55 + 0.25 * f.kick);
  light.apply(ctx);

  ctx.save(); ctx.translate(cx, cy); ctx.scale(pump, pump); ctx.translate(-cx, -cy);
  ctx.fillStyle = L(0.012); ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();

  // ---- the panes: dim when the bar's pattern has an event there, flashing when the beam has just passed
  const dA = (PI / 16) * 0.82;
  for (const rg of rings) {
    const ev = stepEvents(C, rg.kind, barIdx), ev2 = rg.kind2 ? stepEvents(C, rg.kind2, barIdx) : null;
    for (let i = 0; i < 16; i++) {
      const e = ev[i] || (ev2 && ev2[i]), a = stepAngle(i), age = e ? Tc - e[0] : -1;
      const has = !!e, hit = has && age >= 0 ? Math.exp(-age / 0.22) : 0;
      const lvl = (has ? 0.2 : 0.045) + 0.75 * hit;
      if (rg.dots) {
        const rr = (rg.r0 + rg.r1) / 2, x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
        ctx.fillStyle = L(has ? 0.25 + 0.7 * hit : 0.07); ctx.beginPath(); ctx.arc(x, y, 5 + 4 * hit, 0, TAU); ctx.fill();
        if (hit > 0.05) { glow.globalAlpha = hit; glow.fillStyle = L(1); glow.beginPath(); glow.arc(x, y, 9, 0, TAU); glow.fill(); glow.globalAlpha = 1; }
        continue;
      }
      const p = rg.petals ? petal(cx, cy, rg.r0, rg.r1, a, dA * 2, 1.2) : sector(cx, cy, rg.r0, rg.r1, a - dA, a + dA);
      ctx.fillStyle = L(lvl * (has ? 1 : 1)); ctx.fill(p);
      ctx.strokeStyle = L(0.3 + 0.5 * hit); ctx.lineWidth = 2; ctx.stroke(p);
      if (hit > 0.03) { glow.globalAlpha = hit * 0.9; glow.fillStyle = L(0.95); glow.fill(p); glow.globalAlpha = 1; }
    }
  }
  roseFrame(ctx, cx, cy, R, { n: 16, v: 0.36, hub: 0.3 });
  ctx.restore();

  // ---- the beam: a wedge that trails behind the playhead
  const aH = stepAngle(pos), trail = 0.9;
  const g = ctx.createConicGradient(aH - trail, cx, cy);
  g.addColorStop(0, La(0.5, 0)); g.addColorStop(trail / TAU, La(0.5, 0.35)); g.addColorStop(trail / TAU + 0.0015, La(0.5, 0)); g.addColorStop(1, La(0.5, 0));
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 0.98, 0, TAU); ctx.fill(); ctx.restore();
  ctx.strokeStyle = L(0.95); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx + Math.cos(aH) * 128, cy + Math.sin(aH) * 128); ctx.lineTo(cx + Math.cos(aH) * R * 0.96, cy + Math.sin(aH) * R * 0.96); ctx.stroke();
  glow.strokeStyle = L(0.9); glow.lineWidth = 6; glow.beginPath(); glow.moveTo(cx + Math.cos(aH) * 128, cy + Math.sin(aH) * 128); glow.lineTo(cx + Math.cos(aH) * R * 0.96, cy + Math.sin(aH) * R * 0.96); glow.stroke();

  // ---- hub: the chord in the segment font
  const chord = cues.last('chord', Tc), name = CHORD_NAMES[chord ? chord[1] : 'Em'];
  ctx.fillStyle = L(0.02); ctx.beginPath(); ctx.arc(cx, cy, 118, 0, TAU); ctx.fill();
  G.text(ctx, glow, name, { x: cx, y: cy, h: 96, align: 'center', color: L(0.9), off: L(0.05), edge: L(0.1), gap: 0.22, hot: 0.55, glowK: 0.9 });

  // ---- legend and inscription
  rings.forEach((rg, i) => {
    const y = 300 + i * 70;
    G.text(ctx, null, roman(i + 1), { x: 126, y, h: 24, color: L(0.75), gap: 0.3, hot: 0 });
    G.text(ctx, null, rg.name, { x: 226, y, h: 24, color: L(0.55), gap: 0.3, hot: 0 });
    ctx.strokeStyle = L(0.3); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(110, y + 24); ctx.lineTo(500, y + 24); ctx.stroke();
  });
  plaque(C, 'ROSA SEDECIM', 1600, 200, { h: 34, v: 0.7 });
  G.text(ctx, null, 'ONE TURN  ONE BAR', { x: 1600, y: 262, h: 20, align: 'center', color: L(0.5), gap: 0.4, hot: 0 });
  G.text(ctx, null, 'SIXTEEN PARTS  SIXTEEN STEPS', { x: 1600, y: 300, h: 20, align: 'center', color: L(0.5), gap: 0.4, hot: 0 });
  C.fx.bloom = 1;
  void lerp; void smooth; void sstep; void clamp; void archPath; void crockets; void TONE; void STEP;
}
