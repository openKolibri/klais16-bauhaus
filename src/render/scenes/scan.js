// SCAN (bars 6-8): the TM1640 multiplexes 128 LEDs as 16 grids x 8 segment lines. One grid per sixteenth note.
// Left: the module with every LED at its true PCB position. Right: the same 128 LEDs as a 16 x 8 mosaic.
import { P, LED, TAU, clamp, E, rgba, mix, hash, sstep, lerp } from '../util.js';
import { SEG_NAMES } from '../glyph.js';
import { grid, corners, label } from '../ui.js';
import { disc, ring, rect, quarter, half, tri, ruler, dots } from '../bauhaus.js';
import { camera } from './wall.js';

const SEG_COL = (name) => { const i = SEG_NAMES.indexOf(name); return i < 0 ? P.WHT : LED[i % 5]; };

export function scan(C) {
  const { ctx, glow, G, W, H, f, cues, Tc, STEP, BAR } = C;
  const lb = C.lbar;                              // 0..2 (bars 6..8)
  const stepF = C.step;                           // global 16th index (float)
  const speed = lb < 1 ? 1 : 2;                   // second bar scans twice as fast (the riser)
  const pos = lb < 1 ? lb * 16 : 16 + (lb - 1) * 32; // grid position (float), 0..48
  const cur = Math.floor(pos) % 16, sub = pos - Math.floor(pos);
  const bx = 815, by = 540, s = 7.6;

  // ---- backdrop: the dark board sits on a big red disc (classic Bauhaus), yellow bar left, blue half disc top right
  const k = E('outBack', lb / 0.3);
  disc(ctx, bx, by + 10, 415 * k, P.RED, 1);
  ring(ctx, bx, by + 10, 470 * k, 5, rgba(P.WHT, 0.55));
  rect(ctx, 0, 0, 56 * k, H, P.YEL);
  half(ctx, W, 90, 300 * k, Math.PI, P.BLU);
  rect(ctx, 1140, 84, 6, 900 * k, rgba(P.WHT, 0.35));
  ruler(ctx, 1150, 100, 860 * k, 48, rgba(P.WHT, 0.6), { vertical: true, major: 8, tick: 14, w: 2 });
  grid(C, { alpha: 0.03 });

  camera(C, () => {
    G.board(ctx, { x: bx, y: by, s, fill: '#08080c', edge: '#242633' });
    // segment outlines, very dim
    G.draw(ctx, null, { x: bx, y: by, s, lv: null, off: '#0d0e14', edge: '#1f212b', hot: 0 });
    // all 128 LEDs at their real positions
    const trail = (l) => {
      const g = l.grid - 1;                        // 0..15 grid of this LED
      let d = pos - g; d = ((d % 16) + 16) % 16;   // steps since this grid was scanned (float)
      const v = d < 5 ? Math.exp(-d / 1.6) : 0;
      return 0.16 + 0.84 * v;
    };
    G.leds16(ctx, glow, { x: bx, y: by, s, r: 0.95, off: '#171922', f: trail, colorFn: (l) => SEG_COL(l.seg) });
    // scan highlight ring on the current grid's LEDs
    ctx.save(); ctx.translate(bx, by); ctx.scale(s, s);
    ctx.strokeStyle = P.WHT; ctx.lineWidth = 0.35; ctx.globalAlpha = 0.9 * (1 - sub);
    for (const l of G.leds) if (l.grid - 1 === cur) { ctx.beginPath(); ctx.arc(l.x, l.y, 1.9 + sub * 1.2, 0, TAU); ctx.stroke(); }
    ctx.restore();
  }, { z: 1 + 0.012 * f.kick });

  // ---- right: 16 x 8 mosaic (grid rows x segment-line columns)
  const mx = 1262, my = 128, cs = 42, cg = 6;
  label(C, 'G', mx - 40, my - 34, 18, rgba(P.WHT, 0.5));
  for (let c = 0; c < 8; c++) label(C, 'S' + c, mx + c * (cs + cg) + cs / 2, my - 34, 18, rgba(P.WHT, 0.5), { align: 'center' });
  for (let g = 0; g < 16; g++) {
    label(C, String(g + 1).padStart(2, '0'), mx - 10, my + g * (cs + cg) + cs / 2, 16, rgba(P.WHT, g === cur ? 1 : 0.4), { align: 'right', glowK: g === cur ? 0.6 : 0.2 });
    for (let c = 0; c < 8; c++) {
      const led = G.leds.find((l) => l.n === g * 8 + c + 1), col = SEG_COL(led.seg);
      const d = (((pos - g) % 16) + 16) % 16, v = d < 5 ? Math.exp(-d / 1.6) : 0;
      const x = mx + c * (cs + cg), y = my + g * (cs + cg);
      ctx.fillStyle = mix('#14151c', col, 0.16 + 0.84 * v); ctx.fillRect(x, y, cs, cs);
      if (v > 0.1) { glow.globalAlpha = v; glow.fillStyle = col; glow.fillRect(x, y, cs, cs); glow.globalAlpha = 1; }
    }
  }
  // current row bracket
  ctx.strokeStyle = P.WHT; ctx.lineWidth = 3;
  ctx.strokeRect(mx - 5, my + cur * (cs + cg) - 5, 8 * (cs + cg) - cg + 10, cs + 10);

  // ---- left column text
  label(C, 'TM1640', 96, 150, 66, P.WHT, { glowK: 0.5 });
  label(C, '16 GRIDS X 8 LINES', 96, 226, 22, rgba(P.WHT, 0.85));
  label(C, '128 LEDS 0603 20 MA', 96, 262, 22, rgba(P.WHT, 0.85));
  label(C, `GRID ${String(cur + 1).padStart(2, '0')}`, 96, 340, 44, P.YEL, { glowK: 0.6 });
  label(C, `LED ${String(cur * 8 + 1).padStart(3, '0')}-${String((cur + 1) * 8).padStart(3, '0')}`, 96, 392, 22, P.YEL, { glowK: 0.4 });
  label(C, 'GRID = (REF-1) / 8 + 1', 96, 470, 18, rgba(P.WHT, 0.55));
  label(C, 'SEG = (REF-1) % 8', 96, 498, 18, rgba(P.WHT, 0.55));
  label(C, speed === 2 ? 'SCAN X2' : 'SCAN X1', 96, 570, 26, speed === 2 ? P.RED : rgba(P.WHT, 0.6), { glowK: speed === 2 ? 0.8 : 0.2 });
  label(C, 'MUX 16 X 8', 96, 900, 18, rgba(P.WHT, 0.4));
  C.fx.bloom = 1;
  // riser: the last beat gets a touch of glitch
  C.fx.glitch = lb > 1.85 ? (lb - 1.85) * 1.6 : 0;
}
