// Small helpers shared by every scene: math, easing, deterministic hashing, colour.
export const TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const frac = (x) => x - Math.floor(x);
export const map = (x, a, b, c = 0, d = 1) => c + ((x - a) / (b - a)) * (d - c);
export const cmap = (x, a, b, c = 0, d = 1) => c + (clamp((x - a) / (b - a)) * (d - c));
export const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const sstep = (a, b, x) => smooth((x - a) / (b - a));

export const ease = {
  in2: (t) => t * t,
  out2: (t) => 1 - (1 - t) * (1 - t),
  in3: (t) => t * t * t,
  out3: (t) => 1 - Math.pow(1 - t, 3),
  out4: (t) => 1 - Math.pow(1 - t, 4),
  io2: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  io3: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  io5: (t) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2),
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outElastic: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -9 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
};
/** clamp to 0..1 then ease */
export const E = (name, t) => ease[name](clamp(t));

/** deterministic hash -> [0,1) so every frame is a pure function of time */
export function hash(n) {
  n = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
  n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35); n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}
export const hash2 = (a, b) => hash(Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263));
export const pick = (arr, seed) => arr[Math.floor(hash(seed) * arr.length) % arr.length];

// ---------------------------------------------------------------------------------------------
// palette: the product's LED colourways (RED, YEL, BLU, GRN, WHT) on a black MDNT face, Bauhaus-style
// ---------------------------------------------------------------------------------------------
export const P = {
  INK: '#07070b', INK2: '#0e0f15', INK3: '#171923', GREY: '#2a2d3a', DIM: '#5a5f72',
  RED: '#ff3b2f', YEL: '#ffc61a', BLU: '#2f5bff', GRN: '#17c48a', WHT: '#f4ecdc',
  ORG: '#ff7a1a', PNK: '#ff6fa8', CYN: '#38d6ff',
};
export const LED = [P.RED, P.YEL, P.BLU, P.GRN, P.WHT];
export const TRI = [P.RED, P.YEL, P.BLU];

const cache = new Map();
export function rgb(hex) {
  let v = cache.get(hex);
  if (!v) { const n = parseInt(hex.slice(1), 16); v = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; cache.set(hex, v); }
  return v;
}
export const rgba = (hex, a = 1) => { const [r, g, b] = rgb(hex); return `rgba(${r},${g},${b},${a})`; };
export function mix(a, b, t) {
  const A = rgb(a), B = rgb(b);
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)})`;
}
/** hex colour scaled toward black (k<1) or white (k>1) */
export function shade(hex, k) {
  const [r, g, b] = rgb(hex);
  if (k <= 1) return `rgb(${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)})`;
  const w = Math.min(1, k - 1);
  return `rgb(${Math.round(r + (255 - r) * w)},${Math.round(g + (255 - g) * w)},${Math.round(b + (255 - b) * w)})`;
}

/** hex string for a number 0..255 as "0x4B" */
export const hex2 = (n) => '0x' + (n & 255).toString(16).toUpperCase().padStart(2, '0');
