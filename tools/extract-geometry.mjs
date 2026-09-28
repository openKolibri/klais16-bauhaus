// Pulls the real Klais-16 board geometry out of the KiCad sources so the video draws the actual hardware:
//   * the 16 segment cut-outs + decimal point (L1 die-cut layer, Edge.Cuts)
//   * the board outline (66.66 x 100 mm, with connector notches)
//   * all 128 LED positions (L0) and which segment each one belongs to (firmware segmentMapping.h)
//   * the main parts on the electronics layer (MCU, LED driver, connectors, config jumpers, mounting holes)
//
// usage: node tools/extract-geometry.mjs /path/to/klais-16 > src/geometry/klais16.json
import { readFileSync } from 'node:fs';
import * as K from './kicad.mjs';

const root = process.argv[2] || '/home/user/openkolibri/klais-16';
const pcbDir = `${root}/pcb`;
const round = (v) => Math.round(v * 1000) / 1000;
const pt = (p) => [round(p[0]), round(p[1])];

// ---- L1: outline + segment cut-outs ------------------------------------------------------------
const l1 = K.load(`${pcbDir}/SEG-16-XXX-XXXX-L1/SEG-16-XXX-XXXX-L1.kicad_pcb`);
const loops = K.chainLoops(K.drawings(l1, 'Edge.Cuts')).filter((l) => !l.open);
const withInfo = loops.map((pts) => {
  const b = K.bbox(pts);
  return { pts, area: Math.abs(K.area(pts)), cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2, bb: b };
});
const outline = withInfo.reduce((a, b) => (b.area > a.area ? b : a));

// Where each segment sits on the front face (mm from board centre, y down). Taken from docs/firmware/segmentMap.png.
const EXPECT = {
  A: [-3.8, -36], B: [16.9, -36], H: [-17.2, -19.6], C: [24, -18.1],
  K: [-6.9, -18], M: [4, -18], N: [12.6, -18],
  U: [-10.7, 0], P: [10.9, 0],
  G: [-23.9, 18], D: [17.3, 19.5], T: [-12.5, 18], S: [-4, 18], R: [7, 18],
  F: [-16.8, 36], E: [3.9, 36], DP: [26.1, 36],
};
const candidates = withInfo.filter((l) => l !== outline && l.pts.length <= 8 && l.area > 40);
const segments = {};
for (const [name, [ex, ey]] of Object.entries(EXPECT)) {
  let best = null, bestD = Infinity;
  for (const c of candidates) {
    const d = Math.hypot(c.cx - ex, c.cy - ey);
    if (d < bestD) { bestD = d; best = c; }
  }
  if (!best || bestD > 4) throw new Error(`no cut-out found for segment ${name} (nearest ${bestD.toFixed(2)} mm)`);
  segments[name] = best.pts.map(pt);
  candidates.splice(candidates.indexOf(best), 1);
}
if (candidates.length) console.error('warning: unassigned cut-outs', candidates.length);

// ---- firmware: which LED belongs to which segment -----------------------------------------------
const mappingSrc = readFileSync(`${root}/firmware/include/segmentMapping.h`, 'utf8');
const ledSeg = new Map();
for (const m of mappingSrc.matchAll(/static unsigned char seg([A-Z]+)\[\]\s*=\s*\{([^}]*)\}/g)) {
  for (const n of m[2].split(',').map((s) => Number.parseInt(s, 10)).filter(Number.isFinite)) ledSeg.set(n, m[1]);
}

// ---- L0: LEDs and parts -----------------------------------------------------------------------
const l0 = K.load(`${pcbDir}/SEG-16-XXX-XXXX-L0/SEG-16-XXX-XXXX-L0.kicad_pcb`);
const mods = K.modules(l0);
const leds = mods
  .filter((m) => /^D\d+$/.test(m.ref))
  .map((m) => {
    const n = Number.parseInt(m.ref.slice(1), 10);
    return { n, x: round(m.x), y: round(m.y), seg: ledSeg.get(n) || '?', grid: Math.floor((n - 1) / 8) + 1, col: (n - 1) % 8 };
  })
  .sort((a, b) => a.n - b.n);
if (leds.length !== 128) throw new Error(`expected 128 LEDs, found ${leds.length}`);
const unmapped = leds.filter((l) => l.seg === '?');
if (unmapped.length) throw new Error(`LEDs without segment: ${unmapped.map((l) => l.n)}`);

// sanity: every LED must sit inside the cut-out of the segment the firmware says it belongs to (the underline LEDs sit outside)
const inside = (pt, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c; } return c; };
const outside = leds.filter((l) => l.seg !== 'UL' && !inside([l.x, l.y], segments[l.seg]));
if (outside.length) throw new Error(`LEDs outside their segment polygon: ${outside.map((l) => `D${l.n}(${l.seg})`).join(' ')}`);
console.error(`geometry ok: 17 segment outlines, ${leds.length} LEDs (${leds.length - leds.filter((l) => l.seg === 'UL').length} verified inside their own segment)`);

const PART_SIZE = { U1: [6.4, 6.5], U2: [7.65, 17.7], J1: [4, 8], J2: [4, 8], J3: [8, 7], C1: [2.8, 3.5], C2: [1.6, 3.2] };
const parts = mods
  .filter((m) => /^(U|J|C[12]|H|JP)\d*$/.test(m.ref) || /^(U|J)\d/.test(m.ref) || m.ref === 'C1' || m.ref === 'C2')
  .map((m) => {
    const size = PART_SIZE[m.ref] || (m.ref.startsWith('H') ? [3.1, 3.1] : m.ref.startsWith('JP') ? [1.5, 3.3] : [2, 2]);
    const quarter = Math.round(m.rot / 90) % 2 !== 0;
    return { ref: m.ref, x: round(m.x), y: round(m.y), w: quarter ? size[1] : size[0], h: quarter ? size[0] : size[1] };
  });

const out = {
  _about: 'Geometry extracted from openKolibri/klais-16 KiCad sources. Units: mm, origin at board centre, y down, front-face view.',
  board: { w: round(outline.bb.x1 - outline.bb.x0), h: round(outline.bb.y1 - outline.bb.y0), outline: outline.pts.map(pt) },
  segments,
  order: 'ABCDEFGHKMNPRSTU', // firmware bit order: A = bit 0 ... U = bit 15, DP = bit 16
  leds,
  parts,
};
process.stdout.write(JSON.stringify(out));
