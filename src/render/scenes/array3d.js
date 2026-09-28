// ARRAY (drop 2): a big array of modules lying on a table, seen by a swinging perspective camera - the isoArray photo
// from the README, brought to life. Canvas2D has no perspective transform, so every segment polygon is projected by hand.
import { P, LED, TAU, clamp, E, rgba, mix, hash, hash2, sstep, ease, frac, lerp } from '../util.js';
import { label } from '../ui.js';

const MSG = ['OPEN HARDWARE   ', 'SIXTEEN SEGMENT ', 'KLAIS 16  BY KOLIBRI  ', 'CERN OHL S  GPL 3  '];
const COLS = 14, ROWS = 4, MW = 66.667, MH = 100;

export function array3d(C) {
  const { ctx, glow, G, W, H, f, cues, Tc, BAR, BEAT } = C;
  const lb = C.lbar, len = C.sc.b1 - C.sc.b0, u = clamp(lb / len);
  const totW = COLS * MW, totH = ROWS * MH;
  // ---- camera: sweeps along the array while swinging and dipping on the kick
  const dolly = ease.io3(u);
  const tx = lerp(-0.28, 0.28, dolly) * totW, ty = Math.sin(lb * 0.9) * 40;
  const yaw = 0.42 * Math.sin(lb * 0.75 + 0.6) - 0.1, pitch = 0.62 + 0.22 * Math.sin(lb * 1.1) - 0.04 * f.kick;
  const dist = 820 - 160 * f.kick - 120 * Math.sin(u * Math.PI);
  const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const rot = (x, y) => [x * cyw - y * syw, x * syw + y * cyw];
  const r = [...rot(1, 0), 0], fw = [...rot(0, -cp), -sp], up = [...rot(0, -sp), cp];
  const E0 = [tx - fw[0] * dist, ty - fw[1] * dist, -fw[2] * dist];
  const F = 1500;
  const proj = (x, y, z, out) => {
    const px = x - E0[0], py = y - E0[1], pz = z - E0[2];
    const d = px * fw[0] + py * fw[1] + pz * fw[2];
    if (d < 40) return false;
    out[0] = W / 2 + (F * (px * r[0] + py * r[1] + pz * r[2])) / d;
    out[1] = H * 0.52 - (F * (px * up[0] + py * up[1] + pz * up[2])) / d;
    out[2] = d;
    return true;
  };

  // ---- ground glow + fog
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0a0b14'); g.addColorStop(0.5, '#07070b'); g.addColorStop(1, '#040407');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // horizon Bauhaus sun (flat disc) far behind
  ctx.fillStyle = mix(P.INK, P.RED, 0.85); ctx.beginPath(); ctx.arc(W * 0.5 + Math.sin(lb) * 120, 190, 150, 0, TAU); ctx.fill();
  ctx.fillStyle = mix(P.INK, P.YEL, 0.85); ctx.beginPath(); ctx.arc(W * 0.5 + Math.sin(lb) * 120, 190, 96, 0, TAU); ctx.fill();

  // ---- modules (far to near by row so overlaps look right)
  const kI = f.kickN, [ox, oy] = [hash2(kI, 1) * COLS, hash2(kI, 2) * ROWS], age = Tc - (cues.last('kick', Tc)?.[0] ?? 0), radius = age * 22;
  const tmp = [0, 0, 0], lv = new Float32Array(17), pts = [];
  const order = [];
  for (let rr = 0; rr < ROWS; rr++) for (let c = 0; c < COLS; c++) order.push([rr, c]);
  order.sort((a, b) => a[0] - b[0]);   // back rows first (they are farther when the camera looks north)
  const beatI = Math.floor(C.beat);
  for (const [rr, c] of order) {
    const wx = (c + 0.5) * MW - totW / 2, wy = (rr + 0.5) * MH - totH / 2;
    if (!proj(wx, wy, 0, tmp) || tmp[2] > 2600) continue;
    const fog = clamp(1 - (tmp[2] - 900) / 1700);
    // board quad
    const q = [[-MW / 2, -MH / 2], [MW / 2, -MH / 2], [MW / 2, MH / 2], [-MW / 2, MH / 2]];
    let ok = true; const sq = q.map(([qx, qy]) => { const o = [0, 0, 0]; ok = proj(wx + qx, wy + qy, 0, o) && ok; return o; });
    if (!ok) continue;
    const msg = MSG[rr % MSG.length], ch = msg[(((c + beatI * (rr % 2 ? 1 : -1) + rr * 5) % msg.length) + msg.length) % msg.length];
    const d1 = Math.hypot(c + 0.5 - ox, (rr + 0.5 - oy) * 1.5), w = Math.exp(-Math.pow((d1 - radius) / 1.8, 2));
    ctx.globalAlpha = fog; ctx.fillStyle = mix('#08080c', LED[(c + rr) % 5], 0.06 + 0.16 * w);
    ctx.beginPath(); sq.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1; ctx.stroke();
    G.lv(G.mask(ch), lv);
    const col = LED[(c + Math.floor(rr * 2) + beatI) % 5];
    for (let i = 0; i < 17; i++) {
      const poly = G.polys[i], on = lv[i] ? clamp(0.55 + 0.6 * w + 0.15 * f.rms) : 0;
      ctx.beginPath(); let vis = true;
      poly.forEach(([px_, py_], k) => { const o = [0, 0, 0]; vis = proj(wx + px_, wy + py_, 0, o) && vis; k ? ctx.lineTo(o[0], o[1]) : ctx.moveTo(o[0], o[1]); });
      ctx.closePath();
      if (!vis) continue;
      if (on > 0.02) {
        ctx.globalAlpha = clamp(on) * fog; ctx.fillStyle = col; ctx.fill();
        if (tmp[2] < 2000) { glow.globalAlpha = clamp(on) * fog * 0.85; glow.fillStyle = col; glow.beginPath(); poly.forEach(([px_, py_], k) => { const o = [0, 0, 0]; proj(wx + px_, wy + py_, 0, o); k ? glow.lineTo(o[0], o[1]) : glow.moveTo(o[0], o[1]); }); glow.closePath(); glow.fill(); glow.globalAlpha = 1; }
      } else { ctx.globalAlpha = 0.5 * fog; ctx.fillStyle = '#15161d'; ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }
  label(C, 'ISO ARRAY  14 X 4', 96, H - 120, 22, rgba(P.WHT, 0.75));
  label(C, 'NO GAPS BETWEEN CHARACTERS', 96, H - 86, 18, rgba(P.WHT, 0.5));
  C.fx.bloom = 1.05;
}
