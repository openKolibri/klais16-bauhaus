// STACK (bars 32-40, the breakdown): the four-board sandwich from the KiCad files, exploded in an oblique view.
// L0 electronics (LEDs, MCU, driver, connectors) -> L1/L2 spacers with the segment cut-outs -> L3 diffuser face.
// The arpeggio chases around the segments (step i <-> segment i); UART blips race between the two edge connectors.
import { P, LED, TAU, clamp, E, rgba, mix, hash, hash2, sstep, ease, lerp, frac } from '../util.js';
import { SEG_NAMES } from '../glyph.js';
import { grid, corners, label } from '../ui.js';
import { disc, ring, rect } from '../bauhaus.js';

const PHI = (52 * Math.PI) / 180, SP = Math.sin(PHI), CP = Math.cos(PHI);

export function stack(C) {
  const { ctx, glow, G, W, H, f, cues, Tc, STEP, BAR } = C;
  const lb = C.lbar;                                  // 0..8
  const cx = 960, s = 6.0;
  // explode factor: 0 collapsed .. 1 fully exploded
  const ex = lb < 0.5 ? 0 : lb < 2.6 ? ease.io3((lb - 0.5) / 2.1) : lb < 5.6 ? 1 : lb < 7.7 ? 1 - ease.io3((lb - 5.6) / 2.1) * ease.io2(0.4 + (lb - 5.6) / 2.1 * 0.6) : 0;
  const slam = lb >= 7.7 ? 1 : 0;
  const theta = -0.62 + lb * 0.16 + (lb > 5.6 ? Math.pow((lb - 5.6) / 2.4, 2) * 1.1 : 0);
  const gap = 152 * ex, ct = Math.cos(theta), st = Math.sin(theta);
  const cy0 = 562 + 1.5 * gap;                       // the stack stays centred while it explodes
  const zpx = (layer) => layer * gap + (1 - ex) * layer * 3.2;     // screen-space rise of each layer
  const setM = (c, layer, dy = 0) => c.setTransform(s * ct, s * st * SP, -s * st, s * ct * SP, cx, cy0 - zpx(layer) + dy);

  // ---- backdrop
  const k = E('outBack', lb / 0.5);
  disc(ctx, cx, 560, 440 * k, mix(P.INK, P.WHT, 0.08));
  ring(ctx, cx, 560, 484 * k, 3, rgba(P.WHT, 0.3));
  rect(ctx, 0, 0, 42 * k, H, P.BLU);
  rect(ctx, W - 42 * k, 0, 42 * k, H, P.YEL);
  grid(C, { alpha: 0.035 });

  // ---- lit segments (arp chase + idle glow + riser fill)
  const lv = new Float32Array(17);
  const chase = (cues.count('pluck', Tc) - 1);
  const last = cues.last('pluck', Tc);
  for (let i = 0; i < 16; i++) {
    // recent arp notes light segment (noteIndex mod 16) and decay
    lv[i] = 0.10 + 0.05 * f.acid;
  }
  for (let d = 0; d < 6; d++) {
    const idx = chase - d; if (idx < 0) continue;
    const ev = cues.ev.pluck[idx], age = Tc - ev[0];
    lv[idx % 16] = Math.max(lv[idx % 16], Math.exp(-age / 0.32));
  }
  // pad swells and riser fill
  const fillN = lb > 4 ? clamp((lb - 4) / 3.8) : 0;
  for (let i = 0; i < 16; i++) if (i < fillN * 16) lv[i] = Math.max(lv[i], 0.35 + 0.65 * fillN);
  if (slam) for (let i = 0; i < 17; i++) lv[i] = 1;
  const segCols = (i) => LED[i % 5];

  const layerDefs = [
    { name: 'L0', desc: 'ELECTRONICS 1.0 MM', top: '#0c4436', side: '#062a20', kind: 'pcb' },
    { name: 'L1', desc: 'SPACER 1.6 MM', top: '#111116', side: '#050507', kind: 'cut' },
    { name: 'L2', desc: 'SPACER 1.6 MM', top: '#14141a', side: '#060608', kind: 'cut' },
    { name: 'L3', desc: 'DIFFUSER 1.6 MM', top: '#0a0a0e', side: '#040406', kind: 'face' },
  ];
  const thick = [5, 8, 8, 8];
  const outline = G.outline;
  const holes = new Path2D();
  holes.addPath(outline);
  for (const p of G.paths) holes.addPath(p);

  // draw layers bottom-up (viewer looks from above)
  layerDefs.forEach((L, li) => {
    const t = thick[li] * (0.35 + 0.65 * ex);
    // side wall
    ctx.save();
    for (let q = Math.ceil(t); q >= 1; q--) { setM(ctx, li, q * 0.9); ctx.fillStyle = L.side; ctx.fill(outline); }
    setM(ctx, li);
    if (L.kind === 'cut') { ctx.fillStyle = L.top; ctx.fill(holes, 'evenodd'); ctx.strokeStyle = 'rgba(160,165,190,0.35)'; ctx.lineWidth = 0.5; ctx.stroke(outline); for (const p of G.paths) ctx.stroke(p); }
    else { ctx.fillStyle = L.top; ctx.fill(outline); ctx.strokeStyle = 'rgba(160,165,190,0.35)'; ctx.lineWidth = 0.5; ctx.stroke(outline); }
    ctx.restore();

    if (L.kind === 'pcb') {
      ctx.save(); setM(ctx, li);
      // silk + parts
      for (const p of G.parts) {
        const chip = p.ref === 'U1' || p.ref === 'U2', con = /^J/.test(p.ref);
        if (/^H/.test(p.ref)) { ctx.fillStyle = '#c9b46a'; ctx.beginPath(); ctx.arc(p.x, p.y, 2.7, 0, TAU); ctx.fill(); ctx.fillStyle = '#031a14'; ctx.beginPath(); ctx.arc(p.x, p.y, 1.55, 0, TAU); ctx.fill(); continue; }
        ctx.fillStyle = chip ? '#15151b' : con ? '#8e93a3' : /^JP/.test(p.ref) ? '#c9b46a' : '#b7a35a';
        ctx.fillRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
        if (chip) { ctx.strokeStyle = '#e6e0c8'; ctx.lineWidth = 0.35; ctx.strokeRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h); }
      }
      // LEDs
      for (const l of G.leds) {
        const segI = SEG_NAMES.indexOf(l.seg), on = segI >= 0 ? lv[segI] : (l.seg === 'UL' ? 0.5 : 0);
        ctx.fillStyle = mix('#23262e', segCols(segI < 0 ? 0 : segI), clamp(on));
        ctx.fillRect(l.x - 0.8, l.y - 0.45, 1.6, 0.9);
        if (on > 0.05) { glow.save(); setM(glow, li); glow.globalAlpha = clamp(on) * 0.9; glow.fillStyle = segCols(segI < 0 ? 0 : segI); glow.beginPath(); glow.arc(l.x, l.y, 1.5, 0, TAU); glow.fill(); glow.restore(); }
      }
      // UART sparks between the edge connectors (one per blip)
      for (const e of cues.between('blip', Tc - 0.7, Tc + 0.001)) {
        const age = Tc - e[0], u = age / 0.7, x = -33 + 66 * ease.io2(u);
        ctx.fillStyle = P.WHT; ctx.globalAlpha = 1 - u; ctx.beginPath(); ctx.arc(x, 0, 1.6 + (1 - u) * 1.2, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
        glow.save(); setM(glow, li); glow.fillStyle = e[3] % 2 ? P.YEL : P.RED; glow.globalAlpha = 1 - u; glow.beginPath(); glow.arc(x, 0, 3, 0, TAU); glow.fill(); glow.restore();
      }
      ctx.restore();
    }
    if (L.kind === 'face') {
      // lit segments seen through the diffuser
      for (let i = 0; i < 17; i++) {
        const v = lv[i]; if (v < 0.02) continue;
        for (const c of [ctx, glow]) { c.save(); setM(c, li); c.globalAlpha = clamp(v) * (c === glow ? 0.85 : 0.95); c.fillStyle = segCols(i); c.fill(G.paths[i]); c.restore(); }
      }
    }
    // light shafts from L0 through the cut-outs (faint stacked copies)
    if (li === 0 && ex > 0.12) {
      for (let i = 0; i < 16; i++) {
        const v = lv[i]; if (v < 0.25) continue;
        for (let q = 1; q <= 5; q++) {
          const ls = q / 6, zlev = ls * 3;
          glow.save(); setM(glow, zlev); glow.globalAlpha = v * 0.09 * ex; glow.fillStyle = segCols(i); glow.fill(G.paths[i]); glow.restore();
        }
      }
    }
  });
  ctx.setTransform(1, 0, 0, 1, 0, 0); glow.setTransform(1, 0, 0, 1, 0, 0);

  // ---- callouts that follow the layers
  const alpha = sstep(1.6, 2.4, lb) * (1 - sstep(6.4, 7.2, lb));
  if (alpha > 0.02) {
    layerDefs.forEach((L, li) => {
      const y = cy0 - zpx(li) - 10, x = 1360;
      ctx.strokeStyle = rgba(P.WHT, 0.5 * alpha); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(1150, y); ctx.lineTo(x - 20, y); ctx.stroke();
      disc(ctx, 1150, y, 6, rgba(P.WHT, alpha));
      label(C, L.name, x, y - 12, 34, rgba([P.WHT, P.YEL, P.BLU, P.RED][li], alpha), { glowK: 0.5 });
      label(C, L.desc, x, y + 26, 18, rgba(P.WHT, 0.75 * alpha));
    });
  }
  // ---- left column facts (straight from the README)
  const a2 = sstep(0.8, 1.6, lb) * (1 - sstep(7.0, 7.6, lb));
  label(C, 'PCB STACK', 96, 140, 62, rgba(P.WHT, a2), { glowK: 0.4 });
  label(C, '5.8 MM', 96, 270, 92, rgba(P.YEL, a2), { glowK: 0.5 });
  label(C, 'THICK, 63.97 G', 96, 340, 24, rgba(P.WHT, 0.8 * a2));
  label(C, '100 X 66.66 MM', 96, 380, 24, rgba(P.WHT, 0.8 * a2));
  label(C, '3:2 ASPECT', 96, 420, 24, rgba(P.WHT, 0.8 * a2));
  label(C, `ARP STEP ${String(((Math.max(0, chase) % 16) + 1)).padStart(2, '0')} > SEG ${SEG_NAMES[Math.max(0, chase) % 16]}`, 96, 900, 22, rgba(P.WHT, 0.7 * a2));
  label(C, 'NOON  MDNT  BASE', 96, 940, 20, rgba(P.WHT, 0.45 * a2));
  C.fx.bloom = 1.05;
  C.fx.glitch = lb > 7.3 ? (lb - 7.3) * 0.9 : 0;
  C.fx.flash = slam ? 0.3 * Math.exp(-(Tc - (C.sc.b0 + 7.7) * BAR) / 0.1) : 0;   // the slam on the snare roll
}
