// The gothic edition is red and black, nothing else. Scenes only ever draw in the red channel ("tone levels" 0..1); the final
// grade turns that single channel into one ramp: black -> deep crimson -> LED red -> a hot, slightly pale core. Whatever a
// scene or the bloom does, no other hue can reach the screen.
import { clamp, smooth, hash } from '../render/util.js';

const hex = (n) => n.toString(16).padStart(2, '0');
/** tone level 0..1 -> '#rr0000' */
export const L = (v) => '#' + hex(Math.round(255 * clamp(v))) + '0000';
/** tone level with alpha -> 'rgba(r,0,0,a)' */
export const La = (v, a = 1) => `rgba(${Math.round(255 * clamp(v))},0,0,${a})`;

/** the tone ladder the scenes share */
export const TONE = { ash: 0.05, dust: 0.09, ember: 0.17, coal: 0.3, blood: 0.5, led: 0.86, hot: 1 };

/** smooth 1-D value noise in [0,1) (deterministic: a pure function of x) */
export function noise1(x) {
  const i = Math.floor(x), f = smooth(x - i);
  return hash(i * 977 + 13) * (1 - f) + hash((i + 1) * 977 + 13) * f;
}
/** flame-like flicker: two octaves of noise, 0..1 */
export const flicker = (t, seed = 0) => 0.6 * noise1(t * 9 + seed * 31) + 0.4 * noise1(t * 23 + seed * 57 + 5);

// ---- final grade: red channel -> (r, g, b) ---------------------------------------------------------
const table = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  const v = Math.pow(i / 255, 0.88), h = smooth((v - 0.6) / 0.4), h2 = h * h; // a slight lift of the shadows: it is a very dark film
  const r = Math.round(255 * v), g = Math.round(255 * (0.018 * v + 0.34 * h2)), b = Math.round(255 * (0.032 * v + 0.28 * h2));
  table[i] = (255 << 24) | (b << 16) | (g << 8) | r; // little-endian RGBA
}
/** grade the whole canvas in place (reads only the red channel) */
export function grade(ctx, W, H) {
  const img = ctx.getImageData(0, 0, W, H), px = new Uint32Array(img.data.buffer);
  for (let i = 0; i < px.length; i++) px[i] = table[px[i] & 255];
  ctx.putImageData(img, 0, 0);
}
/** the hue/brightness the grade produces for a tone level, as [r,g,b] (for documentation and tests) */
export const gradeOf = (v) => { const p = table[Math.round(255 * clamp(v))]; return [p & 255, (p >> 8) & 255, (p >> 16) & 255]; };

/** Roman numerals (1..3999) - the gothic edition counts in them */
export function roman(n) {
  const T = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let s = '';
  for (const [v, r] of T) while (n >= v) { s += r; n -= v; }
  return s;
}
