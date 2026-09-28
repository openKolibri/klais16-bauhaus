// Glyph engine: draws Klais-16 modules using the *real* segment polygons and LED positions from the KiCad files
// and the firmware's own ASCII font table.
import { P, clamp, shade } from './util.js';

export const SEG_ORDER = 'ABCDEFGHKMNPRSTU'.split(''); // bit 0 = A ... bit 15 = U (firmware order)
export const SEG_NAMES = [...SEG_ORDER, 'DP'];          // index 16 = decimal point

function polyPath(pts) {
  const p = new Path2D();
  pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
  p.closePath();
  return p;
}
function centroid(pts) {
  let x = 0, y = 0;
  for (const p of pts) { x += p[0]; y += p[1]; }
  return [x / pts.length, y / pts.length];
}
const shrink = (pts, f) => { const c = centroid(pts); return pts.map(([x, y]) => [c[0] + (x - c[0]) * f, c[1] + (y - c[1]) * f]); };

export class Glyphs {
  constructor(geom, font) {
    this.geom = geom;
    this.table = font.table; this.first = font.first;
    this.W = geom.board.w; this.H = geom.board.h; // 66.67 x 100 mm
    this.polys = SEG_NAMES.map((n) => geom.segments[n]);
    this.paths = this.polys.map(polyPath);
    this.cores = this.polys.map((p) => polyPath(shrink(p, 0.6)));
    this.cent = this.polys.map(centroid);
    this.outline = polyPath(geom.board.outline);
    this.leds = geom.leds;
    this.ledsBySeg = SEG_NAMES.map((n) => geom.leds.filter((l) => l.seg === n));
    this.underline = geom.leds.filter((l) => l.seg === 'UL').sort((a, b) => a.x - b.x);
    this.screws = geom.parts.filter((p) => /^H\d/.test(p.ref)).map((p) => [p.x, p.y]);
    this.parts = geom.parts;
    this.zero = new Float32Array(17);
  }

  /** bitmask of segments for a character (bit 16 = DP) */
  mask(ch) {
    const c = typeof ch === 'string' ? ch.charCodeAt(0) : ch, i = c - this.first;
    return i >= 0 && i < 96 ? this.table[i] : 0;
  }
  /** mask -> 17 intensity levels */
  lv(mask, out = new Float32Array(17)) { for (let i = 0; i < 17; i++) out[i] = (mask >> i) & 1; return out; }
  lvChar(ch, out) { return this.lv(this.mask(ch), out); }

  /** flat black MDNT panel with the true outline (connector notches included) and its six mounting screws */
  board(ctx, { x, y, s, fill = '#0a0a0f', edge = '#22242f', screws = true, rot = 0, alpha = 1 }) {
    ctx.save();
    ctx.translate(x, y); if (rot) ctx.rotate(rot); ctx.scale(s, s);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = fill; ctx.fill(this.outline);
    ctx.lineWidth = Math.max(0.35, 1.2 / s); ctx.strokeStyle = edge; ctx.stroke(this.outline);
    if (screws && s > 1.6) {
      for (const [sx, sy] of this.screws) {
        ctx.fillStyle = '#9aa0ad'; ctx.beginPath(); ctx.arc(sx, sy, 2.7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#d6dae3'; ctx.beginPath(); ctx.arc(sx - 0.5, sy - 0.6, 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3b3f4b'; ctx.beginPath(); ctx.arc(sx, sy, 1.15, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  /**
   * Draw one glyph. `lv` = 17 intensities (or a bitmask number). `x,y` = centre of the 66.67x100 mm cell, `s` = px per mm.
   */
  draw(ctx, glow, o) {
    const { x, y, s, color = P.RED, colors = null, off = '#14151c', edge = '#242631', alpha = 1, hot = 0.5, glowK = 1, rot = 0, offAlpha = 1, dp = true, edgeW = 0.3, only = null, dpScale = 1 } = o;
    const lv = typeof o.lv === 'number' ? this.lv(o.lv) : o.lv || this.zero;
    ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); ctx.scale(s, s);
    if (glow) { glow.save(); glow.translate(x, y); if (rot) glow.rotate(rot); glow.scale(s, s); }
    for (let i = 0; i < 17; i++) {
      if (i === 16 && !dp) continue;
      if (only && !only[i]) continue;
      const path = this.paths[i], v = lv[i], dps = i === 16 ? dpScale : 1;
      if (dps !== 1) { const [qx, qy] = this.cent[16]; for (const c of glow ? [ctx, glow] : [ctx]) { c.save(); c.translate(qx, qy); c.scale(dps, dps); c.translate(-qx, -qy); } }
      if (off && offAlpha > 0) { ctx.globalAlpha = offAlpha * alpha; ctx.fillStyle = off; ctx.fill(path); }
      if (edge && s > 0.9) { ctx.globalAlpha = alpha * offAlpha; ctx.lineWidth = edgeW; ctx.strokeStyle = edge; ctx.stroke(path); }
      if (v > 0.004) {
        const c = colors ? colors[i] : color, a = clamp(v) * alpha;
        ctx.globalAlpha = a; ctx.fillStyle = c; ctx.fill(path);
        if (hot > 0) { ctx.globalAlpha = a * hot; ctx.fillStyle = shade(c, 1.55); ctx.fill(this.cores[i]); }
        if (glow) { glow.globalAlpha = a * glowK; glow.fillStyle = c; glow.fill(path); }
      }
      if (dps !== 1) { ctx.restore(); if (glow) glow.restore(); }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    if (glow) glow.restore();
  }

  /** the 8 underline LEDs (+ any others) as round dots; lit(i) -> 0..1 for underline led i */
  underlineDots(ctx, glow, { x, y, s, lit, color = P.WHT, r = 1.0, off = '#1b1d26' }) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    if (glow) { glow.save(); glow.translate(x, y); glow.scale(s, s); }
    this.underline.forEach((l, i) => {
      ctx.globalAlpha = 1; ctx.fillStyle = off; ctx.beginPath(); ctx.arc(l.x, l.y, r, 0, Math.PI * 2); ctx.fill();
      const v = lit(i);
      if (v > 0.01) {
        ctx.globalAlpha = v; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(l.x, l.y, r, 0, Math.PI * 2); ctx.fill();
        if (glow) { glow.globalAlpha = v; glow.fillStyle = color; glow.beginPath(); glow.arc(l.x, l.y, r * 1.6, 0, Math.PI * 2); glow.fill(); }
      }
    });
    ctx.restore(); if (glow) glow.restore();
  }

  /** split a string into display cells; a '.' after a character lights that cell's decimal point (like a real display) */
  cells(str) {
    const out = [];
    for (let i = 0; i < str.length; i++) {
      const ch = str[i], prev = out[out.length - 1];
      if (ch === '.' && prev && prev.ch !== ' ' && prev.ch !== '.' && !prev.dp) { prev.dp = true; continue; }
      out.push({ ch, dp: false, i });
    }
    return out;
  }

  /** draw a string in glyph cells. (x,y) = anchor at vertical centre; `h` = glyph height in px. */
  text(ctx, glow, str, o) {
    const { x, y, h, align = 'left', gap = 0.18, color = P.RED, off = null, edge = null, alpha = 1, glowK = 1, hot = 0.4 } = o;
    const cells = this.cells(str), n = cells.length;
    const s = h / this.H, cw = this.W * s, adv = cw * (1 + gap);
    const total = adv * n - cw * gap;
    const x0 = align === 'left' ? x : align === 'center' ? x - total / 2 : x - total;
    const lv = new Float32Array(17);
    for (let k = 0; k < n; k++) {
      const { ch, dp, i } = cells[k];
      if (ch === ' ' && !off) continue;
      this.lv(this.mask(ch) | (dp ? 0x10000 : 0), lv);
      const c = typeof color === 'function' ? color(i, ch) : color;
      const a = typeof alpha === 'function' ? alpha(i, ch) : alpha;
      if (a <= 0.003) continue;
      this.draw(ctx, glow, { x: x0 + cw / 2 + adv * k, y, s, lv, color: c, off, edge, alpha: a, glowK, hot, dpScale: h < 70 ? Math.min(3, 70 / h) : 1 });
    }
    return { x0, width: total, cw, adv };
  }
  textWidth(str, h, gap = 0.18) { const s = h / this.H, cw = this.W * s; return cw * (1 + gap) * this.cells(str).length - cw * gap; }

  /** the individual LEDs at their true PCB positions */
  leds16(ctx, glow, { x, y, s, f, r = 0.75, off = '#1d1f29', color = P.RED, colorFn = null }) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    if (glow) { glow.save(); glow.translate(x, y); glow.scale(s, s); }
    for (const l of this.leds) {
      const v = f(l);
      ctx.globalAlpha = 1; ctx.fillStyle = off; ctx.beginPath(); ctx.arc(l.x, l.y, r, 0, Math.PI * 2); ctx.fill();
      if (v > 0.01) {
        const c = colorFn ? colorFn(l) : color;
        ctx.globalAlpha = clamp(v); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(l.x, l.y, r * 1.05, 0, Math.PI * 2); ctx.fill();
        if (glow) { glow.globalAlpha = clamp(v); glow.fillStyle = c; glow.beginPath(); glow.arc(l.x, l.y, r * 1.7, 0, Math.PI * 2); glow.fill(); }
      }
    }
    ctx.restore(); if (glow) glow.restore();
  }
}
