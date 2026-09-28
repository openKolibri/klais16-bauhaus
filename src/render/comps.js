// Analytic Bauhaus colour fields: comp(C) -> (x,y) => hex colour.
// Scenes sample these per segment, so letters become windows onto a flat, geometric composition.
import { P, TAU, clamp, smooth, ease, hash, frac } from './util.js';

const RING = [P.RED, P.YEL, P.BLU, P.WHT];

/** concentric rings that flow outward from a centre that hops on the beat */
function sun(C, { ringW = 300, speed = 0.5 } = {}) {
  const { W, H, beat } = C, k = Math.floor(beat / 4), u = smooth(frac(beat / 4) * 2 - 0.3);
  const pos = (i) => [W * (0.5 + 0.30 * Math.sin(i * 2.399 + 0.6)), H * (0.5 + 0.24 * Math.cos(i * 1.713 + 0.2))];
  const a = pos(k - 1), b = pos(k), cx = a[0] + (b[0] - a[0]) * u, cy = a[1] + (b[1] - a[1]) * u;
  const shift = -beat * ringW * speed + C.f.kick * 26;
  return (x, y) => RING[(((Math.floor((Math.hypot(x - cx, y - cy) + shift) / ringW)) % 4) + 4) % 4];
}

/** diagonal bands whose angle snaps by 45deg every 4 beats */
function stripes(C, { w = 300 } = {}) {
  const { beat, W, H } = C, k = Math.floor(beat / 4), a0 = (k - 1) * (Math.PI / 4), a1 = k * (Math.PI / 4);
  const ang = a0 + (a1 - a0) * ease.io3(clamp(frac(beat / 4) * 3)), ca = Math.cos(ang), sa = Math.sin(ang);
  const shift = beat * w * 0.5;
  return (x, y) => RING[((Math.floor(((x - W / 2) * ca + (y - H / 2) * sa + shift) / w) % 4) + 4) % 4];
}

/** Kandinsky-ish poster: big disc, triangle, and colour fields that jump every 2 beats */
function quads(C) {
  const { W, H, beat } = C, k = Math.floor(beat / 2), r = (i, s) => hash(k * 7 + i * 31 + s);
  const cx = W * (0.25 + 0.5 * r(1, 0)), cy = H * (0.3 + 0.4 * r(2, 1)), R = 250 + 200 * r(3, 2);
  const tx = W * (0.15 + 0.7 * r(4, 3)), ty = H * (0.2 + 0.6 * r(5, 4)), TR = 260 + 160 * r(6, 5), ta = r(7, 6) * TAU;
  const split = W * (0.3 + 0.4 * r(8, 7));
  const base = [P.BLU, P.YEL, P.RED, P.WHT][k % 4], base2 = [P.WHT, P.BLU, P.YEL, P.RED][k % 4];
  const inTri = (x, y) => {
    const px = x - tx, py = y - ty;
    for (let i = 0; i < 3; i++) {
      const a = ta + (i * TAU) / 3, b = ta + ((i + 1) * TAU) / 3;
      const ex = Math.cos(b) - Math.cos(a), ey = Math.sin(b) - Math.sin(a);
      if ((px / TR - Math.cos(a)) * ey - (py / TR - Math.sin(a)) * ex > 0) return false;
    }
    return true;
  };
  return (x, y) => (Math.hypot(x - cx, y - cy) < R ? P.RED : inTri(x, y) ? P.YEL : x < split ? base : base2);
}

/** flat colour (LED colourway) */
const solid = (col) => () => () => col;

export const comps = { sun, stripes, quads, red: solid(P.RED), yel: solid(P.YEL), blu: solid(P.BLU), wht: solid(P.WHT), grn: solid(P.GRN) };
