// 8 x 3 wall of modules (each cell is exactly one 2:3 Klais-16 panel, edge to edge like the real array).
// The letters take their colour from a flat Bauhaus composition sampled at each segment.
import { P, clamp, rgba, mix, hash2, hash, E, shade, smooth, ease } from '../util.js';
import { stepHits } from '../hud.js';
import { comps } from '../comps.js';

export const WORDS = ['SIXTEEN ', 'SEGMENT ', 'DISPLAY '];
// LED colour that reads well on each (dimmed) block colour
const CONTRAST = { [P.RED]: [P.YEL, P.WHT], [P.YEL]: [P.RED, P.BLU], [P.BLU]: [P.YEL, P.WHT], [P.WHT]: [P.RED, P.BLU] };

/** apply the same camera transform to the main and the emissive context */
export function camera(C, fn, { z = 1, rot = 0, dx = 0, dy = 0, cx = C.W / 2, cy = C.H / 2 } = {}) {
  for (const c of [C.ctx, C.glow]) { c.save(); c.translate(cx + dx, cy + dy); if (rot) c.rotate(rot); c.scale(z, z); c.translate(-cx, -cy); }
  fn();
  C.ctx.restore(); C.glow.restore();
}

export function wall({ mode = 'words', comp = 'sun', lines = WORDS, glitch = 0.05, seq = true, zoomK = 0.02, invert = 'none', block = 0.34 } = {}) {
  return function draw(C) {
    const { ctx, glow, G, W, H, f, cues, Tc } = C;
    const cols = 8, rows = 3, cw = W / cols, ch = H / rows, s = cw / G.W;
    const field = comps[comp](C);
    const stepI = Math.floor(C.step), barI = Math.floor(C.bar);
    const beatI = Math.floor(C.beat);
    const kicks = stepHits(C, 'kick', barI), hats = stepHits(C, 'hatC', barI), acids = stepHits(C, 'acid', barI);
    const lv = new Float32Array(17), colors = new Array(17);
    // the row of the word being spoken flashes
    const vLast = cues.last('voice', Tc), vAge = vLast ? Tc - vLast[0] : 9, vRow = vLast ? vLast[3] : -1, vEnv = vAge < 0.5 ? Math.exp(-vAge / 0.2) : 0;
    camera(C, () => {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * cw, y = r * ch, cx = x + cw / 2, cy = y + ch / 2;
          // cascade in on the drop: cells pop in along the diagonal
          const reveal = C.lt < 0.6 ? ease.outBack(clamp((C.lt - (c + r) * 0.028) / 0.16)) : 1;
          if (reveal <= 0.01) continue;
          if (reveal < 0.999) { ctx.save(); ctx.translate(cx, cy); ctx.scale(reveal, reveal); ctx.translate(-cx, -cy); }
          // cell tint: the composition, drowned in black acrylic
          const base = field(cx, cy);
          const vb = r === vRow ? vEnv : 0;
          ctx.fillStyle = mix(P.INK, base, block + 0.06 * f.kick + 0.25 * vb);
          ctx.fillRect(x, y, cw + 1, ch + 1);
          // which glyph?
          let mask = 0, ledColor = null, special = false;
          if (seq && c === cols - 1) {
            // the sequencer column: segment i lights when step i has a hit, playhead in white
            special = true;
            const hits = [kicks, hats, acids][r], inst = [P.RED, P.YEL, P.BLU][r];
            const cur = ((stepI % 16) + 16) % 16;
            for (let i = 0; i < 16; i++) lv[i] = hits[i] ? 0.95 : 0;
            lv[16] = cur === 0 ? 1 : 0;
            for (let i = 0; i < 17; i++) colors[i] = i === cur ? P.WHT : inst;
            if (hits[cur]) lv[cur] = 1; else lv[cur] = 0.5;
          } else {
            let ch_;
            if (mode === 'words') ch_ = lines[r][c];
            else if (mode === 'marquee') { const L = lines[r % lines.length]; ch_ = L[(c + beatI * 1 + r * 3 + 4096 * L.length) % L.length]; }
            else if (mode === 'wave') ch_ = String.fromCharCode(33 + Math.floor((c * 5 + r * 11 + stepI * 3 + hash2(c, r) * 40) % 90));
            else ch_ = ' ';
            if (hash2(stepI, r * 8 + c) < glitch * (0.4 + f.rms)) ch_ = String.fromCharCode(33 + Math.floor(hash2(stepI + 5, r * 8 + c) * 90));
            G.lv(G.mask(ch_), lv);
            const pal = CONTRAST[base] || [P.WHT, P.YEL];
            const lc = pal[hash2(r * 8 + c, Math.floor(C.beat / 2)) < 0.5 ? 0 : 1];
            const inv = invert === 'checker' ? (c + r + Math.floor(C.beat / 2)) % 5 === 0 : invert === 'kick' ? hash2(c * 3 + r, f.kickN) < 0.16 : false;
            for (let i = 0; i < 17; i++) {
              colors[i] = inv ? base : lc;
              lv[i] = (inv ? 1 - lv[i] : lv[i]) * (0.82 + 0.18 * f.bands[(c * 3 + 2) % 24] + 0.25 * f.kick + 0.5 * vb);
            }
            if (inv) lv[16] = 0;
          }
          G.draw(ctx, glow, { x: cx, y: cy, s, lv, colors, off: rgba('#000', 0.5), edge: null, hot: 0.28, glowK: 0.9 });
          if (special) { ctx.fillStyle = rgba(P.WHT, 0.05); ctx.fillRect(x, y, 2, ch); }
          if (reveal < 0.999) ctx.restore();
        }
      }
      // seams like the physical array
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      for (let c = 1; c < cols; c++) ctx.fillRect(c * cw - 1, 0, 2, H);
      for (let r = 1; r < rows; r++) ctx.fillRect(0, r * ch - 1, W, 2);
    }, { z: 1 + zoomK * f.kick });
  };
}
