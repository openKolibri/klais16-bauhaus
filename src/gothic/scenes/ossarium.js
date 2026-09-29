// OSSARIUM (bars 48-55): the ASCII table as a wall of niches - 16 columns x 8 rows = 128 codes, one for every strike of the
// fourth course and every LED of the board. Row r of the course rings codes 8r..8r+7, so the wall fills up in reading order
// while the Dies irae wakes the letters D I E S I R A E. The first two rows are the control codes; BEL is the bell.
import { TAU, clamp, lerp, smooth, sstep, ease } from '../../render/util.js';
import { L, La, TONE, roman } from '../tone.js';
import { stone, Light, archPath } from '../ornament.js';
import { courseStrikes, ledBoard, plaque } from '../furniture.js';

let light = null;
const CTRL = ['NUL', 'SOH', 'STX', 'ETX', 'EOT', 'ENQ', 'ACK', 'BEL', 'BS', 'HT', 'LF', 'VT', 'FF', 'CR', 'SO', 'SI', 'DLE', 'DC1', 'DC2', 'DC3', 'DC4', 'NAK', 'SYN', 'ETB', 'CAN', 'EM', 'SUB', 'ESC', 'FS', 'GS', 'RS', 'US'];
const DIES = 'DIESIRAE';

export function ossarium(C) {
  const { ctx, glow, G, W, H, f, cues, Tc } = C;
  light = light || new Light(W, H);
  const lb = C.lbar, st = courseStrikes(cues, 3);
  // camera: a slow sway across the wall, closer and livelier in the second half
  const u = lb / 8, yaw = 0.26 * Math.sin(lb * 0.62), dist = lerp(15.2, 13.2, ease.io2(u)) - 0.4 * f.kickS, ph = 0.03 * Math.sin(lb * 0.9);
  const F = 1380, cxs = 960, cys = 520, cosY = Math.cos(yaw), sinY = Math.sin(yaw);
  const proj = (x, y) => { const X = x * cosY, Z = dist + x * sinY; return [cxs + (F * X) / Z, cys + (F * (y + ph * x)) / Z, F / Z]; };

  ctx.drawImage(stone(W, H, 71, { course: 84, block: 180 }), 0, 0);
  light.begin(0.04 + 0.05 * f.kick);
  light.add(cxs, cys, 1100, 0.5);
  light.apply(ctx);

  // reed notes wake the letters of DIES IRAE
  const wake = new Map();
  for (const e of cues.between('lead', Tc - 1.0, Tc + 0.0005)) {
    const idx = cues.ev.lead.indexOf(e), k = idx % 8;   // 8 notes per phrase
    const code = DIES.charCodeAt(k), a = Math.exp(-(Tc - e[0]) / 0.5);
    wake.set(code, Math.max(wake.get(code) || 0, a));
  }

  // ---- the niches (far columns first so nearer ones overlap them)
  const cols = [...Array(16).keys()].sort((a, b) => Math.abs(b - 7.5) - Math.abs(a - 7.5));
  let lit = 0;
  for (const c of cols) for (let r = 0; r < 8; r++) {
    const code = r * 16 + c, n = code + 1, t = st[n], age = t ? Tc - t : -1;
    const [sx, sy, k] = proj((c - 7.5) * 1.02, (r - 3.5) * 1.06 - 0.4);
    const w = 0.86 * k, h = 0.96 * k * 1.0, done = t && age >= 0, fl = done ? Math.exp(-age / 0.35) : 0, wk = wake.get(code) || 0;
    const v = Math.max(done ? 0.3 + 0.7 * fl : 0.05, wk);
    if (done) lit++;
    const p = archPath(sx, sy + h / 2, w, h, w * 0.85);
    ctx.fillStyle = L(0.02 + 0.5 * fl * 0.5); ctx.fill(p);
    ctx.strokeStyle = L(0.22 + 0.62 * v); ctx.lineWidth = Math.max(1, 2.3 * k / 100 * 100 * 0.01 * 100 / 100 + 1.2); ctx.stroke(p);
    if (fl > 0.05 || wk > 0.05) { glow.globalAlpha = Math.max(fl, wk) * 0.8; glow.strokeStyle = L(0.9); glow.lineWidth = 4; glow.stroke(p); glow.globalAlpha = 1; }
    if (code >= 32 && (done || wk > 0.05)) {
      G.draw(ctx, glow, { x: sx, y: sy + h * 0.06, s: (h * 0.72) / 100, lv: G.lv(G.mask(code), new Float32Array(17)), color: L(0.55 + 0.4 * Math.max(fl, wk)), off: L(0.04), edge: L(0.08), hot: 0.6 * Math.max(fl, wk), glowK: 0.5 * Math.max(fl, wk) + 0.1, dp: false });
    } else if (code >= 32) {
      G.draw(ctx, null, { x: sx, y: sy + h * 0.06, s: (h * 0.72) / 100, lv: G.zero, off: L(0.05), edge: null, dp: false });
    } else if (h > 20) {
      G.text(ctx, null, CTRL[code], { x: sx, y: sy + h * 0.1, h: Math.max(8, h * 0.17), align: 'center', color: L(0.15 + 0.7 * v), gap: 0.2, hot: 0 });
    }
  }

  const barsLeft = Math.floor(lb);
  plaque(C, 'CXXVIII SIGNA', 960, 86, { h: 30, v: 0.5 * (1 - sstep(1.5, 2.2, lb)) * sstep(0.1, 0.6, lb), rule: false });
  G.text(ctx, null, `${roman(lit)}  LUMINA`, { x: 96, y: 1010, h: 18, color: L(0.42), gap: 0.35, hot: 0 });
  ledBoard(C, { x: 1800, y: 930, s: 1.3, course: 3, mode: 'fill', r: 0.9 });
  C.fx.bloom = 1.05 + 0.1 * f.kickS;
  void TAU; void clamp; void smooth; void TONE; void La; void barsLeft;
}
