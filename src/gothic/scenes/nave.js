// NAVE: a wireframe gothic nave in perspective - clustered piers, pointed arcade arches, groin-vault ribs, clerestory lancets and
// a mirror-polished floor - flown through towards a rose window at the far end. Every kick sends a bright wave down the ribs.
// In drop 1 the 16 petals of that rose light up one per bar: the 16 rows of the first course.
import { TAU, clamp, lerp, smooth, sstep, ease } from '../../render/util.js';
import { L, La, TONE } from '../tone.js';
import { Cam, archPts } from '../cam3d.js';
import { petal, sector, roseFrame, stepAngle } from '../rose.js';
import { stone, Light } from '../ornament.js';
import { ledBoard, plaque } from '../furniture.js';
import { roman } from '../tone.js';

const HALF = 4, SPRING = 7, APEX = 14, BAY = 5;
const cam = new Cam(1920, 1080, 880, 0.6);

// ---- bay geometry, built once in local coordinates (z 0..BAY) ------------------------------------------------
const G3 = (() => {
  const rise = APEX - SPRING, g = {};
  g.arch = archPts(2 * HALF, rise, SPRING, 16).map(([u, v]) => [u, v, 0]);
  g.diag1 = []; g.diag2 = [];
  for (let i = 0; i <= 16; i++) { const s = i / 16, y = SPRING + 5.6 * Math.sin(Math.PI * s); g.diag1.push([-HALF + 2 * HALF * s, y, BAY * s]); g.diag2.push([HALF - 2 * HALF * s, y, BAY * s]); }
  g.ridge = [[0, APEX, 0], [0, APEX, BAY]];
  g.arcL = archPts(BAY * 0.96, 3.3, SPRING, 12).map(([u, v]) => [-HALF, v, u + BAY / 2]);
  g.arcR = archPts(BAY * 0.96, 3.3, SPRING, 12).map(([u, v]) => [HALF, v, u + BAY / 2]);
  const lancet = (x) => { const a = archPts(1.7, 2.6, 9.6, 10); return [[x, 8.3, BAY / 2 - 0.85], ...a.map(([u, v]) => [x, v, u + BAY / 2]), [x, 8.3, BAY / 2 + 0.85]]; };
  g.winL = lancet(-HALF); g.winR = lancet(HALF);
  g.piers = [];
  for (const sx of [-1, 1]) for (const dz of [-0.3, 0, 0.3]) g.piers.push([[sx * HALF, 0, dz], [sx * HALF, SPRING, dz]]);
  g.caps = [];
  for (const sx of [-1, 1]) for (const y of [0.35, SPRING - 0.2]) g.caps.push([[sx * HALF - 0.4, y, -0.4], [sx * HALF + 0.4, y, -0.4], [sx * HALF + 0.4, y, 0.4], [sx * HALF - 0.4, y, 0.4], [sx * HALF - 0.4, y, -0.4]]);
  return g;
})();

let light = null;

/**
 * opts: z0, z1 (camera flight in metres over the scene), roseZ, roseR, roseLit(C) -> (petalIndex) => 0..1, board: {course, ...}
 */
export function nave(opts) {
  const { z0 = 4, z1 = 84, roseZ = 150, roseR = 9, far = 150, camY = 1.9, sway = 0.45, board = null, title = null } = opts;
  return function drawNave(C) {
    const { ctx, glow, G, W, H, f, cues, Tc } = C;
    const u = clamp(C.lbar / (C.sc.b1 - C.sc.b0));
    const camZ = lerp(z0, z1, ease.io2(u) * 0.35 + u * 0.65);
    cam.set({ x: sway * Math.sin(C.lbar * 0.7), y: camY - 0.16 * f.kick + 0.15 * Math.sin(C.lbar * 1.3), z: camZ, yaw: 0.05 * Math.sin(C.lbar * 0.5 + 1), pitch: 0.085 + 0.02 * f.kickS, roll: 0.012 * Math.sin(C.lbar * 0.9) });

    // ---- the far end: the rose window is drawn first (it is behind everything) with a soft halo
    const o = [0, 0, 0], dEnd = roseZ - camZ, hz = cam.p(0, 9.5, roseZ, o);
    if (hz) {
      const R = (roseR * cam.F) / o[2], g = ctx.createRadialGradient(o[0], o[1], R * 0.2, o[0], o[1], R * 2.4);
      g.addColorStop(0, La(0.5, 0.55)); g.addColorStop(0.5, La(0.2, 0.3)); g.addColorStop(1, La(0, 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const lit = opts.roseLit ? opts.roseLit(C) : () => 0.15;
      ctx.fillStyle = L(0.02); ctx.beginPath(); ctx.arc(o[0], o[1], R, 0, TAU); ctx.fill();
      for (let i = 0; i < 16; i++) {
        const a = stepAngle(i), v = lit(i), p = petal(o[0], o[1], R * 0.42, R * 0.94, a, (TAU / 16) * 0.86, 1.2);
        ctx.fillStyle = L(0.08 + 0.85 * v); ctx.fill(p);
        ctx.strokeStyle = L(0.3 + 0.5 * v); ctx.lineWidth = Math.max(1, R * 0.012); ctx.stroke(p);
        if (v > 0.05) { glow.globalAlpha = v; glow.fillStyle = L(0.9); glow.fill(p); glow.globalAlpha = 1; }
        const q = sector(o[0], o[1], R * 0.3, R * 0.38, a - 0.17, a + 0.17); ctx.fillStyle = L(0.06 + 0.5 * v); ctx.fill(q);
      }
      roseFrame(ctx, o[0], o[1], R, { n: 16, v: 0.4, hub: 0.28 });
      // the hub carries the module
      G.text(ctx, glow, '16', { x: o[0], y: o[1], h: Math.max(8, R * 0.34), align: 'center', color: L(0.9), off: L(0.05), gap: 0.2, hot: 0.5, glowK: 0.8 });
    }

    // ---- floor (y = 0): flagstone lines, drawn faintly, and their mirror is the nave reflected in the polished stone
    const floorAlpha = 0.5;
    ctx.lineWidth = 1.2;
    for (const x of [-4, -2, 0, 2, 4]) { ctx.strokeStyle = L(0.1); ctx.beginPath(); cam.path(ctx, [[x, 0, camZ + 1], [x, 0, camZ + far]]); ctx.stroke(); }
    ctx.strokeStyle = L(0.08); ctx.beginPath();
    for (let z = Math.ceil((camZ + 1) / 2.5) * 2.5; z < camZ + far; z += 2.5) cam.path(ctx, [[-4, 0, z], [4, 0, z]]);
    ctx.stroke();

    // ---- the wave: each kick launches a bright band that races away from the camera
    const kicks = cues.between('kick', Tc - 1.4, Tc + 0.0005);
    const wave = (z) => { let m = 0; for (const e of kicks) { const zw = camZ + (Tc - e[0]) * 46 + 2; m = Math.max(m, Math.exp(-Math.pow((z - zw) / 7, 2)) * Math.exp(-(Tc - e[0]) / 0.9)); } return m; };

    // ---- bays, far to near; each drawn twice (real + reflection)
    const i0 = Math.floor((camZ - 2) / BAY), i1 = Math.floor((camZ + far) / BAY);
    const pieces = [['arch', 1, 1], ['diag1', 0.5, 0.55], ['diag2', 0.5, 0.55], ['ridge', 0.7, 0.7], ['arcL', 0.85, 0.9], ['arcR', 0.85, 0.9], ['winL', 0.8, 0.8], ['winR', 0.8, 0.8]];
    for (let i = i1; i >= i0; i--) {
      const zb = i * BAY, d = zb + BAY / 2 - camZ;
      if (d < -1) continue;
      const fog = Math.pow(clamp(1 - d / far), 1.5), wv = wave(zb), kn = fog * Math.min(1, (d + 1) / 3);
      if (kn < 0.01) continue;
      const lw = clamp(48 / (d + 6), 1.1, 6);
      const bayLit = opts.bayLit ? opts.bayLit(C, i) : 0;
      const tone = clamp(0.4 + 0.2 * f.kickS + 0.7 * wv + 0.4 * bayLit);   // the whole nave breathes on the kick, the wave rides on top
      for (const mirror of [false, true]) {
        ctx.globalAlpha = kn * (mirror ? 0.28 : 1);
        for (const [name, k, wk] of pieces) {
          const pts = G3[name];
          ctx.strokeStyle = L(tone * k); ctx.lineWidth = lw * wk; ctx.lineJoin = 'round'; ctx.beginPath();
          const sh = pts.map((p) => [p[0], mirror ? -p[1] : p[1], p[2] + zb]);
          cam.path(ctx, sh, name.startsWith('win'));
          ctx.stroke();
        }
        ctx.strokeStyle = L(0.38 + 0.18 * f.kickS + 0.4 * wv); ctx.lineWidth = lw * 1.1; ctx.beginPath();
        for (const p of G3.piers) cam.path(ctx, p.map((q) => [q[0], mirror ? -q[1] : q[1], q[2] + zb]));
        for (const p of G3.caps) cam.path(ctx, p.map((q) => [q[0], mirror ? -q[1] : q[1], q[2] + zb]));
        ctx.stroke();
        // LED beads along the transverse arch of the nearer bays
        if (!mirror && d < 70) {
          ctx.fillStyle = L(0.55 + 0.45 * wv); const rr = clamp(150 / (d + 10), 1.3, 4.5);
          for (let k = 0; k < G3.arch.length; k += 2) { const q = G3.arch[k]; if (cam.p(q[0], q[1], q[2] + zb, o)) { ctx.beginPath(); ctx.arc(o[0], o[1], rr, 0, TAU); ctx.fill(); } }
        }
        // glow only for what the wave is touching
        const gk = Math.max(wv, 0.3 * clamp(1 - d / 26));
        if (!mirror && gk > 0.1) {
          glow.globalAlpha = kn * gk * 0.85; glow.strokeStyle = L(1); glow.lineWidth = lw * 1.7; glow.beginPath();
          cam.path(glow, G3.arch.map((p) => [p[0], p[1], p[2] + zb])); cam.path(glow, G3.diag1.map((p) => [p[0], p[1], p[2] + zb])); cam.path(glow, G3.diag2.map((p) => [p[0], p[1], p[2] + zb]));
          glow.stroke(); glow.globalAlpha = 1;
        }
      }
      ctx.globalAlpha = 1;
    }

    // ---- the board fills with light as the course is rung
    if (board) {
      const n = ledBoard(C, { x: 170, y: 850, s: 3.0, course: board.course, mode: 'fill', r: 0.85 });
      G.text(ctx, null, `${roman(n)} LUMINA`, { x: 170, y: 1018, h: 18, align: 'center', color: L(0.6), gap: 0.4, hot: 0 });
    }
    if (title) plaque(C, title, 960, 90, { h: 28, v: 0.5 * (1 - sstep(1.5, 2.5, C.lbar)) * sstep(0.1, 0.6, C.lbar), rule: false });
    C.fx.bloom = 1.05 + 0.15 * f.kickS + 0.9 * f.impact;
    void TONE; void smooth; void lerp;
  };
}
