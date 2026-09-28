// TUNNEL: fly through a corridor of Klais-16 panels. Speed ramps over the four bars (the riser before the breakdown).
import { P, LED, TAU, clamp, E, rgba, mix, hash, hash2, ease, sstep, frac, lerp } from '../util.js';
import { grid, corners, label } from '../ui.js';
import { disc, ring } from '../bauhaus.js';
import { camera } from './wall.js';

const MSG = 'SIXTEEN SEGMENT DISPLAY KLAIS-16 ';

export function tunnel({ twist = 0.32, speed0 = 0.5, speed1 = 2.2, cols = LED } = {}) {
  return function draw(C) {
    const { ctx, glow, G, W, H, f, cues, Tc } = C;
    const cx = W / 2 + Math.sin(C.beat * 0.5) * 60, cy = H / 2 + Math.cos(C.beat * 0.37) * 40;
    const lb = C.lbar, len = C.sc.b1 - C.sc.b0, u = clamp(lb / len);
    // travel distance (in panels) integrates a speed that ramps up: exact closed form
    const beats = lb * 4, v0 = speed0, v1 = speed1, tot = len * 4;
    const dist = v0 * beats + 0.5 * (v1 - v0) * beats * beats / tot + f.kick * 0.15;
    const N = 18, ZS = 0.55, roll = Math.sin(C.beat * 0.25) * 0.18 + u * u * 1.2;
    // radial rays
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(roll * 0.6);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU; ctx.fillStyle = rgba(cols[i % 5], 0.06 + 0.06 * f.kick + 0.05 * u);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 1500, a, a + TAU / 48); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // panels, far to near (sorted by depth)
    const lvBuf = new Float32Array(17), items = [];
    for (let j = 0; j < N; j++) items.push({ j, z: (((j - dist) % N + N) % N) * ZS + 0.35 });
    items.sort((a, b) => b.z - a.z);
    for (const { j, z } of items) {
      const s = 7.8 / z;
      const ang = j * twist + roll;
      const fade = clamp((N * ZS - z + 0.35) / 3.2) * clamp((z - 0.35) / 0.8);
      if (fade <= 0.01) continue;
      const col = cols[((j % cols.length) + cols.length) % cols.length];
      const ch = MSG[(((j + Math.floor(dist / N) * 3) % MSG.length) + MSG.length) % MSG.length];
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang); ctx.scale(s, s);
      ctx.globalAlpha = fade * 0.5; ctx.fillStyle = mix(P.INK, col, 0.22); ctx.fill(G.outline);
      ctx.globalAlpha = fade; ctx.lineWidth = Math.max(2.4, 6 / s) * (1 + 1.2 * f.kick * (z < 3 ? 1 : 0)); ctx.strokeStyle = col; ctx.stroke(G.outline);
      ctx.restore();
      glow.save(); glow.translate(cx, cy); glow.rotate(ang); glow.scale(s, s); glow.globalAlpha = fade * 0.6; glow.lineWidth = Math.max(2, 6 / s); glow.strokeStyle = col; glow.stroke(G.outline); glow.restore();
      G.lvChar(ch, lvBuf);
      G.draw(ctx, glow, { x: cx, y: cy, s, lv: lvBuf, color: col, rot: ang, off: null, edge: null, alpha: fade, hot: 0.35, glowK: 0.8 });
    }
    // vanishing point
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 140); g.addColorStop(0, 'rgba(244,236,220,0.85)'); g.addColorStop(1, 'rgba(244,236,220,0)');
    ctx.fillStyle = g; ctx.globalAlpha = 0.12 + 0.35 * u; ctx.fillRect(cx - 150, cy - 150, 300, 300); ctx.globalAlpha = 1;
    label(C, 'SPEED X' + (lerp(v0, v1, u * u) / v0).toFixed(1), 96, H - 110, 22, rgba(P.WHT, 0.7));
    C.fx.bloom = 0.9;
    C.fx.glitch = u > 0.86 ? (u - 0.86) * 4 : 0;
    C.fx.split = 1 + 6 * u * u + 3 * f.kick;
  };
}
