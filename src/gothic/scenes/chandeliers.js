// CHANDELIERS (bars 40-43, drop 2 begins with the Dies irae on the reed): three coronas hang in the dark, each with sixteen
// candles - one per step. The near one plays the bar (kick, bass), the middle one the chains and clock, the far one shows
// the melody: every note lights the candle of its pitch. They swing on their chains; the flames are reflected in the floor.
import { TAU, clamp, lerp, smooth, sstep, ease, hash } from '../../render/util.js';
import { L, La, TONE, flicker } from '../tone.js';
import { Cam, archPts } from '../cam3d.js';
import { chain } from '../ornament.js';
import { stepEvents, plaque } from '../furniture.js';

const cam = new Cam(1920, 1080, 900, 0.5);
const RINGS = [
  { x: -5.6, y: -3.1, z: 11, r: 3.0, name: 'A' },
  { x: 6.3, y: -2.6, z: 14, r: 3.2, name: 'B' },
  { x: 0.4, y: -2.2, z: 24, r: 4.0, name: 'C' },
  { x: -7.5, y: -1.6, z: 33, r: 3.6, name: 'C' },
  { x: 8.2, y: -1.4, z: 36, r: 3.6, name: 'B' },
];
const FLOOR = -6.2;

export function chandeliers(C) {
  const { ctx, glow, G, W, H, f, cues, Tc, STEP } = C;
  const lb = C.lbar, barIdx = Math.floor(C.bar), pos = (C.bar - barIdx) * 16;
  cam.set({ x: 0.5 * Math.sin(lb * 0.6), y: 0.4, z: -1.5 + lb * 0.5, yaw: 0.05 * Math.sin(lb * 0.5), pitch: -0.14, roll: 0.01 * Math.sin(lb * 0.8) });
  const o = [0, 0, 0], o2 = [0, 0, 0];

  // ---- far arches: a tunnel of pointed arches that the coronas hang in
  ctx.lineJoin = 'round';
  for (let z = 64; z >= 26; z -= 4) {
    const fog = clamp(1 - (z - 20) / 50), pts = archPts(20, 17, -8, 16).map(([u, v]) => [u, v, z]);
    ctx.strokeStyle = L(0.42 * fog); ctx.lineWidth = 2.2; ctx.beginPath(); cam.path(ctx, pts); ctx.stroke();
    ctx.strokeStyle = L(0.25 * fog); ctx.beginPath(); cam.path(ctx, [[-10, -8, z], [-10, 9, z]]); cam.path(ctx, [[10, -8, z], [10, 9, z]]); ctx.stroke();
  }
  // floor: a faint flagstone grid
  ctx.strokeStyle = L(0.07); ctx.lineWidth = 1; ctx.beginPath();
  for (let x = -10; x <= 10; x += 2.5) cam.path(ctx, [[x, FLOOR, 4], [x, FLOOR, 60]]);
  for (let z = 5; z < 60; z += 2.5) cam.path(ctx, [[-10, FLOOR, z], [10, FLOOR, z]]);
  ctx.stroke();

  // ---- what lights the candles of each corona
  const kick = stepEvents(C, 'kick', barIdx), bass = stepEvents(C, 'bass', barIdx), chainE = stepEvents(C, 'chain', barIdx), drag = stepEvents(C, 'drag', barIdx), tick = stepEvents(C, 'tick', barIdx);
  const lead = cues.between('lead', Tc - 1.4, Tc + 0.0005);
  const litOf = (name, k) => {
    if (name === 'A') { const e = kick[k] || bass[k]; const age = e ? Tc - e[0] : -1; return { base: e ? 0.5 : 0.28, hit: e && age >= 0 ? Math.exp(-age / 0.25) : 0 }; }
    if (name === 'B') { const e = chainE[k] || drag[k] || tick[k]; const age = e ? Tc - e[0] : -1; return { base: e ? 0.5 : 0.26, hit: e && age >= 0 ? Math.exp(-age / 0.22) : 0 }; }
    let hit = 0, base = 0.22;
    for (const e of lead) if (((e[2] - 52) % 16 + 16) % 16 === k) hit = Math.max(hit, Math.exp(-(Tc - e[0]) / 0.7));
    return { base, hit };
  };

  // ---- coronas, far to near
  for (const R of [...RINGS].reverse()) {
    const swing = Math.sin((C.bar * TAU) / 2 + R.x) * 0.9, sway = Math.sin((C.bar * TAU) / 4 + R.z) * 0.35;
    const cx = R.x + swing, cy = R.y, cz = R.z + sway, spin = C.bar * 0.35 * (R.name === 'B' ? -1 : 1);
    const ceilY = cy + 9.5, ax = R.x + swing * 0.15, az = R.z + sway * 0.15;
    // chains up to the vault (three of them meeting above)
    for (let k = 0; k < 3; k++) {
      const a = spin + (k * TAU) / 3, px = cx + Math.cos(a) * R.r, pz = cz + Math.sin(a) * R.r;
      if (!cam.p(px, cy, pz, o) || !cam.p(ax, ceilY, az, o2)) continue;
      const pulses = cues.between('kick', Tc - 0.6, Tc + 0.0005).map((e) => (Tc - e[0]) / 0.5);
      chain(ctx, glow, [[o[0], o[1]], [o2[0], o2[1]]], { pitch: 18, w: 9, lw: 1.8, v: 0.22, lit: (i, u) => { let m = 0; for (const p of pulses) m = Math.max(m, Math.exp(-Math.pow((u - (1 - p)) / 0.09, 2)) * (1 - p)); return m; } });
    }
    // the ring
    const ring = []; for (let i = 0; i <= 48; i++) { const a = (i / 48) * TAU; ring.push([cx + Math.cos(a) * R.r, cy, cz + Math.sin(a) * R.r]); }
    ctx.strokeStyle = L(0.4); ctx.lineWidth = 3.4; ctx.beginPath(); cam.path(ctx, ring); ctx.stroke();
    ctx.strokeStyle = L(0.22); ctx.lineWidth = 2; ctx.beginPath(); cam.path(ctx, ring.map((p) => [p[0], p[1] - 0.16, p[2]])); ctx.stroke();
    // sixteen candles, step 0 at the front-left and running around
    for (let k = 0; k < 16; k++) {
      const a = spin + (k * TAU) / 16 + Math.PI / 2, x = cx + Math.cos(a) * R.r, z = cz + Math.sin(a) * R.r;
      if (!cam.p(x, cy, z, o) || !cam.p(x, cy + 0.42, z, o2)) continue;
      const scale = cam.F / o[2], { base, hit } = litOf(R.name, k), cur = R.name === 'A' && Math.floor(pos) === k ? 0.4 : 0;
      const fl = flicker(Tc, k + R.z), v = clamp(base * (0.75 + 0.35 * fl) + 0.7 * hit + cur);
      ctx.strokeStyle = L(0.3); ctx.lineWidth = Math.max(1.5, 0.11 * scale); ctx.beginPath(); ctx.moveTo(o[0], o[1]); ctx.lineTo(o2[0], o2[1]); ctx.stroke();
      const fh = 0.5 * scale * (0.7 + 0.5 * v), fw = 0.11 * scale * (0.8 + 0.4 * v), fx = o2[0], fy = o2[1];
      ctx.fillStyle = L(0.35 + 0.65 * v); ctx.beginPath(); ctx.ellipse(fx, fy - fh * 0.5, fw, fh * 0.5, 0, 0, TAU); ctx.fill();
      glow.globalAlpha = 0.5 + 0.5 * v; glow.fillStyle = L(0.5 + 0.5 * v); glow.beginPath(); glow.ellipse(fx, fy - fh * 0.5, fw * 1.6, fh * 0.75, 0, 0, TAU); glow.fill();
      if (v > 0.35) { const g = ctx.createRadialGradient(fx, fy - fh * 0.5, 1, fx, fy - fh * 0.5, scale * 0.9); g.addColorStop(0, La(0.22 * v, 0.5)); g.addColorStop(1, La(0, 0)); ctx.fillStyle = g; ctx.fillRect(fx - scale, fy - scale * 1.4, scale * 2, scale * 2); }
      glow.globalAlpha = 1;
      // reflection in the polished floor
      if (cam.p(x, 2 * FLOOR - (cy + 0.42), z, o2)) { glow.globalAlpha = 0.5 * v; glow.fillStyle = L(0.85); glow.beginPath(); glow.ellipse(o2[0], o2[1], fw * 1.4, fh * 0.5, 0, 0, TAU); glow.fill(); glow.globalAlpha = 1; }
    }
  }

  plaque(C, 'DIES IRAE', 960, 96, { h: 42, v: 0.72 * (1 - sstep(2.5, 3.3, lb)) * sstep(0.1, 0.6, lb), rule: false });
  G.text(ctx, null, 'XVI CANDLES  XVI STEPS', { x: 960, y: 1000, h: 19, align: 'center', color: L(0.52), gap: 0.4, hot: 0 });
  C.fx.bloom = 1.1 + 0.1 * f.kickS + 0.7 * f.impact;
  void lerp; void smooth; void ease; void hash; void TONE; void STEP;
}
