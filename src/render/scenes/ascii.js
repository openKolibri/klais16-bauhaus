// ASCII (bars 8-12): one huge glyph and the UART frame that carries it - the same bitstream the blips play.
// Each character of "KLAIS-16 SIXTEEN SEGMENT DISPLAY" is 10 bits (start, D0..D7 LSB first, stop), one bit per 16th note.
import { P, LED, TAU, clamp, E, rgba, mix, hash, hex2, sstep, lerp, ease } from '../util.js';
import { grid, corners, label } from '../ui.js';
import { disc, ring, rect, quarter, half, tri, ruler, dots, rtri } from '../bauhaus.js';
import { camera } from './wall.js';

const BAUDS = [115200, 110, 300, 600, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 128000, 230400, 256000, 460800, 1000000];

export function ascii(C) {
  const { ctx, glow, G, W, H, f, cues, Tc, STEP, BAR } = C;
  const lb = C.lbar, gi = Math.floor(C.step + 1e-6), sub = C.step - gi;
  const u = cues.uartBit(gi), msg = cues.uart.message, L = msg.length;
  const shownIdx = u.pos === 9 ? u.char : (u.char - 1 + L) % L;
  const shownCh = msg[shownIdx], col = LED[shownIdx % 5];
  const latchAge = u.pos === 9 ? sub * STEP : u.pos === 0 ? (1 + sub) * STEP : 9;
  const pop = Math.exp(-latchAge / 0.16);
  const k = E('outBack', lb / 0.25);

  // ---- Bauhaus backdrop
  const bx = 560, by = 548, s = 8.4;
  disc(ctx, bx, by + 10, 392 * k, P.YEL);
  ring(ctx, bx, by + 10, 446 * k, 5, rgba(P.WHT, 0.55));
  quarter(ctx, 0, 0, 250 * k, 0, P.RED);
  rect(ctx, W - 40 * k, 0, 40 * k, H, P.BLU);
  rtri(ctx, W - 40 * k, H, -420 * k, -170 * k, rgba(P.RED, 1));
  grid(C, { alpha: 0.03 });

  // ---- the glyph on its board
  const lv = new Float32Array(17);
  G.lv(G.mask(shownCh), lv);
  const dpOn = u.pos === 9 || (u.pos < 2 && f.kick > 0.4);
  camera(C, () => {
    G.board(ctx, { x: bx, y: by, s, fill: '#08080c', edge: '#262835' });
    for (let i = 0; i < 17; i++) lv[i] *= 0.9 + 0.4 * pop + 0.2 * f.kick;
    G.draw(ctx, glow, { x: bx, y: by, s, lv, color: col, off: '#101118', edge: '#1f212b', hot: 0.4, glowK: 1 + pop });
    G.underlineDots(ctx, glow, { x: bx, y: by, s, color: P.WHT, r: 1.15, lit: (i) => (i === (gi % 8) ? 1 : 0.18) });
  }, { z: 1 + 0.02 * f.kick, cx: bx, cy: by });

  // ---- right column
  const x0 = 1010;
  label(C, '115200', x0, 130, 84, P.WHT, { glowK: 0.5 });
  label(C, 'BAUD 8N1 NRZ', x0, 206, 24, rgba(P.WHT, 0.8));
  // baud table as bars (config pads 4:1, default = 0000)
  BAUDS.forEach((b, i) => {
    const h = 12 + 62 * (Math.log10(b) - 2) / 4, x = 1440 + i * 26;
    ctx.fillStyle = i === 0 ? P.YEL : 'rgba(255,255,255,0.14)'; ctx.fillRect(x, 200 - h, 18, h);
    if (i === 0) { glow.fillStyle = P.YEL; glow.fillRect(x, 200 - h, 18, h); }
  });
  label(C, 'BAUD SELECT PADS', 1440, 232, 15, rgba(P.WHT, 0.5));

  // UART frame
  const wx = x0 + 6, ww = 830, slot = ww / 10, yH = 452, yL = 568, code = u.code;
  const levels = [0]; for (let i = 0; i < 8; i++) levels.push((code >> i) & 1); levels.push(1);
  const names = ['START', 'D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'STOP'];
  for (let i = 0; i < 10; i++) {
    const x = wx + i * slot, cur = i === u.pos;
    ctx.fillStyle = cur ? 'rgba(255,198,26,0.16)' : (i % 2 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.055)'); ctx.fillRect(x, 410, slot, 200);
    label(C, names[i], x + slot / 2, 390, 15, cur ? P.YEL : rgba(P.WHT, 0.5), { align: 'center', gap: 0.25, glowK: cur ? 0.6 : 0 });
  }
  const path = () => { ctx.beginPath(); ctx.moveTo(wx - 50, yH); ctx.lineTo(wx, yH); let prev = 1; for (let i = 0; i < 10; i++) { const lvl = levels[i], y = lvl ? yH : yL, x = wx + i * slot; if (lvl !== prev) ctx.lineTo(x, prev ? yH : yL); ctx.lineTo(x, y); ctx.lineTo(x + slot, y); prev = lvl; } ctx.lineTo(wx + ww + 50, yH); };
  ctx.save(); ctx.lineWidth = 8; ctx.lineJoin = 'miter'; ctx.strokeStyle = 'rgba(244,236,220,0.22)'; path(); ctx.stroke();
  // progressed part
  const prog = (u.pos + sub) / 10;
  ctx.beginPath(); ctx.rect(wx - 60, 380, 60 + ww * prog, 260); ctx.clip();
  ctx.strokeStyle = P.YEL; path(); ctx.stroke(); ctx.restore();
  glow.save(); glow.beginPath(); glow.rect(wx - 60, 380, 60 + ww * prog, 260); glow.clip(); glow.lineWidth = 8; glow.strokeStyle = P.YEL; glow.beginPath(); glow.moveTo(wx - 50, yH); glow.lineTo(wx, yH);
  { let prev = 1; for (let i = 0; i < 10; i++) { const lvl = levels[i], y = lvl ? yH : yL, x = wx + i * slot; if (lvl !== prev) glow.lineTo(x, prev ? yH : yL); glow.lineTo(x, y); glow.lineTo(x + slot, y); prev = lvl; } glow.lineTo(wx + ww + 50, yH); }
  glow.stroke(); glow.restore();
  // playhead
  const px = wx + ww * prog; rect(ctx, px - 2, 400, 4, 220, P.WHT); glow.fillStyle = P.WHT; glow.fillRect(px - 3, 400, 6, 220);
  // 1-bit slots pulse (this is what you hear as a blip)
  label(C, 'HIGH', wx - 60, yH, 15, rgba(P.WHT, 0.4), { align: 'right' }); label(C, 'LOW', wx - 60, yL, 15, rgba(P.WHT, 0.4), { align: 'right' });

  // bit squares (MSB first reading) and byte
  const bin = code.toString(2).padStart(8, '0');
  for (let i = 0; i < 8; i++) {
    const bitIdx = 7 - i, on = (code >> bitIdx) & 1, x = x0 + 6 + i * 70, cur = u.pos === bitIdx + 1;
    ctx.fillStyle = on ? col : 'rgba(255,255,255,0.09)'; ctx.fillRect(x, 660, 56, 56);
    if (on) { glow.fillStyle = col; glow.globalAlpha = cur ? 1 : 0.4; glow.fillRect(x, 660, 56, 56); glow.globalAlpha = 1; }
    if (cur) { ctx.strokeStyle = P.WHT; ctx.lineWidth = 4; ctx.strokeRect(x - 5, 655, 68, 68); }
    label(C, bin[i], x + 28, 688, 32, on ? P.INK : rgba(P.WHT, 0.5), { align: 'center', glowK: 0, gap: 0 });
  }
  label(C, 'LSB FIRST ON THE WIRE', x0 + 6, 750, 15, rgba(P.WHT, 0.5));
  label(C, hex2(code), x0 + 580, 690, 64, P.WHT, { glowK: 0.5 });
  label(C, `'${msg[u.char]}'`, x0 + 580, 776, 34, col, { glowK: 0.8 });
  label(C, '1 BIT = 8.68 US  >  1 STEP = 113.6 MS', x0 + 6, 800, 18, rgba(P.WHT, 0.55));

  // ticker: the bracket follows the last completed character (the one on the glyph)
  const adv = 30 * 1.32 * 0.6667 * 1.0 + 12, ty = 925, curI = u.pos === 9 ? 0 : -1;
  for (let i = -2; i < 24; i++) {
    const idx = (((u.char + i) % L) + L) % L, cur = i === curI, x = x0 + 6 + (i + 1) * adv - adv * (u.pos / 10);
    const a = (x < x0 - 10 ? 0 : 1) * (cur ? 1 : 0.55) * clamp(1 - Math.max(0, i - 14) / 8);
    G.text(ctx, cur ? glow : null, msg[idx], { x, y: ty, h: 46, color: cur ? col : P.WHT, alpha: a, gap: 0, glowK: 0.8, hot: 0 });
  }
  { const bxk = x0 + 6 + (curI + 1) * adv - adv * (u.pos / 10); ctx.strokeStyle = P.WHT; ctx.lineWidth = 3; ctx.strokeRect(bxk - 21, ty - 33, adv + 4, 66); }
  C.fx.bloom = 1;
}
